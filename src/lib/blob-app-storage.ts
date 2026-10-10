import { randomUUID } from "crypto";
import { del, get, list } from "@vercel/blob";
import {
  blobAuthOptions,
  blobStoreAccess,
  hasBlobStorage,
  optionalReadBlob,
  readBlobJsonFresh,
  shouldWriteBlob,
  writeBlob,
} from "@/lib/storage";

const PREFIX = "mudrc/app-storage/";
const VERSION_PREFIX = "mudrc/app-storage/versions/";

function blobKey(name: string): string {
  return `${PREFIX}${name}.json`;
}

function versionPrefix(name: string): string {
  return `${VERSION_PREFIX}${safeName(name)}/`;
}

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function currentPointerKey(name: string): string {
  return `mudrc/app-storage/current/${safeName(name)}.json`;
}

type CurrentPointer = { pathname: string; url: string };

const freshPayloads = new Map<string, { at: number; data: unknown }>();

function rememberPayload(name: string, data: unknown) {
  freshPayloads.set(name, { at: Date.now(), data });
}

function recallPayload<T>(name: string, maxAgeMs: number): T | undefined {
  const row = freshPayloads.get(name);
  if (!row) return undefined;
  if (Date.now() - row.at > maxAgeMs) return undefined;
  return row.data as T;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type ListedBlob = { pathname: string; uploadedAt: number; url: string };

async function listBlobs(prefix: string, strict = false): Promise<ListedBlob[]> {
  if (!hasBlobStorage()) return [];
  const all: ListedBlob[] = [];
  let cursor: string | undefined;
  try {
    do {
      const result = await list({
        prefix,
        limit: 1000,
        cursor,
        abortSignal: AbortSignal.timeout(10000),
        ...blobAuthOptions(),
      });
      for (const blob of result.blobs) {
        const uploadedAt = new Date(blob.uploadedAt).getTime();
        all.push({
          pathname: blob.pathname,
          url: blob.url,
          uploadedAt: Number.isFinite(uploadedAt) ? uploadedAt : 0,
        });
      }
      cursor = result.hasMore ? result.cursor : undefined;
    } while (cursor);
  } catch (error) {
    if (strict) throw error;
    return all;
  }
  return all;
}

function isPointerDocument(data: unknown): boolean {
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  const row = data as Record<string, unknown>;
  return (
    typeof row.pathname === "string" &&
    typeof row.url === "string" &&
    !("items" in row) &&
    !("questions" in row) &&
    !("events" in row) &&
    !("registrations" in row)
  );
}

async function readBlobBody<T>(urlOrPathname: string, pathname: string): Promise<T | null> {
  const result = await get(urlOrPathname, {
    access: blobStoreAccess(),
    headers: { "cache-control": "no-cache", pragma: "no-cache" },
    abortSignal: AbortSignal.timeout(8000),
    ...blobAuthOptions(),
  });
  if (!result) return null;
  if (result.statusCode !== 200 || !result.stream) {
    throw new Error(`Blob get failed (${pathname}): incomplete response`);
  }
  const raw = await new Response(result.stream).text();
  const data = JSON.parse(raw) as T;
  if (isPointerDocument(data)) return null;
  return data;
}

async function readListed<T>(blob: ListedBlob): Promise<T | null> {
  return readBlobBody<T>(blob.pathname, blob.pathname);
}

async function latestVersion(name: string): Promise<ListedBlob | null> {
  const blobs = await listBlobs(versionPrefix(name), true);
  if (!blobs.length) return null;
  blobs.sort((a, b) => b.uploadedAt - a.uploadedAt || b.pathname.localeCompare(a.pathname));
  return blobs[0];
}

export async function readAppStorageCurrent<T>(name: string): Promise<T | null> {
  if (!hasBlobStorage()) return null;
  const cached = recallPayload<T>(name, 20_000);
  if (cached !== undefined) return cached;

  let pointer: CurrentPointer | null;
  try {
    pointer = await readBlobJsonFresh<CurrentPointer>(currentPointerKey(name));
  } catch (error) {
    const stale = recallPayload<T>(name, 10 * 60_000);
    if (stale !== undefined) return stale;
    throw error;
  }
  if (!pointer?.pathname && !pointer?.url) return null;
  if (isPointerDocument(pointer) && pointer.pathname === currentPointerKey(name)) return null;

  try {
    const data = await readBlobJsonFresh<T>(pointer.pathname || pointer.url);
    if (data !== null && !isPointerDocument(data)) {
      rememberPayload(name, data);
      return data;
    }
  } catch (error) {
    const stale = recallPayload<T>(name, 10 * 60_000);
    if (stale !== undefined) return stale;
    throw error instanceof Error ? error : new Error(`Úložisko ${name} sa nepodarilo načítať.`);
  }

  const stale = recallPayload<T>(name, 10 * 60_000);
  if (stale !== undefined) return stale;
  throw new Error(`Úložisko ${name} sa nepodarilo načítať.`);
}

async function pruneVersions(name: string, keepKey: string): Promise<void> {
  let blobs: ListedBlob[] = [];
  try {
    const result = await list({
      prefix: versionPrefix(name),
      limit: 40,
      abortSignal: AbortSignal.timeout(4000),
      ...blobAuthOptions(),
    });
    blobs = result.blobs.map((blob) => ({
      pathname: blob.pathname,
      url: blob.url,
      uploadedAt: new Date(blob.uploadedAt).getTime() || 0,
    }));
  } catch {
    return;
  }
  const newest = [...blobs].sort((a, b) => b.pathname.localeCompare(a.pathname))[0]?.pathname;
  const stale = blobs
    .filter((blob) => blob.pathname !== keepKey && blob.pathname !== newest)
    .sort((a, b) => a.pathname.localeCompare(b.pathname))
    .slice(0, 10);
  await Promise.all(
    stale.map(async (blob) => {
      try {
        await del(blob.pathname, blobAuthOptions());
      } catch {
        /* starý súbor už nemusí byť */
      }
    })
  );
}

export async function readAppStorageBlob<T>(name: string): Promise<T | null> {
  const current = await readAppStorageCurrent<T>(name);
  if (current !== null) return current;

  const latest = await latestVersion(name);
  if (latest) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const data = await readListed<T>(latest);
        if (data !== null) {
          try {
            await writeBlob(currentPointerKey(name), { pathname: latest.pathname, url: latest.url });
          } catch {
            /* ďalšie čítanie ešte vie nájsť verziu zoznamom */
          }
          return data;
        }
      } catch {
        /* nový súbor ešte nemusí byť na prvý pokus čitateľný */
      }
      await sleep(200);
    }
    throw new Error(`Úložisko ${name} sa nepodarilo načítať.`);
  }

  const legacyKey = blobKey(name);
  const listed = await listBlobs(legacyKey);
  const exact = listed.find((blob) => blob.pathname === legacyKey);
  if (exact) {
    try {
      return await readListed<T>(exact);
    } catch {
      return null;
    }
  }
  return optionalReadBlob<T>(legacyKey);
}

