import fs from "fs";
import path from "path";
import { head, list, put } from "@vercel/blob";
import type { QuizEvent } from "@/lib/data";

const EVENTS_KEY = "mudrc/events.json";
const REGS_KEY = "mudrc/registrations.json";
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function readBlobDataOnce<T>(key: string): Promise<T | null> {
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

async function readBlobData<T>(key: string): Promise<T | null> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await readBlobDataOnce<T>(key);
    } catch (error) {
      lastError = error;
      if (attempt < 4) await sleep(200 * (attempt + 1));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Blob read failed");
}

async function writeBlobJson(key: string, data: unknown): Promise<void> {
  if (!useBlob) return;
  const ok = await put(key, JSON.stringify(data, null, 2), {
    access: "public",
    addRandomSuffix: false,
    contentType: "application/json",
  }).then(() => true).catch(() => false);
  if (!ok) throw new Error("Blob write failed");
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

function applyIncomingEvents(current: QuizEvent[], incoming: QuizEvent[], destructive?: boolean): QuizEvent[] {
  const incomingBySlug = new Map(incoming.map((event) => [event.slug, event]));

  if (destructive && incoming.length < current.length) {
    return incoming.map((inc) => {
      const prev = current.find((event) => event.slug === inc.slug);
      return prev ? { ...prev, ...inc, slug: inc.slug } : inc;
    });
  }

  if (destructive) {
    return current
      .map((stored) => {
        const inc = incomingBySlug.get(stored.slug);
        if (!inc) return stored;
        return { ...stored, ...inc, slug: stored.slug };
      })
      .concat(incoming.filter((inc) => !current.some((stored) => stored.slug === inc.slug)));
  }

  const merged = current.map((stored) => {
    const inc = incomingBySlug.get(stored.slug);
    if (!inc) return stored;
    incomingBySlug.delete(stored.slug);
    return mergeEventPreserve(stored, inc);
  });

  merged.push(...Array.from(incomingBySlug.values()));
  return merged;
}

function applyIncomingRegistrations(current: Registration[], incoming: Registration[], destructive?: boolean): Registration[] {
  if (destructive) return incoming;
  const byId = new Map(current.map((reg) => [reg.id, reg]));
  for (const reg of incoming) byId.set(reg.id, reg);
  return Array.from(byId.values());
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

async function readEventsLocal(): Promise<{ events: QuizEvent[] }> {
  if (useBlob) {
    const blob = await readBlobData<{ events: QuizEvent[] }>(EVENTS_KEY);
    if (blob !== null) return { events: blob.events ?? [] };
    return readLocalEvents();
  }
  if (isVercel) {
    const tmp = readTmpJson<{ events: QuizEvent[] }>(EVENTS_KEY);
    if (tmp) return tmp;
    return readLocalEvents();
  }
  return readLocalEvents();
}

async function readRegsLocal(): Promise<{ registrations: Registration[] }> {
  if (useBlob) {
    const blob = await readBlobData<{ registrations: Registration[] }>(REGS_KEY);
    if (blob !== null) return { registrations: blob.registrations ?? [] };
    return readLocalRegistrations();
  }
  if (isVercel) {
    const tmp = readTmpJson<{ registrations: Registration[] }>(REGS_KEY);
    if (tmp) return tmp;
    return readLocalRegistrations();
  }
  return readLocalRegistrations();
}

async function persistEvents(events: QuizEvent[], options?: WriteOptions): Promise<void> {
  const payload = { events };

  if (useBlob) {
    await writeBlobJson(EVENTS_KEY, payload);
    return;
  }
  if (isVercel) {
    if (writeTmpJson(EVENTS_KEY, payload)) return;
    throw new Error("Storage unavailable");
  }
  fs.writeFileSync(eventsLocalPath, JSON.stringify(payload, null, 2), "utf-8");
}

async function persistRegistrations(registrations: Registration[], options?: WriteOptions): Promise<void> {
  const payload = { registrations };

  if (useBlob) {
    await writeBlobJson(REGS_KEY, payload);
    return;
  }
  if (isVercel) {
    if (writeTmpJson(REGS_KEY, payload)) return;
    throw new Error("Storage unavailable");
  }
  fs.writeFileSync(regsLocalPath, JSON.stringify(payload, null, 2), "utf-8");
}

export async function updateEvents(
  mutator: (events: QuizEvent[]) => QuizEvent[] | Promise<QuizEvent[]>,
  options?: WriteOptions
): Promise<{ events: QuizEvent[] }> {
  const fresh = useBlob ? await readBlobData<{ events: QuizEvent[] }>(EVENTS_KEY) : null;
  const current = fresh?.events ?? (await readEventsLocal()).events;
  const next = await mutator(structuredClone(current));
  assertEventsNotRegressed(current, next, options?.destructive);
  await persistEvents(next, options);
  return { events: next };
}

export async function updateRegistrations(
  mutator: (registrations: Registration[]) => Registration[] | Promise<Registration[]>,
  options?: WriteOptions
): Promise<{ registrations: Registration[] }> {
  const fresh = useBlob ? await readBlobData<{ registrations: Registration[] }>(REGS_KEY) : null;
  const current = fresh?.registrations ?? (await readRegsLocal()).registrations;
  const next = await mutator(structuredClone(current));
  assertRegsNotRegressed(current, next, options?.destructive);
  await persistRegistrations(next, options);
  return { registrations: next };
}

export async function readEvents(): Promise<{ events: QuizEvent[] }> {
  try {
    return await readEventsLocal();
  } catch (error) {
    console.error("readEvents error:", error);
    throw new Error("Nepodarilo sa nacitat udalosti. Skus obnovit stranku.");
  }
}

export async function writeEvents(data: { events: QuizEvent[] }, options?: WriteOptions): Promise<void> {
  await updateEvents((current) => applyIncomingEvents(current, data.events, options?.destructive), options);
}

export async function readRegistrations(): Promise<{ registrations: Registration[] }> {
  try {
    return await readRegsLocal();
  } catch (error) {
    console.error("readRegistrations error:", error);
    throw new Error("Nepodarilo sa nacitat registracie. Skus obnovit stranku.");
  }
}

export async function writeRegistrations(
  data: { registrations: Registration[] },
  options?: WriteOptions
): Promise<void> {
  await updateRegistrations(
    (current) => applyIncomingRegistrations(current, data.registrations, options?.destructive),
    options
  );
}

export async function addRegistration(reg: Registration): Promise<void> {
  await updateRegistrations((regs) => {
    if (regs.some((existing) => existing.id === reg.id)) return regs;
    return [...regs, reg];
  });
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
  let removed = 0;
  await updateRegistrations((regs) => {
    const next = regs.filter((reg) => !idSet.has(reg.id));
    removed = regs.length - next.length;
    return next;
  }, { destructive: true });
  return removed;
}

export { mergeEventPreserve };
