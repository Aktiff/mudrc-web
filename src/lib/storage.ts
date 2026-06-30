import fs from "fs";
import path from "path";
import { head, put } from "@vercel/blob";
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
  /** Explicit delete/reset — skips loss protection for intentional removals */
  destructive?: boolean;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isBlobNotFound(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { status?: number; message?: string };
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

async function readBlobJsonOnce<T>(key: string): Promise<T | null> {
  if (!useBlob) return null;
  try {
    const meta = await head(key);
    const res = await fetch(`${meta.url}?t=${Date.now()}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache, no-store, must-revalidate" },
    });
    if (!res.ok) throw new Error(`Blob fetch failed (${res.status})`);
    return (await res.json()) as T;
  } catch (error) {
    if (isBlobNotFound(error)) return null;
    throw error;
  }
}

async function readBlobJson<T>(key: string): Promise<T | null> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await readBlobJsonOnce<T>(key);
    } catch (error) {
      lastError = error;
      if (attempt < 3) await sleep(150 * (attempt + 1));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Blob read failed");
}

async function writeBlobJson(key: string, data: unknown): Promise<boolean> {
  if (!useBlob) return false;
  try {
    await put(key, JSON.stringify(data, null, 2), {
      access: "public",
      addRandomSuffix: false,
      contentType: "application/json",
    });
    return true;
  } catch {
    return false;
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

  let leagueTable = incLT;
  if (prevPR.length > 0 && incLT.length < prevLT.length) {
    leagueTable = prevLT;
  } else if (incLT.length >= prevLT.length) {
    leagueTable = incLT;
  } else if (prevPR.length === 0 && incPR.length === 0) {
    leagueTable = incLT;
  } else {
    leagueTable = prevLT;
  }

  return {
    ...stored,
    ...incoming,
    slug: stored.slug,
    pastResults,
    leagueTable,
  };
}

function mergeEventsSafe(stored: QuizEvent[], incoming: QuizEvent[]): QuizEvent[] {
  const incomingBySlug = new Map(incoming.map((event) => [event.slug, event]));
  const merged = stored.map((storedEvent) => {
    const inc = incomingBySlug.get(storedEvent.slug);
    if (!inc) return storedEvent;
    incomingBySlug.delete(storedEvent.slug);
    return mergeEventPreserve(storedEvent, inc);
  });

  for (const inc of incomingBySlug.values()) {
    merged.push(inc);
  }

  return merged;
}

function mergeEventsDestructive(stored: QuizEvent[], incoming: QuizEvent[]): QuizEvent[] {
  return incoming.map((inc) => {
    const prev = stored.find((event) => event.slug === inc.slug);
    return prev ? { ...prev, ...inc, slug: inc.slug } : inc;
  });
}

function mergeRegistrations(stored: Registration[], incoming: Registration[]): Registration[] {
  const byId = new Map(stored.map((reg) => [reg.id, reg]));
  for (const reg of incoming) byId.set(reg.id, reg);
  return Array.from(byId.values());
}

async function prepareEventsWrite(
  incoming: { events: QuizEvent[] },
  options?: WriteOptions
): Promise<{ events: QuizEvent[] }> {
  if (!useBlob) return incoming;

  const fresh = await readBlobJson<{ events: QuizEvent[] }>(EVENTS_KEY);
  if (!fresh?.events?.length) return incoming;

  const merged = options?.destructive
    ? { events: mergeEventsDestructive(fresh.events, incoming.events) }
    : { events: mergeEventsSafe(fresh.events, incoming.events) };

  if (!options?.destructive) {
    const before = countQuizzes(fresh.events);
    const after = countQuizzes(merged.events);
    if (after < before) {
      throw new Error(
        `Zapis zablokovany: pocet kvizov by klesol z ${before} na ${after}. Obnov stranku a skus znova.`
      );
    }
    if (merged.events.length < fresh.events.length) {
      throw new Error("Zapis zablokovany: zmazanie udalosti nie je povolene v tomto ulozeni.");
    }
  }

  return merged;
}

async function prepareRegistrationsWrite(
  incoming: { registrations: Registration[] },
  options?: WriteOptions
): Promise<{ registrations: Registration[] }> {
  if (!useBlob) return incoming;

  const fresh = await readBlobJson<{ registrations: Registration[] }>(REGS_KEY);
  if (!fresh?.registrations?.length) return incoming;

  const merged = options?.destructive
    ? incoming
    : { registrations: mergeRegistrations(fresh.registrations, incoming.registrations) };

  if (!options?.destructive && merged.registrations.length < fresh.registrations.length) {
    throw new Error(
      `Zapis zablokovany: pocet registracii by klesol z ${fresh.registrations.length} na ${merged.registrations.length}.`
    );
  }

  return merged;
}

export async function readEvents(): Promise<{ events: QuizEvent[] }> {
  if (useBlob) {
    try {
      const blob = await readBlobJson<{ events: QuizEvent[] }>(EVENTS_KEY);
      if (blob?.events?.length) return blob;
      if (isVercel) return readLocalEvents();
    } catch (error) {
      console.error("readEvents blob error:", error);
      throw new Error("Nepodarilo sa nacitat udalosti. Skus obnovit stranku.");
    }
  }

  if (isVercel) {
    const tmp = readTmpJson<{ events: QuizEvent[] }>(EVENTS_KEY);
    if (tmp) return tmp;
    return readLocalEvents();
  }

  return readLocalEvents();
}

export async function writeEvents(data: { events: QuizEvent[] }, options?: WriteOptions): Promise<void> {
  const toWrite = await prepareEventsWrite(data, options);

  if (useBlob) {
    const ok = await writeBlobJson(EVENTS_KEY, toWrite);
    if (!ok) throw new Error("Blob write failed");
    return;
  }

  if (isVercel) {
    if (writeTmpJson(EVENTS_KEY, toWrite)) return;
    throw new Error("Storage unavailable");
  }

  fs.writeFileSync(eventsLocalPath, JSON.stringify(toWrite, null, 2), "utf-8");
}

export async function readRegistrations(): Promise<{ registrations: Registration[] }> {
  if (useBlob) {
    try {
      const blob = await readBlobJson<{ registrations: Registration[] }>(REGS_KEY);
      if (blob) return blob;
      if (isVercel) return readLocalRegistrations();
    } catch (error) {
      console.error("readRegistrations blob error:", error);
      throw new Error("Nepodarilo sa nacitat registracie. Skus obnovit stranku.");
    }
  }

  if (isVercel) {
    const tmp = readTmpJson<{ registrations: Registration[] }>(REGS_KEY);
    if (tmp) return tmp;
    return readLocalRegistrations();
  }

  return readLocalRegistrations();
}

export async function writeRegistrations(
  data: { registrations: Registration[] },
  options?: WriteOptions
): Promise<void> {
  const toWrite = await prepareRegistrationsWrite(data, options);

  if (useBlob) {
    const ok = await writeBlobJson(REGS_KEY, toWrite);
    if (!ok) throw new Error("Blob write failed");
    return;
  }

  if (isVercel) {
    if (writeTmpJson(REGS_KEY, toWrite)) return;
    throw new Error("Storage unavailable");
  }

  fs.writeFileSync(regsLocalPath, JSON.stringify(toWrite, null, 2), "utf-8");
}

export async function addRegistration(reg: Registration): Promise<void> {
  const data = await readRegistrations();
  if (data.registrations.some((existing) => existing.id === reg.id)) return;
  data.registrations.push(reg);
  await writeRegistrations(data);
}