export async function writeAppStorageBlob(name: string, data: unknown): Promise<void> {
  if (!shouldWriteBlob()) {
    throw new Error("BLOB_NOT_CONFIGURED");
  }
  const key = `${versionPrefix(name)}${Date.now()}-${randomUUID()}.json`;
  const stored = await writeBlob(key, data);
  try {
    await writeBlob(
      currentPointerKey(name),
      {
        pathname: stored.pathname || key,
        url: stored.url,
      },
      { cacheControlMaxAge: 0 }
    );
  } catch (error) {
    console.error(`current pointer write failed (${name}):`, error);
  }
  void pruneVersions(name, key);
}

export async function deleteAppStorageBlob(name: string): Promise<void> {
  if (!shouldWriteBlob()) return;
  const blobs = await listBlobs(versionPrefix(name));
  await Promise.all(
    blobs.map(async (blob) => {
      try {
        await del(blob.pathname, blobAuthOptions());
      } catch {
        /* ignore */
      }
    })
  );
  try {
    await del(blobKey(name), blobAuthOptions());
  } catch {
    /* ignore missing blob */
  }
}

/** Všetky ešte existujúce verzie jedného úložiska, vrátane starého jedného súboru. */
export async function readAppStorageBlobHistory<T>(name: string): Promise<T[]> {
  const blobs = [...(await listBlobs(versionPrefix(name), true)), ...(await listBlobs(blobKey(name), true))];
  blobs.sort((a, b) => b.uploadedAt - a.uploadedAt);
  const seen = new Set<string>();
  const out: T[] = [];
  for (const blob of blobs) {
    if (seen.has(blob.pathname)) continue;
    seen.add(blob.pathname);
    try {
      const data = await readListed<T>(blob);
      if (data !== null) out.push(data);
    } catch {
      /* jedna stará verzia môže chýbať, ostatné ešte môžu mať kontakty */
    }
  }
  return out;
}

export async function countAppStorageBlobKeys(): Promise<number> {
  if (!hasBlobStorage()) return 0;
  try {
    const result = await list({ prefix: PREFIX, limit: 1000, ...blobAuthOptions() });
    return result.blobs.length;
  } catch {
    return 0;
  }
}
