import fs from "fs";
import path from "path";
import { del, head, list, put } from "@vercel/blob";
import type { QuizEvent } from "@/lib/data";

const LEGACY_EVENTS_KEY = "mudrc/events.json";
const LEGACY_REGS_KEY = "mudrc/registrations.json";
const EVENTS_MANIFEST_KEY = "mudrc/events/_manifest.json";
const REGS_MANIFEST_KEY = "mudrc/registrations/_manifest.json";
const eventBlobKey = (slug: string) => `mudrc/events/${slug}.json`;
const regBlobKey = (id: string) => `mudrc/registrations/${id}.json`;

const eventsPath = path.join(process.cwd(), "src/data/events.json");
const eventsLocalPath = path.join(process.cwd(), "src/data/events.local.json");
const regsPath = path.join(process.cwd(), "src/data/registrations.json");
const regsLocalPath = path.join(process.cwd(), "src/data/registrations.local.json");

const isVercel = !!process.env.VERCEL;
const useBlob = !!process.env.BLOB_READ_WRITE_TOKEN;

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
type RegsManifest = { ids: string[] };

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assertProductionStorage() {
  if (isVercel && !useBlob) {
    throw new Error("Chyba konfiguracie: na Verceli chyba BLOB_READ_WRITE_TOKEN. Data sa neukladaju trvalo.");
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

  try {
    const meta = await head(key);
    return downloadJson<T>(meta.downloadUrl);
  } catch (error) {
    if (!isBlobNotFound(error)) throw error;
  }

  try {
    const result = await list({ prefix: key, limit: 10 });
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

async function writeBlob(key: string, data: unknown): Promise<void> {
  assertProductionStorage();
  if (!useBlob) return;

  const payload = JSON.stringify(data, null, 2);
  await put(key, payload, {
    access: "public",
    addRandomSuffix: false,
    contentType: "application/json",
  });
}

async function deleteBlob(key: string): Promise<void> {
  if (!useBlob) return;
  try {
    await del(key);
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

async function loadLegacyRegsBlob(): Promise<Registration[] | null> {
  const legacy = await readBlob<{ registrations?: Registration[] }>(LEGACY_REGS_KEY);
  if (!legacy?.registrations?.length) return null;
  return legacy.registrations.map((r) => ({ ...r, eventSlug: r.eventSlug ?? "" }));
}

async function migrateEventsToSplit(events: QuizEvent[]): Promise<void> {
  for (const event of events) {
    await writeBlob(eventBlobKey(event.slug), event);
  }
  await writeBlob(EVENTS_MANIFEST_KEY, { slugs: events.map((e) => e.slug) } satisfies EventsManifest);
}

async function migrateRegsToSplit(regs: Registration[]): Promise<void> {
  for (const reg of regs) {
    await writeBlob(regBlobKey(reg.id), reg);
  }
  await writeBlob(REGS_MANIFEST_KEY, { ids: regs.map((r) => r.id) } satisfies RegsManifest);
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

async function loadRegsFromBlob(): Promise<Registration[]> {
  const manifest = await readBlob<RegsManifest>(REGS_MANIFEST_KEY);
  if (manifest?.ids?.length) {
    const regs = await Promise.all(
      manifest.ids.map(async (id) => readBlob<Registration>(regBlobKey(id)))
    );
    return regs.filter((reg): reg is Registration => !!reg);
  }

  const legacy = await loadLegacyRegsBlob();
  if (legacy?.length) {
    await migrateRegsToSplit(legacy);
    return legacy;
  }

  return [];
}

async function saveEventsDiff(before: QuizEvent[], after: QuizEvent[], destructive?: boolean): Promise<void> {
  if (!useBlob) {
    writeLocalEvents(after);
    return;
  }

  const beforeMap = new Map(before.map((event) => [event.slug, event]));
  const afterMap = new Map(after.map((event) => [event.slug, event]));

  if (destructive) {
    for (const slug of beforeMap.keys()) {
      if (!afterMap.has(slug)) {
        await deleteBlob(eventBlobKey(slug));
      }
    }
  }

  for (const [slug, event] of afterMap) {
    const prev = beforeMap.get(slug);
    if (!prev || JSON.stringify(prev) !== JSON.stringify(event)) {
      await writeBlob(eventBlobKey(slug), event);
    }
  }

  await writeBlob(EVENTS_MANIFEST_KEY, { slugs: [...afterMap.keys()] } satisfies EventsManifest);
}

async function saveRegsDiff(before: Registration[], after: Registration[], destructive?: boolean): Promise<void> {
  if (!useBlob) {
    writeLocalRegistrations(after);
    return;
  }

  const beforeIds = new Set(before.map((reg) => reg.id));
  const afterIds = new Set(after.map((reg) => reg.id));

  if (destructive) {
    for (const id of beforeIds) {
      if (!afterIds.has(id)) {
        await deleteBlob(regBlobKey(id));
      }
    }
  }

  const beforeMap = new Map(before.map((reg) => [reg.id, reg]));
  for (const reg of after) {
    const prev = beforeMap.get(reg.id);
    if (!prev || JSON.stringify(prev) !== JSON.stringify(reg)) {
      await writeBlob(regBlobKey(reg.id), reg);
    }
  }

  await writeBlob(REGS_MANIFEST_KEY, { ids: [...afterIds] } satisfies RegsManifest);
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

  if (useBlob) {
    const existing = await readBlob<Registration>(regBlobKey(reg.id));
    if (existing) return;

    const manifest = (await readBlob<RegsManifest>(REGS_MANIFEST_KEY)) ?? { ids: [] };
    if (manifest.ids.length === 0) {
      const legacy = await loadLegacyRegsBlob();
      if (legacy?.length) await migrateRegsToSplit(legacy);
    }

    await writeBlob(regBlobKey(reg.id), reg);

    for (let attempt = 0; attempt < 5; attempt++) {
      const currentManifest = (await readBlob<RegsManifest>(REGS_MANIFEST_KEY)) ?? { ids: [] };
      if (currentManifest.ids.includes(reg.id)) return;

      const ids = currentManifest.ids.includes(reg.id)
        ? currentManifest.ids
        : [...currentManifest.ids, reg.id];

      try {
        await writeBlob(REGS_MANIFEST_KEY, { ids } satisfies RegsManifest);
        return;
      } catch {
        if (attempt === 4) throw new Error("Nepodarilo sa ulozit registraciu.");
        await sleep(150 * (attempt + 1));
      }
    }
    return;
  }

  await updateRegistrations((regs) => {
    if (regs.some((existing) => existing.id === reg.id)) return regs;
    return [...regs, reg];
  });
}

export async function deleteRegistrationById(id: string): Promise<boolean> {
  if (useBlob) {
    const existing = await readBlob<Registration>(regBlobKey(id));
    if (!existing) return false;

    await deleteBlob(regBlobKey(id));

    const manifest = (await readBlob<RegsManifest>(REGS_MANIFEST_KEY)) ?? { ids: [] };
    await writeBlob(
      REGS_MANIFEST_KEY,
      { ids: manifest.ids.filter((entry) => entry !== id) } satisfies RegsManifest
    );
    return true;
  }

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
  const all = await loadRegistrations();
  const toDelete = all.filter((reg) => {
    if (slug && reg.eventSlug === slug) {
      if (venueLower && reg.venue.trim().toLowerCase() !== venueLower) return false;
      return true;
    }
    if (!slug && venueLower && reg.venue.trim().toLowerCase() === venueLower) return true;
    return false;
  });

  if (toDelete.length === 0) return 0;

  if (useBlob) {
    for (const reg of toDelete) {
      await deleteBlob(regBlobKey(reg.id));
    }
    const deleteIds = new Set(toDelete.map((reg) => reg.id));
    const manifest = (await readBlob<RegsManifest>(REGS_MANIFEST_KEY)) ?? { ids: [] };
    await writeBlob(
      REGS_MANIFEST_KEY,
      { ids: manifest.ids.filter((id) => !deleteIds.has(id)) } satisfies RegsManifest
    );
    return toDelete.length;
  }

  let removed = 0;
  await updateRegistrations((regs) => {
    const next = regs.filter((reg) => !toDelete.some((item) => item.id === reg.id));
    removed = regs.length - next.length;
    return next;
  }, { destructive: true });
  return removed;
}

export async function deleteRegistrationsByIds(ids: string[]): Promise<number> {
  const idSet = new Set(ids);
  if (idSet.size === 0) return 0;

  if (useBlob) {
    let removed = 0;
    for (const id of idSet) {
      const existing = await readBlob<Registration>(regBlobKey(id));
      if (!existing) continue;
      await deleteBlob(regBlobKey(id));
      removed += 1;
    }
    const manifest = (await readBlob<RegsManifest>(REGS_MANIFEST_KEY)) ?? { ids: [] };
    await writeBlob(
      REGS_MANIFEST_KEY,
      { ids: manifest.ids.filter((id) => !idSet.has(id)) } satisfies RegsManifest
    );
    return removed;
  }

  let removed = 0;
  await updateRegistrations((regs) => {
    const next = regs.filter((reg) => !idSet.has(reg.id));
    removed = regs.length - next.length;
    return next;
  }, { destructive: true });
  return removed;
}

export { mergeEventPreserve };
