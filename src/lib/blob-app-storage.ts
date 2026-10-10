import { randomUUID } from "crypto";
import { del, get, list } from "@vercel/blob";
import {
  blobAuthOptions,
  blobStoreAccess,
  optionalReadBlob,
  shouldWriteBlob,
  writeBlob,
  hasBlobStorage,
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

async function readBlobBody<T>(urlOrPathname: string, pathname: string): Promise<T | null> {
  const result = await get(urlOrPathname, {
    access: blobStoreAccess(),
    headers: { "cache-control": "no-cache", pragma: "no-cache" },
    abortSignal: AbortSignal.timeout(12000),
    ...blobAuthOptions(),
  });
  if (!result) return null;
  if (result.statusCode !== 200 || !result.stream) {
    throw new Error(`Blob get failed (${pathname}): incomplete response`);
  }
  const raw = await new Response(result.stream).text();
  return JSON.parse(raw) as T;
}

async function readListed<T>(blob: ListedBlob): Promise<T | null> {
  const freshUrl = `${blob.url}${blob.url.includes("?") ? "&" : "?"}v=${Date.now()}`;
  try {
    const fresh = await readBlobBody<T>(freshUrl, blob.pathname);
    if (fresh !== null) return fresh;
  } catch {
    /* skús pôvodnú adresu */
  }
  return readBlobBody<T>(blob.url, blob.pathname);
}

async function latestVersion(name: string): Promise<ListedBlob | null> {
  const blobs = await listBlobs(versionPrefix(name), true);
  if (!blobs.length) return null;
  blobs.sort((a, b) => b.uploadedAt - a.uploadedAt || b.pathname.localeCompare(a.pathname));
  return blobs[0];
}

export async function readAppStorageCurrent<T>(name: string): Promise<T | null> {
  if (!hasBlobStorage()) return null;
  const pointer = await optionalReadBlob<CurrentPointer>(currentPointerKey(name));
  if (!pointer?.url && !pointer?.pathname) return null;
  try {
    return await readBlobBody<T>(pointer.url || pointer.pathname, pointer.pathname || currentPointerKey(name));
  } catch {
    return null;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

async function pruneVersions(name: string, keepKey: string): Promise<void> {
  const blobs = await withTimeout(listBlobs(versionPrefix(name)), 4000).catch(() => []);
  const stale = blobs
    .filter((blob) => blob.pathname !== keepKey)
    .sort((a, b) => a.uploadedAt - b.uploadedAt);
  const keepNewestExtra = stale.length > 1 ? 1 : 0;
  const toDelete = stale.slice(0, Math.max(0, stale.length - keepNewestExtra)).slice(0, 15);
  await Promise.all(
    toDelete.map(async (blob) => {
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
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const data = await readListed<T>(latest);
        if (data !== null) return data;
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
    await writeBlob(currentPointerKey(name), {
      pathname: stored.pathname || key,
      url: stored.url,
    });
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
