import fs from "fs";
import path from "path";
import { del, head, list, put } from "@vercel/blob";
import type { QuizEvent } from "@/lib/data";
import {
  getSupabaseStorageDiagnostics,
  hasSupabaseStorage,
  supabaseFetchEventLeague,
  supabaseFetchEvents,
  supabaseFetchRegistrations,
  supabaseSetEventLeague,
  supabaseSetEvents,
  supabaseSetRegistrations,
  type EventLeagueData,
} from "@/lib/supabase-storage";
import { findQuizResult } from "@/lib/quiz-result-key";

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

function shouldReadBlob(): boolean {
  return hasBlobStorage();
}

function shouldWriteBlob(): boolean {
  return hasBlobStorage();
}

export function getStorageDiagnostics() {
  return {
    vercel: isVercel,
    supabase: getSupabaseStorageDiagnostics(),
    blobStoreId: !!process.env.BLOB_STORE_ID,
    blobReadWriteToken: !!process.env.BLOB_READ_WRITE_TOKEN,
    vercelOidcToken: !!process.env.VERCEL_OIDC_TOKEN,
    envKeys: Object.keys(process.env).filter(
      (key) =>
        key.includes("BLOB") ||
        key.includes("SUPABASE") ||
        key === "VERCEL_OIDC_TOKEN"
    ),
  };
}

export function hasPersistentStorage(): boolean {
  return hasSupabaseStorage() || hasBlobStorage();
}

export { hasBlobStorage, hasSupabaseStorage };

/** @deprecated use getStorageDiagnostics */
export const getBlobStorageDiagnostics = getStorageDiagnostics;

type BlobAuthOptions = {
  token?: string;
  storeId?: string;
  oidcToken?: string;
};

