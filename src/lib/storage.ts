import fs from "fs";
import path from "path";
import { del, head, list, put } from "@vercel/blob";
import type { QuizEvent } from "@/lib/data";

const LEGACY_EVENTS_KEY = "mudrc/events.json";
const LEGACY_REGS_KEY = "mudrc/registrations.json";
const EVENTS_MANIFEST_KEY = "mudrc/events/_manifest.json";
const eventBlobKey = (slug: string) => `mudrc/events/${slug}.json`;
const regBlobKey = (id: string) => `mudrc/registrations/${id}.json`;

const eventsPath = path.join(process.cwd(), "src/data/events.json");
const eventsLocalPath = path.join(process.cwd(), "src/data/events.local.json");
const regsPath = path.join(process.cwd(), "src/data/registrations.json");
const regsLocalPath = path.join(process.cwd(), "src/data/registrations.local.json");

const isVercel = !!process.env.VERCEL;

function hasBlobStorage(): boolean {
  return !!(
    process.env.BLOB_READ_WRITE_TOKEN ||
    process.env.VERCEL_BLOB_READ_WRITE_TOKEN ||
    process.env.BLOB_STORE_ID
  );
}

const useBlob = hasBlobStorage();

type BlobAuthOptions = {
  token?: string;
  storeId?: string;
};

function blobAuthOptions(): BlobAuthOptions {
  const token = process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_BLOB_READ_WRITE_TOKEN;
  const storeId = process.env.BLOB_STORE_ID;
  if (token) return { token };
  if (storeId) return { storeId };
  return {};
}

export type Registration = {
  id: string;
  eventSlug: string;
  venue: string;
  teamName: string;
  players: string;
  phone: string;
  createdAt: string;
};

export type WriteOptions = {
  destructive?: boolean;
};

type EventsManifest = { slugs: string[] };

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assertProductionStorage() {
  if (isVercel && !useBlob) {
    throw new Error(
      "Chyba konfiguracie: projekt nema pripojeny Vercel Blob store. Vo Verceli otvor Storage → Blob → Connect to Project a spusti redeploy."
    );
  }
}

function isBlobNotFound(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { name?: string; status?: number; message?: string };
  if (err.name === "BlobNotFoundError") return true;
  if (err.status === 404) return true;
  const msg = String(err.message ?? "").toLowerCase();
  return msg.includes("not found") || msg.includes("404");
}

function readLocalEvents(): { events: QuizEvent[] } {
  const file = fs.existsSync(eventsLocalPath) ? eventsLocalPath : eventsPath;
  let raw = fs.readFileSync(file, "utf-8");
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  return JSON.parse(raw);
}

function readLocalRegistrations(): { registrations: Registration[] } {
  try {
    const file = fs.existsSync(regsLocalPath) ? regsLocalPath : regsPath;
    let raw = fs.readFileSync(file, "utf-8");
    if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
    const data = JSON.parse(raw);
    return {
      registrations: (data.registrations ?? []).map((r: Registration & { eventSlug?: string }) => ({
        ...r,
        eventSlug: r.eventSlug ?? "",
      })),
    };
  } catch {
    return { registrations: [] };
  }
}

function writeLocalEvents(events: QuizEvent[]) {
  fs.writeFileSync(eventsLocalPath, JSON.stringify({ events }, null, 2), "utf-8");
}

function writeLocalRegistrations(registrations: Registration[]) {
  fs.writeFileSync(regsLocalPath, JSON.stringify({ registrations }, null, 2), "utf-8");
}

function tmpPath(key: string): string {
  return path.join("/tmp", key.replace(/\//g, "_"));
}

function readTmpJson<T>(key: string): T | null {
  try {
    const p = tmpPath(key);
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, "utf-8")) as T;
  } catch {
    return null;
  }
}

function writeTmpJson(key: string, data: unknown): boolean {
  try {
    fs.writeFileSync(tmpPath(key), JSON.stringify(data, null, 2), "utf-8");
    return true;
  } catch {
    return false;
  }
}

async function downloadJson<T>(downloadUrl: string): Promise<T> {
  const res = await fetch(`${downloadUrl}?v=${Date.now()}`, {
    cache: "no-store",
    headers: { "Cache-Control": "no-cache, no-store, must-revalidate" },
  });
  if (!res.ok) throw new Error(`Blob download failed (${res.status})`);
  return (await res.json()) as T;
}

