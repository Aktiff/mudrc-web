import fs from "fs";
import path from "path";
import { del, head, list, put } from "@vercel/blob";
import type { QuizEvent, PastResult, PastResultTeam } from "@/lib/data";
import {
  getSupabaseStorageDiagnostics,
  hasSupabaseStorage,
  supabaseFetchEventLeague,
  supabaseFetchEvents,
  supabaseFetchQuizzes,
  supabaseFetchRegistrations,
  supabaseSetEvents,
  supabaseSetQuizzes,
  supabaseSetRegistrations,
} from "@/lib/supabase-storage";
import { findQuizResult, mergePastResults, normalizeDateKey, quizResultKey } from "@/lib/quiz-result-key";

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

/** Rovnako ako registrácie — samostatný kľúč `quizzes` v Supabase. */
export type StoredQuiz = {
  id: string;
  eventSlug: string;
  date: string;
  winnerTeam: string;
  points: number;
  teams: PastResultTeam[];
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

  const pastResults = incPR.length >= prevPR.length
    ? mergePastResults(prevPR, incPR)
    : mergePastResults(incPR, prevPR);

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

function pastResultToStoredQuiz(eventSlug: string, result: PastResult): StoredQuiz {
  return {
    id: quizResultKey(result),
    eventSlug,
    date: result.date,
    winnerTeam: result.winnerTeam,
    points: result.points,
    teams: result.teams ?? [],
  };
}

function storedQuizToPastResult(quiz: StoredQuiz): PastResult {
  return {
    id: quiz.id,
    date: quiz.date,
    winnerTeam: quiz.winnerTeam,
    points: quiz.points,
    teams: quiz.teams,
  };
}

function normalizeStoredQuiz(quiz: StoredQuiz): StoredQuiz {
  const id = quiz.id || normalizeDateKey(quiz.date);
  return {
    ...quiz,
    id,
    eventSlug: quiz.eventSlug,
    teams: quiz.teams ?? [],
  };
}

function enrichEventsWithQuizzes(events: QuizEvent[], quizzes: StoredQuiz[]): QuizEvent[] {
  if (!quizzes.length) return events;
  return events.map((event) => {
    const eventQuizzes = quizzes
      .filter((q) => q.eventSlug === event.slug)
      .map(storedQuizToPastResult);
    if (!eventQuizzes.length) return event;
    return {
      ...event,
      pastResults: mergePastResults(event.pastResults ?? [], eventQuizzes),
    };
  });
}

async function loadQuizzesRaw(): Promise<StoredQuiz[]> {
  if (hasSupabaseStorage()) {
    const result = await supabaseFetchQuizzes();
    if (result.status === "ok") {
      return ((result.value.quizzes ?? []) as StoredQuiz[]).map(normalizeStoredQuiz);
    }
    if (result.status === "error") {
      throw new Error(`Nepodarilo sa nacitat kvízy zo Supabase: ${result.message}`);
    }
    return [];
  }

  const events = readLocalEvents().events;
  const extracted: StoredQuiz[] = [];
  for (const event of events) {
    for (const result of event.pastResults ?? []) {
      if ((result.teams?.length ?? 0) > 0) {
        extracted.push(pastResultToStoredQuiz(event.slug, result));
      }
    }
  }
  return extracted;
}

async function persistQuizzes(quizzes: StoredQuiz[]): Promise<void> {
  if (hasSupabaseStorage()) {
    await supabaseSetQuizzes({ quizzes });
    return;
  }
  if (isVercel) {
    throw new Error("STORAGE_NOT_CONFIGURED");
  }
  // lokálne: kvízy zostávajú v events.local.json cez updateEvents
}

async function migrateQuizzesFromLegacy(events: QuizEvent[]): Promise<StoredQuiz[]> {
  const extracted: StoredQuiz[] = [];

  for (const event of events) {
    for (const result of event.pastResults ?? []) {
      if ((result.teams?.length ?? 0) > 0) {
        extracted.push(pastResultToStoredQuiz(event.slug, result));
      }
    }
  }

  if (hasSupabaseStorage() && extracted.length === 0) {
    for (const event of events) {
      const league = await supabaseFetchEventLeague(event.slug);
      if (league.status !== "ok") continue;
      for (const result of (league.value.pastResults ?? []) as PastResult[]) {
        if ((result.teams?.length ?? 0) > 0) {
          extracted.push(pastResultToStoredQuiz(event.slug, result));
        }
      }
    }
  }

  if (extracted.length > 0) {
    await persistQuizzes(extracted);
  }
  return extracted;
}

async function loadQuizzes(): Promise<StoredQuiz[]> {
  let quizzes = await loadQuizzesRaw();
  if (quizzes.length > 0) return quizzes;

  if (hasSupabaseStorage()) {
    const eventsResult = await supabaseFetchEvents();
    if (eventsResult.status === "ok") {
      const events = (eventsResult.value.events ?? []) as QuizEvent[];
      quizzes = await migrateQuizzesFromLegacy(events);
    }
  }
  return quizzes;
}

export async function upsertStoredQuiz(quiz: StoredQuiz): Promise<void> {
  const normalized = normalizeStoredQuiz(quiz);

  for (let attempt = 0; attempt < 5; attempt++) {
    const current = await loadQuizzes();
    const idx = current.findIndex(
      (existing) => existing.eventSlug === normalized.eventSlug && existing.id === normalized.id
    );
    const next =
      idx === -1
        ? [...current, normalized]
        : current.map((existing, i) => (i === idx ? normalized : existing));

    try {
      await persistQuizzes(next);
      return;
    } catch (error) {
      if (attempt === 4) throw error;
      await sleep(250 * (attempt + 1));
    }
  }
}

export async function deleteStoredQuiz(eventSlug: string, quizParam: string): Promise<boolean> {
  const key = normalizeDateKey(quizParam);
  let removed = false;

  for (let attempt = 0; attempt < 5; attempt++) {
    const current = await loadQuizzes();
    const next = current.filter((quiz) => {
      if (quiz.eventSlug !== eventSlug) return true;
      const matches =
        quiz.id === key ||
        normalizeDateKey(quiz.date) === key ||
        quiz.id === quizParam ||
        quiz.date.trim() === quizParam;
      if (matches) removed = true;
      return !matches;
    });
    if (!removed) return false;

    try {
      await persistQuizzes(next);
      return true;
    } catch (error) {
      if (attempt === 4) throw error;
      await sleep(250 * (attempt + 1));
    }
  }
  return removed;
}

export async function readStoredQuiz(eventSlug: string, quizParam: string): Promise<StoredQuiz | null> {
  const key = normalizeDateKey(quizParam);
  const quizzes = await loadQuizzes();
  return (
    quizzes.find(
      (quiz) =>
        quiz.eventSlug === eventSlug &&
        (quiz.id === key ||
          normalizeDateKey(quiz.date) === key ||
          quiz.id === quizParam ||
          quiz.date.trim() === quizParam)
    ) ?? null
  );
}

async function loadEventsBase(): Promise<QuizEvent[]> {
  if (hasSupabaseStorage()) {
    const result = await supabaseFetchEvents();
    if (result.status === "ok") {
      return (result.value.events ?? []) as QuizEvent[];
    }
    if (result.status === "error") {
      throw new Error(`Nepodarilo sa nacitat udalosti zo Supabase: ${result.message}`);
    }
    return bootstrapEventsToSupabase();
  }

  const fromBlob = await loadEventsFromBlobOptional();
  if (fromBlob?.length) return fromBlob;

  return readLocalEvents().events;
}

async function persistEvents(events: QuizEvent[]): Promise<void> {
  if (hasSupabaseStorage()) {
    await supabaseSetEvents({ events });
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
  const base = await loadEventsBase();
  const quizzes = await loadQuizzes();
  return enrichEventsWithQuizzes(base, quizzes);
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
  const stored = await readStoredQuiz(slug, quizParam);
  if (stored?.teams?.length) {
    const base = await loadEventsBase();
    const event = base.find((e) => e.slug === slug);
    if (!event) return null;
    return {
      event: enrichEventsWithQuizzes([event], [stored])[0],
      result: storedQuizToPastResult(stored),
    };
  }

  const { events } = await readEvents();
  const event = events.find((e) => e.slug === slug);
  if (!event) return null;
  const result = findQuizResult(event.pastResults ?? [], quizParam);
  if (!result?.teams?.length) return null;
  return { event, result };
}