function blobAuthOptions(): BlobAuthOptions {
  const token = process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_BLOB_READ_WRITE_TOKEN;
  if (token) return { token };

  const storeId = process.env.BLOB_STORE_ID;
  const oidcToken = process.env.VERCEL_OIDC_TOKEN;
  if (storeId && oidcToken) return { storeId, oidcToken };
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

async function downloadJson<T>(downloadUrl: string): Promise<T> {
  const res = await fetch(`${downloadUrl}?v=${Date.now()}`, {
    cache: "no-store",
    headers: { "Cache-Control": "no-cache, no-store, must-revalidate" },
  });
  if (!res.ok) throw new Error(`Blob download failed (${res.status})`);
  return (await res.json()) as T;
}

async function readBlobOnce<T>(key: string): Promise<T | null> {
  if (!shouldReadBlob()) return null;
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
  if (!shouldWriteBlob()) {
    throw new Error("BLOB_NOT_CONFIGURED");
  }

  const auth = blobAuthOptions();
  if (!auth.token && !auth.storeId) {
    throw new Error("BLOB_NOT_CONFIGURED");
  }

  const payload = JSON.stringify(data, null, 2);
  try {
    await put(key, payload, {
      access: "public",
      addRandomSuffix: false,
      contentType: "application/json",
      ...auth,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Blob write failed";
    throw new Error(`Blob write failed (${key}): ${message}`);
  }
}

async function deleteBlob(key: string): Promise<void> {
  if (!shouldWriteBlob()) return;
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

async function loadEventsFromSplitOptional(): Promise<QuizEvent[]> {
  const manifest = await optionalReadBlob<EventsManifest>(EVENTS_MANIFEST_KEY);
  if (!manifest?.slugs?.length) return [];

  const events = await Promise.all(
    manifest.slugs.map(async (slug) => optionalReadBlob<QuizEvent>(eventBlobKey(slug)))
  );
  return events.filter((event): event is QuizEvent => !!event);
}

async function loadEventsFromBlobOptional(): Promise<QuizEvent[] | null> {
  if (!shouldReadBlob()) return null;

  const legacy = await optionalReadBlob<{ events?: QuizEvent[] }>(LEGACY_EVENTS_KEY);
  if (legacy?.events?.length) return legacy.events;

  const fromSplit = await loadEventsFromSplitOptional();
  if (fromSplit.length) return fromSplit;

  return null;
}

async function listRegistrationBlobIds(): Promise<string[]> {
  if (!shouldReadBlob()) return [];
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

async function bootstrapEventsToSupabase(): Promise<QuizEvent[]> {
  const fromBlob = await loadEventsFromBlobOptional();
  const events = fromBlob?.length ? fromBlob : readLocalEvents().events;
  await persistEvents(events);
  return events;
}

function stripLeagueFields(event: QuizEvent): QuizEvent {
  return { ...event, pastResults: [], leagueTable: [] };
}

async function attachLeagueData(events: QuizEvent[]): Promise<QuizEvent[]> {
  if (!hasSupabaseStorage()) return events;

  return Promise.all(
    events.map(async (event) => {
      const league = await supabaseFetchEventLeague(event.slug);
      if (league.status === "ok") {
        return {
          ...event,
          pastResults: (league.value.pastResults ?? []) as QuizEvent["pastResults"],
          leagueTable: (league.value.leagueTable ?? []) as QuizEvent["leagueTable"],
          leagueActive:
            typeof league.value.leagueActive === "boolean" ? league.value.leagueActive : event.leagueActive,
        };
      }

      const hasInline =
        (event.pastResults?.length ?? 0) > 0 ||
        (event.leagueTable?.length ?? 0) > 0 ||
        event.leagueActive !== undefined;

      if (hasInline) {
        const payload: EventLeagueData = {
          pastResults: event.pastResults ?? [],
          leagueTable: event.leagueTable ?? [],
          leagueActive: event.leagueActive,
        };
        try {
          await supabaseSetEventLeague(event.slug, payload);
        } catch (error) {
          console.error(`Migrate league data for ${event.slug} failed:`, error);
        }
      }

      return event;
    })
  );
}

async function persistEvents(events: QuizEvent[]): Promise<void> {
  if (hasSupabaseStorage()) {
    await supabaseSetEvents({ events: events.map(stripLeagueFields) });
    await Promise.all(
      events.map((event) =>
        supabaseSetEventLeague(event.slug, {
          pastResults: event.pastResults ?? [],
          leagueTable: event.leagueTable ?? [],
          leagueActive: event.leagueActive,
        })
      )
    );
    return;
  }
  if (shouldWriteBlob()) {
    await writeBlob(LEGACY_EVENTS_KEY, { events });
    return;
  }
  if (isVercel) {
    throw new Error("STORAGE_NOT_CONFIGURED");
  }
  writeLocalEvents(events);
}

async function loadEvents(): Promise<QuizEvent[]> {
  if (hasSupabaseStorage()) {
    const result = await supabaseFetchEvents();
    if (result.status === "ok") {
      const base = (result.value.events ?? []) as QuizEvent[];
      return attachLeagueData(base);
    }
    if (result.status === "error") {
      throw new Error(`Nepodarilo sa nacitat kvízy zo Supabase: ${result.message}`);
    }
    return bootstrapEventsToSupabase();
  }

  const fromBlob = await loadEventsFromBlobOptional();
  if (fromBlob?.length) return fromBlob;

  return readLocalEvents().events;
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
  if (!shouldReadBlob()) return [];

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

async function persistRegistrations(registrations: Registration[]): Promise<void> {
  if (hasSupabaseStorage()) {
    await supabaseSetRegistrations({ registrations });
    return;
  }
  if (shouldWriteBlob()) {
    await persistRegistrationsBlob(registrations);
    return;
  }
  if (isVercel) {
    throw new Error("STORAGE_NOT_CONFIGURED");
  }
  writeLocalRegistrations(registrations);
}

async function loadRegistrations(): Promise<Registration[]> {
  if (hasSupabaseStorage()) {
    const result = await supabaseFetchRegistrations();
    if (result.status === "ok") {
      return ((result.value.registrations ?? []) as Registration[]).map(normalizeRegistration);
    }
    if (result.status === "error") {
      throw new Error(`Nepodarilo sa nacitat registracie zo Supabase: ${result.message}`);
    }

    const fromBlob = shouldReadBlob() ? await loadRegsFromBlob() : [];
    const registrations = fromBlob.length ? fromBlob : readLocalRegistrations().registrations;
    await supabaseSetRegistrations({ registrations });
    return registrations;
  }

  if (shouldReadBlob()) {
    const fromBlob = await loadRegsFromBlob();
    if (fromBlob.length) return fromBlob;
  }

  return readLocalRegistrations().registrations;
}

export async function updateEvents(
  mutator: (events: QuizEvent[]) => QuizEvent[] | Promise<QuizEvent[]>,
  options?: WriteOptions
): Promise<{ events: QuizEvent[] }> {
  const current = await loadEvents();
  const next = await mutator(structuredClone(current));
  assertEventsNotRegressed(current, next, options?.destructive);
  await persistEvents(next);
  return { events: next };
}

export async function updateRegistrations(
  mutator: (registrations: Registration[]) => Registration[] | Promise<Registration[]>,
  options?: WriteOptions
): Promise<{ registrations: Registration[] }> {
  const current = await loadRegistrations();
  const next = await mutator(structuredClone(current));
  assertRegsNotRegressed(current, next, options?.destructive);
  await persistRegistrations(next);

  return { registrations: next };
}

export async function readEvents(): Promise<{ events: QuizEvent[] }> {
  try {
    return { events: await loadEvents() };
  } catch (error) {
    console.error("readEvents error:", error);
    if (!hasSupabaseStorage() && !isVercel) {
      return { events: readLocalEvents().events };
    }
    throw error instanceof Error ? error : new Error("Nepodarilo sa nacitat udalosti.");
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
  const normalized = normalizeRegistration(reg);

  for (let attempt = 0; attempt < 5; attempt++) {
    const current = await loadRegistrations();
    if (current.some((existing) => existing.id === normalized.id)) return;

    const next = [...current, normalized];

    try {
      await persistRegistrations(next);
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

export async function readQuizResult(slug: string, quizParam: string) {
  const { events } = await readEvents();
  const event = events.find((e) => e.slug === slug);
  if (!event) return null;
  const result = findQuizResult(event.pastResults ?? [], quizParam);
  if (!result?.teams?.length) return null;
  return { event, result };
}