async function readBlobOnce<T>(key: string): Promise<T | null> {
  if (!useBlob) return null;
  const auth = blobAuthOptions();

  try {
    const meta = await head(key, auth);
    return downloadJson<T>(meta.downloadUrl);
  } catch (error) {
    if (!isBlobNotFound(error)) throw error;
  }

  try {
    const result = await list({ prefix: key, limit: 10, ...auth });
    const blob = result.blobs.find((entry) => entry.pathname === key);
    if (!blob) return null;
    return downloadJson<T>(blob.downloadUrl);
  } catch (error) {
    if (isBlobNotFound(error)) return null;
    throw error;
  }
}

async function readBlob<T>(key: string): Promise<T | null> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await readBlobOnce<T>(key);
    } catch (error) {
      lastError = error;
      if (attempt < 4) await sleep(200 * (attempt + 1));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Blob read failed");
}

async function optionalReadBlob<T>(key: string): Promise<T | null> {
  try {
    return await readBlobOnce<T>(key);
  } catch {
    return null;
  }
}

async function writeBlob(key: string, data: unknown): Promise<void> {
  assertProductionStorage();
  if (!useBlob) return;

  const payload = JSON.stringify(data, null, 2);
  try {
    await put(key, payload, {
      access: "public",
      addRandomSuffix: false,
      contentType: "application/json",
      ...blobAuthOptions(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Blob write failed";
    throw new Error(`Blob write failed (${key}): ${message}`);
  }
}

async function deleteBlob(key: string): Promise<void> {
  if (!useBlob) return;
  try {
    await del(key, blobAuthOptions());
  } catch (error) {
    if (!isBlobNotFound(error)) throw error;
  }
}

function countQuizzes(events: QuizEvent[]): number {
  return events.reduce((sum, event) => sum + (event.pastResults?.length ?? 0), 0);
}

function mergeEventPreserve(stored: QuizEvent, incoming: QuizEvent): QuizEvent {
  const prevPR = stored.pastResults ?? [];
  const incPR = incoming.pastResults ?? [];
  const prevLT = stored.leagueTable ?? [];
  const incLT = incoming.leagueTable ?? [];

  const pastResults = incPR.length >= prevPR.length ? incPR : prevPR;

  let leagueTable = prevLT;
  if (incLT.length >= prevLT.length) {
    leagueTable = incLT;
  } else if (prevPR.length === 0 && incPR.length === 0) {
    leagueTable = incLT;
  }

  return {
    ...stored,
    ...incoming,
    slug: stored.slug,
    pastResults,
    leagueTable,
  };
}

function assertEventsNotRegressed(before: QuizEvent[], after: QuizEvent[], destructive?: boolean) {
  if (destructive) return;
  const beforeQuizzes = countQuizzes(before);
  const afterQuizzes = countQuizzes(after);
  if (afterQuizzes < beforeQuizzes) {
    throw new Error(
      `Zapis zablokovany: pocet kvizov by klesol z ${beforeQuizzes} na ${afterQuizzes}. Obnov stranku a skus znova.`
    );
  }
  if (after.length < before.length) {
    throw new Error("Zapis zablokovany: zmazanie udalosti nie je povolene v tomto ulozeni.");
  }
}

function assertRegsNotRegressed(before: Registration[], after: Registration[], destructive?: boolean) {
  if (destructive) return;
  if (after.length < before.length) {
    throw new Error(
      `Zapis zablokovany: pocet registracii by klesol z ${before.length} na ${after.length}. Obnov stranku a skus znova.`
    );
  }
}

async function loadLegacyEventsBlob(): Promise<QuizEvent[] | null> {
  const legacy = await readBlob<{ events?: QuizEvent[] }>(LEGACY_EVENTS_KEY);
  if (!legacy?.events?.length) return null;
  return legacy.events;
}

async function listRegistrationBlobIds(): Promise<string[]> {
  if (!useBlob) return [];
  try {
    const result = await list({ prefix: "mudrc/registrations/", limit: 1000, ...blobAuthOptions() });
    return result.blobs
      .map((blob) => blob.pathname)
      .filter((pathname) => pathname.startsWith("mudrc/registrations/") && pathname.endsWith(".json"))
      .filter((pathname) => !pathname.endsWith("/_manifest.json"))
      .map((pathname) => pathname.slice("mudrc/registrations/".length, -".json".length))
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function migrateEventsToSplit(events: QuizEvent[]): Promise<void> {
  for (const event of events) {
    await writeBlob(eventBlobKey(event.slug), event);
  }
  await writeBlob(EVENTS_MANIFEST_KEY, { slugs: events.map((e) => e.slug) } satisfies EventsManifest);
}

async function loadEventsFromBlob(): Promise<QuizEvent[]> {
  const manifest = await readBlob<EventsManifest>(EVENTS_MANIFEST_KEY);
  if (manifest?.slugs?.length) {
    const events = await Promise.all(
      manifest.slugs.map(async (slug) => readBlob<QuizEvent>(eventBlobKey(slug)))
    );
    return events.filter((event): event is QuizEvent => !!event);
  }

  const legacy = await loadLegacyEventsBlob();
  if (legacy?.length) {
    await migrateEventsToSplit(legacy);
    return legacy;
  }

  return [];
}

function normalizeRegistration(reg: Registration & { eventSlug?: string }): Registration {
  return { ...reg, eventSlug: reg.eventSlug ?? "" };
}

async function loadRegsFromSplitFiles(): Promise<Registration[]> {
  const ids = await listRegistrationBlobIds();
  if (ids.length === 0) return [];

  const regs = await Promise.all(
    ids.map(async (id) => optionalReadBlob<Registration>(regBlobKey(id)))
  );
  return regs.filter((reg): reg is Registration => !!reg).map(normalizeRegistration);
}

async function loadRegsFromBlob(): Promise<Registration[]> {
  const monolithic = await optionalReadBlob<{ registrations?: Registration[] }>(LEGACY_REGS_KEY);
  const fromMonolithic = (monolithic?.registrations ?? []).map(normalizeRegistration);

  const fromSplit = await loadRegsFromSplitFiles();
  if (fromMonolithic.length === 0) return fromSplit;

  if (fromSplit.length === 0) return fromMonolithic;

  const byId = new Map<string, Registration>();
  for (const reg of fromMonolithic) byId.set(reg.id, reg);
  for (const reg of fromSplit) byId.set(reg.id, reg);
  return Array.from(byId.values());
}

async function persistRegistrationsBlob(registrations: Registration[]): Promise<void> {
  await writeBlob(LEGACY_REGS_KEY, { registrations });
}

async function saveEventsDiff(before: QuizEvent[], after: QuizEvent[], destructive?: boolean): Promise<void> {
  if (!useBlob) {
    writeLocalEvents(after);
    return;
  }

  const beforeMap = new Map(before.map((event) => [event.slug, event]));
  const afterMap = new Map(after.map((event) => [event.slug, event]));

  if (destructive) {
    for (const slug of Array.from(beforeMap.keys())) {
      if (!afterMap.has(slug)) {
        await deleteBlob(eventBlobKey(slug));
      }
    }
  }

  for (const [slug, event] of Array.from(afterMap.entries())) {
    const prev = beforeMap.get(slug);
    if (!prev || JSON.stringify(prev) !== JSON.stringify(event)) {
      await writeBlob(eventBlobKey(slug), event);
    }
  }

  await writeBlob(EVENTS_MANIFEST_KEY, { slugs: Array.from(afterMap.keys()) } satisfies EventsManifest);
}

async function saveRegsDiff(before: Registration[], after: Registration[], destructive?: boolean): Promise<void> {
  if (!useBlob) {
    writeLocalRegistrations(after);
    return;
  }

  await persistRegistrationsBlob(after);

  if (destructive) {
    const afterIds = new Set(after.map((reg) => reg.id));
    for (const reg of before) {
      if (!afterIds.has(reg.id)) {
        await deleteBlob(regBlobKey(reg.id));
      }
    }
  }
}

async function loadEvents(): Promise<QuizEvent[]> {
  if (useBlob) return loadEventsFromBlob();
  if (isVercel) {
    const tmp = readTmpJson<{ events: QuizEvent[] }>(LEGACY_EVENTS_KEY);
    if (tmp?.events) return tmp.events;
    return readLocalEvents().events;
  }
  return readLocalEvents().events;
}

async function loadRegistrations(): Promise<Registration[]> {
  if (useBlob) return loadRegsFromBlob();
  if (isVercel) {
    const tmp = readTmpJson<{ registrations: Registration[] }>(LEGACY_REGS_KEY);
    if (tmp?.registrations) return tmp.registrations;
    return readLocalRegistrations().registrations;
  }
  return readLocalRegistrations().registrations;
}

async function persistEventsTmp(events: QuizEvent[]): Promise<void> {
  if (writeTmpJson(LEGACY_EVENTS_KEY, { events })) return;
  throw new Error("Storage unavailable");
}

async function persistRegsTmp(registrations: Registration[]): Promise<void> {
  if (writeTmpJson(LEGACY_REGS_KEY, { registrations })) return;
  throw new Error("Storage unavailable");
}

export async function updateEvents(
  mutator: (events: QuizEvent[]) => QuizEvent[] | Promise<QuizEvent[]>,
  options?: WriteOptions
): Promise<{ events: QuizEvent[] }> {
  assertProductionStorage();
  const current = await loadEvents();
  const next = await mutator(structuredClone(current));
  assertEventsNotRegressed(current, next, options?.destructive);

  if (useBlob) {
    await saveEventsDiff(current, next, options?.destructive);
  } else if (isVercel) {
    await persistEventsTmp(next);
  } else {
    writeLocalEvents(next);
  }

  return { events: next };
}

export async function updateRegistrations(
  mutator: (registrations: Registration[]) => Registration[] | Promise<Registration[]>,
  options?: WriteOptions
): Promise<{ registrations: Registration[] }> {
  assertProductionStorage();
  const current = await loadRegistrations();
  const next = await mutator(structuredClone(current));
  assertRegsNotRegressed(current, next, options?.destructive);

  if (useBlob) {
    await saveRegsDiff(current, next, options?.destructive);
  } else if (isVercel) {
    await persistRegsTmp(next);
  } else {
    writeLocalRegistrations(next);
  }

  return { registrations: next };
}

export async function readEvents(): Promise<{ events: QuizEvent[] }> {
  try {
    return { events: await loadEvents() };
  } catch (error) {
    console.error("readEvents error:", error);
    throw new Error("Nepodarilo sa nacitat udalosti. Skus obnovit stranku.");
  }
}

export async function writeEvents(data: { events: QuizEvent[] }, options?: WriteOptions): Promise<void> {
  await updateEvents((current) => {
    const incomingBySlug = new Map(data.events.map((event) => [event.slug, event]));
    const merged = current.map((stored) => {
      const inc = incomingBySlug.get(stored.slug);
      if (!inc) return stored;
      incomingBySlug.delete(stored.slug);
      return options?.destructive ? { ...stored, ...inc, slug: stored.slug } : mergeEventPreserve(stored, inc);
    });
    merged.push(...Array.from(incomingBySlug.values()));
    if (options?.destructive && data.events.length < current.length) {
      const keep = new Set(data.events.map((event) => event.slug));
      return merged.filter((event) => keep.has(event.slug));
    }
    return merged;
  }, options);
}

export async function readRegistrations(): Promise<{ registrations: Registration[] }> {
  try {
    return { registrations: await loadRegistrations() };
  } catch (error) {
    console.error("readRegistrations error:", error);
    throw new Error("Nepodarilo sa nacitat registracie. Skus obnovit stranku.");
  }
}

export async function writeRegistrations(
  data: { registrations: Registration[] },
  options?: WriteOptions
): Promise<void> {
  await updateRegistrations((current) => {
    if (options?.destructive) return data.registrations;
    const byId = new Map(current.map((reg) => [reg.id, reg]));
    for (const reg of data.registrations) byId.set(reg.id, reg);
    return Array.from(byId.values());
  }, options);
}

export async function addRegistration(reg: Registration): Promise<void> {
  assertProductionStorage();
  const normalized = normalizeRegistration(reg);

  for (let attempt = 0; attempt < 5; attempt++) {
    const current = await loadRegistrations();
    if (current.some((existing) => existing.id === normalized.id)) return;

    const next = [...current, normalized];

    try {
      if (useBlob) {
        await persistRegistrationsBlob(next);
      } else if (isVercel) {
        await persistRegsTmp(next);
      } else {
        writeLocalRegistrations(next);
      }
      return;
    } catch (error) {
      if (attempt === 4) throw error;
      await sleep(250 * (attempt + 1));
    }
  }
}

export async function deleteRegistrationById(id: string): Promise<boolean> {
  let removed = false;
  await updateRegistrations((regs) => {
    const next = regs.filter((reg) => reg.id !== id);
    removed = next.length !== regs.length;
    return next;
  }, { destructive: true });
  return removed;
}

export async function deleteRegistrationsForEvent(slug: string, venue?: string): Promise<number> {
  const venueLower = venue?.trim().toLowerCase();
  let removed = 0;

  await updateRegistrations((regs) => {
    const next = regs.filter((reg) => {
      if (slug && reg.eventSlug === slug) {
        if (venueLower && reg.venue.trim().toLowerCase() !== venueLower) return true;
        return false;
      }
      if (!slug && venueLower && reg.venue.trim().toLowerCase() === venueLower) return false;
      return true;
    });
    removed = regs.length - next.length;
    return next;
  }, { destructive: true });

  return removed;
}

export async function deleteRegistrationsByIds(ids: string[]): Promise<number> {
  const idSet = new Set(ids);
  if (idSet.size === 0) return 0;

  let removed = 0;
  await updateRegistrations((regs) => {
    const next = regs.filter((reg) => !idSet.has(reg.id));
    removed = regs.length - next.length;
    return next;
  }, { destructive: true });
  return removed;
}

export { mergeEventPreserve };
