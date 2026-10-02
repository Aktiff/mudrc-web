import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { del, get, list, put } from "@vercel/blob";
import type { QuizEvent, LeagueEntry, PastResult, PastResultTeam } from "@/lib/data";
import { sortEventsByDate, sortLeagueTable } from "@/lib/data";
import { isValidStoredEvent } from "@/lib/event-normalize";
import { rebuildLeagueFromPastResults } from "@/lib/league-rebuild";
import seedEventsBundle from "@/data/events.json";
import { writeAppStorageBlob, readAppStorageBlob } from "@/lib/blob-app-storage";
import { findQuizResult, mergePastResults, normalizeDateKey, quizResultKey } from "@/lib/quiz-result-key";
import { splitVenueQuizType } from "@/lib/quiz-type";

const QUIZZES_APP_BLOB = "quizzes";

const LEGACY_EVENTS_KEY = "mudrc/events.json";
const LEGACY_REGS_KEY = "mudrc/registrations.json";
const REGS_MANIFEST_KEY = "mudrc/registrations/_manifest.json";
const EVENTS_MANIFEST_KEY = "mudrc/events/_manifest.json";
const eventBlobKey = (slug: string) => `mudrc/events/${slug}.json`;
const regBlobKey = (id: string) => `mudrc/registrations/${id}.json`;
const REGS_VERSION_PREFIX = "mudrc/registrations/versions/";
const EVENTS_VERSION_PREFIX = "mudrc/events/versions/";

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

export function shouldWriteBlob(): boolean {
  return hasBlobStorage();
}

export function getStorageDiagnostics() {
  return {
    vercel: isVercel,
    blobStoreId: !!process.env.BLOB_STORE_ID,
    blobReadWriteToken: !!process.env.BLOB_READ_WRITE_TOKEN,
    vercelOidcToken: !!process.env.VERCEL_OIDC_TOKEN,
    envKeys: Object.keys(process.env).filter(
      (key) => key.includes("BLOB") || key === "VERCEL_OIDC_TOKEN"
    ),
  };
}

export function hasPersistentStorage(): boolean {
  return hasBlobStorage();
}

export { hasBlobStorage };

/** @deprecated use getStorageDiagnostics */
export const getBlobStorageDiagnostics = getStorageDiagnostics;

type BlobAuthOptions = {
  token?: string;
  storeId?: string;
  oidcToken?: string;
};

export function blobAuthOptions(): BlobAuthOptions {
  const token = process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_BLOB_READ_WRITE_TOKEN;
  if (token) return { token };

  const storeId = process.env.BLOB_STORE_ID;
  const oidcToken = process.env.VERCEL_OIDC_TOKEN;
  if (storeId && oidcToken) return { storeId, oidcToken };
  if (storeId) return { storeId };

  return {};
}

/** Private stores (default on Vercel) require access: "private"; public store → BLOB_ACCESS=public */
export function blobStoreAccess(): "public" | "private" {
  const raw = process.env.BLOB_ACCESS?.trim().toLowerCase();
  if (raw === "public") return "public";
  return "private";
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

/** Rovnako ako registrácie — výsledky kvízov v Blobe. */
export type StoredQuiz = {
  id: string;
  eventSlug: string;
  date: string;
  winnerTeam: string;
  points: number;
  teams: PastResultTeam[];
  libraryQuizId?: string;
  quizType?: string;
};

export type WriteOptions = {
  destructive?: boolean;
};

type EventsManifest = { slugs: string[] };

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function archiveRegistrationContacts(regs: Registration[]): Promise<void> {
  if (!regs.length) return;
  try {
    const { rememberTeamsFromRegistrations } = await import("@/lib/venue-teams");
    await rememberTeamsFromRegistrations(regs);
  } catch (error) {
    console.error("venue team archive failed:", error);
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

async function readBlobJsonViaGet<T>(pathname: string): Promise<T | null> {
  const auth = blobAuthOptions();
  const result = await get(pathname, {
    access: blobStoreAccess(),
    useCache: false,
    ...auth,
  });
  if (!result) return null;
  if (result.statusCode !== 200 || !result.stream) {
    throw new Error(`Blob get failed (${pathname}): incomplete response`);
  }
  if (result.statusCode === 200 && result.stream) {
    const raw = await new Response(result.stream).text();
    return JSON.parse(raw) as T;
  }
  throw new Error(`Blob get failed (${pathname}): unexpected blob response`);
}

async function readBlobOnce<T>(key: string): Promise<T | null> {
  if (!shouldReadBlob()) return null;
  const auth = blobAuthOptions();

  try {
    const direct = await readBlobJsonViaGet<T>(key);
    if (direct !== null) return direct;
  } catch (error) {
    if (!isBlobNotFound(error)) throw error;
  }

  try {
    const result = await list({ prefix: key, limit: 10, ...auth });
    const blob = result.blobs.find((entry) => entry.pathname === key);
    if (!blob) return null;
    return readBlobJsonViaGet<T>(blob.pathname);
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

export async function optionalReadBlob<T>(key: string): Promise<T | null> {
  try {
    return await readBlobOnce<T>(key);
  } catch {
    return null;
  }
}

export async function writeBlob(key: string, data: unknown): Promise<void> {
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
      access: blobStoreAccess(),
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 60,
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

/** Per-slug súbory majú prednosť pred monolitom — pri paralelnom ukladaní podnikov sa nestratia fotky. */
async function loadLegacyEventsFromBlob(): Promise<QuizEvent[] | null> {
  if (!shouldReadBlob()) return null;

  const legacy = await readPathFresh<{ events?: QuizEvent[] }>(LEGACY_EVENTS_KEY);
  const manifest = await readPathFresh<EventsManifest>(EVENTS_MANIFEST_KEY);

  const splitEvents: QuizEvent[] = [];
  if (manifest?.slugs?.length) {
    const loaded = await Promise.all(
      manifest.slugs.map(async (slug) => readPathFresh<QuizEvent>(eventBlobKey(slug)))
    );
    for (const event of loaded) {
      if (event?.slug) splitEvents.push(event);
    }
  }

  const bySlug = new Map<string, QuizEvent>();
  for (const event of legacy?.events ?? []) {
    if (event.slug) bySlug.set(event.slug, event);
  }
  for (const event of splitEvents) {
    bySlug.set(event.slug, event);
  }

  if (bySlug.size === 0) return null;
  return Array.from(bySlug.values());
}

async function latestEventsVersion(): Promise<{ pathname: string; uploadedAt: number; url: string } | null> {
  const blobs = await listBlobsByPrefix(EVENTS_VERSION_PREFIX);
  if (!blobs.length) return null;
  blobs.sort((a, b) => b.uploadedAt - a.uploadedAt || b.pathname.localeCompare(a.pathname));
  return blobs[0];
}

/** Nový súbor pri každom zápise. Prepísaná cesta ostáva v cache a po refreshi vráti starý checklist. */
async function loadVersionedEvents(): Promise<QuizEvent[] | null> {
  const latest = await latestEventsVersion();
  if (!latest) return null;

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const data = await readListedBlobJson<{ events?: QuizEvent[] }>(latest);
      if (data && Array.isArray(data.events)) return data.events;
    } catch {
      // nový súbor ešte nemusí byť na prvý pokus čitateľný
    }
    await sleep(200);
  }
  throw new Error("Udalosti sa nepodarilo načítať. Skús obnoviť stránku.");
}

async function pruneOldEventVersions(keepKey: string): Promise<void> {
  const blobs = await listBlobsByPrefix(EVENTS_VERSION_PREFIX);
  const stale = blobs
    .filter((blob) => blob.pathname !== keepKey)
    .sort((a, b) => b.uploadedAt - a.uploadedAt)
    .slice(1);
  await Promise.all(stale.map((blob) => deleteBlob(blob.pathname)));
}

async function loadEventsFromBlobOptional(): Promise<QuizEvent[] | null> {
  if (!shouldReadBlob()) return null;
  const versioned = await loadVersionedEvents();
  if (versioned !== null) return versioned;
  return loadLegacyEventsFromBlob();
}

async function persistEventsBlob(events: QuizEvent[]): Promise<void> {
  const prepared = events.map(eventForEventsKey);
  const key = `${EVENTS_VERSION_PREFIX}${Date.now()}-${randomUUID()}.json`;
  await writeBlob(key, { events: prepared });

  for (let attempt = 0; attempt < 8; attempt++) {
    const latest = await latestEventsVersion();
    if (latest?.pathname === key) {
      void pruneOldEventVersions(key);
      return;
    }
    await sleep(200);
  }

  throw new Error("Udalosti sa nepodarilo hneď uložiť. Skús znova.");
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

function readBundledSeedEvents(): QuizEvent[] {
  const imported = (seedEventsBundle as { events?: QuizEvent[] }).events;
  if (imported?.length) return imported;
  try {
    return readLocalEvents().events;
  } catch (error) {
    console.error("readBundledSeedEvents error:", error);
    return [];
  }
}

async function loadEventsFromFallbackSources(): Promise<QuizEvent[]> {
  const fromBlob = await loadEventsFromBlobOptional();
  if (fromBlob !== null) return fromBlob;
  return readBundledSeedEvents();
}

function pastResultToStoredQuiz(eventSlug: string, result: PastResult): StoredQuiz {
  return {
    id: quizResultKey(result),
    eventSlug,
    date: result.date,
    winnerTeam: result.winnerTeam,
    points: result.points,
    teams: result.teams ?? [],
    libraryQuizId: result.libraryQuizId,
    ...(result.quizType?.trim() ? { quizType: result.quizType.trim() } : {}),
  };
}

function storedQuizToPastResult(quiz: StoredQuiz): PastResult {
  return {
    id: quiz.id,
    date: quiz.date,
    winnerTeam: quiz.winnerTeam,
    points: quiz.points,
    teams: quiz.teams,
    libraryQuizId: quiz.libraryQuizId,
    ...(quiz.quizType?.trim() ? { quizType: quiz.quizType.trim() } : {}),
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

/** Prepočet ligy z uložených kvízov v Blobe a súhrnných výsledkov v udalostiach. */
export async function rebuildLeagueTableForEvent(event: QuizEvent): Promise<{
  leagueTable: LeagueEntry[];
  pastResults: PastResult[];
}> {
  const quizzes = await loadQuizzes();
  const eventQuizzes = quizzes
    .filter((quiz) => quiz.eventSlug === event.slug)
    .map(storedQuizToPastResult);
  const mergedResults = mergePastResults(event.pastResults ?? [], eventQuizzes);
  const rebuilt = rebuildLeagueFromPastResults(mergedResults, event.slug);

  for (const result of rebuilt.pastResults) {
    if (!result.teams?.length) continue;
    await upsertStoredQuiz(pastResultToStoredQuiz(event.slug, result));
  }

  return rebuilt;
}

async function loadQuizzesRaw(): Promise<StoredQuiz[]> {
  const fromBlob = await readAppStorageBlob<{ quizzes?: StoredQuiz[] }>(QUIZZES_APP_BLOB);
  if (fromBlob && Array.isArray(fromBlob.quizzes)) {
    return fromBlob.quizzes.map(normalizeStoredQuiz);
  }

  const events = readBundledSeedEvents();
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
  if (shouldWriteBlob()) {
    await writeAppStorageBlob(QUIZZES_APP_BLOB, { quizzes });
    return;
  }
  if (isVercel) {
    throw new Error("Úložisko nie je dostupné. Vo Verceli nastav BLOB_STORE_ID / token.");
  }
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

  if (extracted.length > 0) {
    try {
      await persistQuizzes(extracted);
    } catch (error) {
      console.error("migrateQuizzesFromLegacy persist error:", error);
    }
  }
  return extracted;
}

async function loadQuizzes(): Promise<StoredQuiz[]> {
  return loadQuizzesRaw();
}

export async function readAllStoredQuizzes(): Promise<StoredQuiz[]> {
  return loadQuizzes();
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

export async function deleteStoredQuizzesForEvent(eventSlug: string): Promise<number> {
  const current = await loadQuizzes();
  const next = current.filter((quiz) => quiz.eventSlug !== eventSlug);
  const removed = current.length - next.length;
  if (removed > 0) await persistQuizzes(next);
  return removed;
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

export async function hasQuizForDate(eventSlug: string, date: string): Promise<boolean> {
  const key = normalizeDateKey(date);
  const stored = await readStoredQuiz(eventSlug, key);
  if (stored) return true;

  const { events } = await readEvents();
  const event = events.find((entry) => entry.slug === eventSlug);
  if (!event) return false;
  return !!findQuizResult(event.pastResults ?? [], key);
}

async function loadEventsBase(): Promise<QuizEvent[]> {
  return loadEventsFromFallbackSources();
}

export async function persistEvents(events: QuizEvent[]): Promise<void> {
  if (shouldWriteBlob()) {
    await persistEventsBlob(events);
    return;
  }
  if (isVercel) {
    throw new Error("Úložisko nie je dostupné. Vo Verceli nastav BLOB_STORE_ID / token.");
  }
  writeLocalEvents(events);
}

let splittingVenueQuizType = false;

async function loadEvents(): Promise<QuizEvent[]> {
  const base = await loadEventsBase();
  const split = base.map((event) => {
    const next = splitVenueQuizType(event.venue, event.quizType);
    if (next.venue === event.venue.trim() && next.quizType === (event.quizType ?? "").trim()) return event;
    return { ...event, venue: next.venue, quizType: next.quizType || event.quizType };
  });
  const changed = split.some((event, index) => event !== base[index]);
  if (changed && !splittingVenueQuizType) {
    splittingVenueQuizType = true;
    try {
      await persistEvents(split);
    } finally {
      splittingVenueQuizType = false;
    }
  }
  const quizzes = await loadQuizzes();
  return enrichEventsWithQuizzes(changed ? split : base, quizzes);
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

async function listBlobsByPrefix(prefix: string): Promise<{ pathname: string; uploadedAt: number; url: string }[]> {
  if (!shouldReadBlob()) return [];
  const all: { pathname: string; uploadedAt: number; url: string }[] = [];
  let cursor: string | undefined;
  try {
    do {
      const result = await list({ prefix, limit: 1000, cursor, ...blobAuthOptions() });
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
  } catch {
    return all;
  }
  return all;
}

async function fetchBlobJson<T>(urlOrPathname: string, pathname: string): Promise<T | null> {
  const result = await get(urlOrPathname, {
    access: blobStoreAccess(),
    headers: { "cache-control": "no-cache", pragma: "no-cache" },
    ...blobAuthOptions(),
  });
  if (!result) return null;
  if (result.statusCode !== 200 || !result.stream) {
    throw new Error(`Blob get failed (${pathname}): incomplete response`);
  }
  const raw = await new Response(result.stream).text();
  return JSON.parse(raw) as T;
}

async function readListedBlobJson<T>(blob: { pathname: string; url: string }): Promise<T | null> {
  const freshUrl = `${blob.url}${blob.url.includes("?") ? "&" : "?"}v=${Date.now()}`;
  try {
    const fresh = await fetchBlobJson<T>(freshUrl, blob.pathname);
    if (fresh !== null) return fresh;
  } catch {
    // cache-bust URL sa niekedy nepodarí, skúsime pôvodnú adresu
  }
  return fetchBlobJson<T>(blob.url, blob.pathname);
}

async function latestRegistrationVersion(): Promise<{ pathname: string; uploadedAt: number; url: string } | null> {
  const blobs = await listBlobsByPrefix(REGS_VERSION_PREFIX);
  if (!blobs.length) return null;
  blobs.sort((a, b) => b.uploadedAt - a.uploadedAt || b.pathname.localeCompare(a.pathname));
  return blobs[0];
}

/** Nový súbor pri každom zápise. Prepísaný pathname ostáva v cache a po refreshi by vrátil zmazané registrácie. */
async function loadVersionedRegistrations(): Promise<Registration[] | null> {
  const latest = await latestRegistrationVersion();
  if (!latest) return null;

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const data = await readListedBlobJson<{ registrations?: Registration[] }>(latest);
      if (data && Array.isArray(data.registrations)) {
        return data.registrations.map(normalizeRegistration);
      }
    } catch {
      // nový súbor ešte nemusí byť na prvý pokus čitateľný
    }
    await sleep(200);
  }
  throw new Error("Registrácie sa nepodarilo načítať. Skús obnoviť stránku.");
}

async function readPathFresh<T>(pathname: string): Promise<T | null> {
  const blobs = await listBlobsByPrefix(pathname);
  const exact = blobs.find((blob) => blob.pathname === pathname);
  if (!exact) return null;
  try {
    return await readListedBlobJson<T>(exact);
  } catch {
    return null;
  }
}

async function pruneOldRegistrationVersions(keepKey: string): Promise<void> {
  const blobs = await listBlobsByPrefix(REGS_VERSION_PREFIX);
  const stale = blobs
    .filter((blob) => blob.pathname !== keepKey)
    .sort((a, b) => b.uploadedAt - a.uploadedAt)
    .slice(1);
  await Promise.all(stale.map((blob) => deleteBlob(blob.pathname)));
}

/** `null` = v Blobe ešte nie je úložisko registrácií. Prázdne pole = zámerne žiadne registrácie. */
async function loadRegsFromBlob(): Promise<Registration[] | null> {
  if (!shouldReadBlob()) return null;

  const versioned = await loadVersionedRegistrations();
  if (versioned !== null) return versioned;

  const manifest = await readPathFresh<{ ids: string[] }>(REGS_MANIFEST_KEY);
  if (manifest && Array.isArray(manifest.ids)) {
    if (manifest.ids.length === 0) return [];
    const loaded = await Promise.all(
      manifest.ids.map(async (id) => optionalReadBlob<Registration>(regBlobKey(id)))
    );
    return loaded.filter((reg): reg is Registration => !!reg).map(normalizeRegistration);
  }

  const monolithic = await readPathFresh<{ registrations?: Registration[] }>(LEGACY_REGS_KEY);
  if (monolithic && Array.isArray(monolithic.registrations)) {
    return monolithic.registrations.map(normalizeRegistration);
  }

  const split = await loadRegsFromSplitFiles();
  return split.length ? split : null;
}

async function persistRegistrationsBlob(registrations: Registration[]): Promise<void> {
  const normalized = registrations.map(normalizeRegistration);
  const key = `${REGS_VERSION_PREFIX}${Date.now()}-${randomUUID()}.json`;
  await writeBlob(key, { registrations: normalized });

  for (let attempt = 0; attempt < 8; attempt++) {
    const latest = await latestRegistrationVersion();
    if (latest?.pathname === key) {
      void pruneOldRegistrationVersions(key);
      return;
    }
    await sleep(200);
  }

  throw new Error("Registrácie sa nepodarilo hneď uložiť. Skús znova.");
}

export async function persistRegistrations(registrations: Registration[]): Promise<void> {
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
  if (shouldReadBlob()) {
    const fromBlob = await loadRegsFromBlob();
    if (fromBlob !== null) return fromBlob;
  }

  return readLocalRegistrations().registrations;
}

function eventForEventsKey(event: QuizEvent): QuizEvent {
  return {
    ...event,
    pastResults: (event.pastResults ?? []).map((r) => ({
      id: r.id,
      date: r.date,
      winnerTeam: r.winnerTeam,
      points: r.points,
      ...(typeof r.playerCount === "number" && r.playerCount > 0 ? { playerCount: r.playerCount } : {}),
      ...(r.quizType?.trim() ? { quizType: r.quizType.trim() } : {}),
    })),
  };
}

export async function updateEvents(
  mutator: (events: QuizEvent[]) => QuizEvent[] | Promise<QuizEvent[]>,
  options?: WriteOptions
): Promise<{ events: QuizEvent[] }> {
  const quizzes = await loadQuizzes();
  const base = await loadEventsBase();
  const current = enrichEventsWithQuizzes(base, quizzes);
  const nextEnriched = await mutator(structuredClone(current));
  assertEventsNotRegressed(current, nextEnriched, options?.destructive);

  const nextBySlug = new Map(nextEnriched.map((event) => [event.slug, event]));
  let nextBase = base.map((stored) => {
    const updated = nextBySlug.get(stored.slug);
    return updated ? eventForEventsKey(updated) : stored;
  });

  for (const event of nextEnriched) {
    if (!base.some((stored) => stored.slug === event.slug)) {
      nextBase.push(eventForEventsKey(event));
    }
  }

  if (options?.destructive) {
    const keep = new Set(nextEnriched.map((event) => event.slug));
    nextBase = nextBase.filter((event) => keep.has(event.slug));
  }

  await persistEvents(nextBase);
  return { events: nextEnriched };
}

/** Priame ulozenie jednej udalosti — rovnaky vzor ako addRegistration. */
export async function patchEvent(
  slug: string,
  patch: Partial<QuizEvent>,
  options?: { includeLeagueData?: boolean }
): Promise<QuizEvent> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const base = await loadEventsBase();
    const idx = base.findIndex((event) => event.slug === slug);
    if (idx === -1) throw new Error("NOT_FOUND");

    const stored = base[idx];
    let updated: QuizEvent;

    if (options?.includeLeagueData) {
      const quizzes = await loadQuizzes();
      const existing = enrichEventsWithQuizzes(base, quizzes).find((event) => event.slug === slug)!;
      updated = {
        ...existing,
        ...patch,
        slug,
        leagueTable: patch.leagueTable ?? existing.leagueTable ?? [],
        pastResults: patch.pastResults
          ? mergePastResults(existing.pastResults ?? [], patch.pastResults)
          : existing.pastResults ?? [],
        leagueActive: patch.leagueActive ?? existing.leagueActive,
      };
    } else {
      updated = {
        ...stored,
        ...patch,
        slug,
        leagueTable: stored.leagueTable ?? [],
        pastResults: stored.pastResults ?? [],
        leagueActive: stored.leagueActive,
      };
    }

    const next = [...base];
    next[idx] = eventForEventsKey(updated);

    try {
      await persistEvents(next);
      const quizzes = await loadQuizzes();
      const result = enrichEventsWithQuizzes(next, quizzes).find((event) => event.slug === slug);
      if (!result) throw new Error("NOT_FOUND");
      return { ...result, imageUrl: updated.imageUrl ?? result.imageUrl };
    } catch (error) {
      if (attempt === 4) throw error;
      await sleep(400 * (attempt + 1));
    }
  }

  throw new Error("PATCH_EVENT_FAILED");
}

export function getSeedEvents(): QuizEvent[] {
  try {
    let raw = fs.readFileSync(eventsPath, "utf-8");
    if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
    const data = JSON.parse(raw) as { events?: QuizEvent[] };
    return data.events ?? [];
  } catch {
    return [];
  }
}

export async function listMissingSeedEvents(): Promise<QuizEvent[]> {
  const seed = getSeedEvents();
  const base = await loadEventsBase();
  const slugs = new Set(base.map((event) => event.slug));
  return seed.filter((event) => !slugs.has(event.slug));
}

export async function restoreEventsFromSeed(slugs?: string[]): Promise<{ restored: string[]; skipped: string[] }> {
  const seed = getSeedEvents();
  const wanted = slugs?.length ? new Set(slugs) : null;
  const candidates = wanted ? seed.filter((event) => wanted.has(event.slug)) : seed;

  const base = await loadEventsBase();
  const existing = new Set(base.map((event) => event.slug));

  const restored: string[] = [];
  const skipped: string[] = [];
  const toAdd: QuizEvent[] = [];

  for (const event of candidates) {
    if (existing.has(event.slug)) {
      skipped.push(event.slug);
      continue;
    }
    toAdd.push({ ...event, leagueActive: event.leagueActive !== false });
    restored.push(event.slug);
  }

  if (toAdd.length > 0) {
    await updateEvents((events) => [...events, ...toAdd]);
  }

  return { restored, skipped };
}

export async function getEventsStorageMeta(): Promise<{
  source: string;
  configured: boolean;
  eventCount: number;
}> {
  if (shouldReadBlob()) {
    const fromBlob = await loadEventsFromBlobOptional();
    return {
      source: "blob",
      configured: true,
      eventCount: fromBlob?.length ?? 0,
    };
  }
  return { source: "local", configured: !isVercel, eventCount: readLocalEvents().events.length };
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
    const loaded = sortEventsByDate(await loadEvents());
    return { events: loaded.filter(isValidStoredEvent) };
  } catch (error) {
    console.error("readEvents error:", error);
    const fallback = sortEventsByDate(readBundledSeedEvents().filter(isValidStoredEvent));
    if (fallback.length) return { events: fallback };
    throw error instanceof Error ? error : new Error("Nepodarilo sa nacitat udalosti.");
  }
}

/** Všetky záznamy vrátane neúplných — pre admin a kontrolu slug. */
export async function readAllEventsRaw(): Promise<{ events: QuizEvent[] }> {
  try {
    return { events: sortEventsByDate(await loadEvents()) };
  } catch (error) {
    console.error("readAllEventsRaw error:", error);
    const fallback = sortEventsByDate(readBundledSeedEvents());
    if (fallback.length) return { events: fallback };
    throw error instanceof Error ? error : new Error("Nepodarilo sa nacitat udalosti.");
  }
}

export async function storedEventSlugExists(slug: string): Promise<boolean> {
  const base = await loadEventsBase();
  return base.some((event) => event.slug === slug);
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

function registrationsFromUnknown(data: unknown): Registration[] {
  if (!data || typeof data !== "object") return [];
  const record = data as { registrations?: Registration[]; teamName?: string; phone?: string };
  if (Array.isArray(record.registrations)) return record.registrations.map(normalizeRegistration);
  if (record.teamName) return [normalizeRegistration(record as Registration)];
  return [];
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

/** Staršie súbory registrácií, z ktorých sa dajú vrátiť telefóny zmazané zo zoznamu tímov. */
export async function readArchivedRegistrations(): Promise<Registration[]> {
  if (!shouldReadBlob()) return readLocalRegistrations().registrations;

  const prefixes = ["mudrc/registrations/", LEGACY_REGS_KEY];
  const blobs: { pathname: string; uploadedAt: number; url: string }[] = [];
  for (const prefix of prefixes) {
    let cursor: string | undefined;
    do {
      const result = await list({ prefix, limit: 1000, cursor, ...blobAuthOptions() });
      for (const blob of result.blobs) {
        const uploadedAt = new Date(blob.uploadedAt).getTime();
        blobs.push({
          pathname: blob.pathname,
          url: blob.url,
          uploadedAt: Number.isFinite(uploadedAt) ? uploadedAt : 0,
        });
      }
      cursor = result.hasMore ? result.cursor : undefined;
    } while (cursor);
  }

  const unique = Array.from(new Map(blobs.map((blob) => [blob.pathname, blob])).values()).filter(
    (blob) => blob.pathname.endsWith(".json") && !blob.pathname.endsWith("_manifest.json")
  );
  const groups = await mapPool(unique, 6, async (blob) => {
    try {
      const data = await readListedBlobJson<unknown>(blob);
      return registrationsFromUnknown(data);
    } catch {
      return [];
    }
  });
  return groups.flat();
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
      await archiveRegistrationContacts([normalized]);
      return;
    } catch (error) {
      if (attempt === 4) throw error;
      await sleep(250 * (attempt + 1));
    }
  }
}

export async function deleteRegistrationById(id: string): Promise<boolean> {
  let removed = false;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await updateRegistrations(async (regs) => {
        const dropping = regs.filter((reg) => reg.id === id);
        await archiveRegistrationContacts(dropping);
        const next = regs.filter((reg) => reg.id !== id);
        removed = next.length !== regs.length;
        return next;
      }, { destructive: true });
      if (removed && shouldWriteBlob()) {
        await deleteBlob(regBlobKey(id));
      }
      return removed;
    } catch (error) {
      if (attempt === 4) throw error;
      await sleep(400 * (attempt + 1));
    }
  }
  return removed;
}

export async function updateRegistrationById(
  id: string,
  patch: Partial<Pick<Registration, "players">>
): Promise<Registration | null> {
  let updated: Registration | null = null;
  await updateRegistrations((regs) => {
    const idx = regs.findIndex((reg) => reg.id === id);
    if (idx === -1) return regs;
    const next = [...regs];
    next[idx] = normalizeRegistration({ ...next[idx], ...patch });
    updated = next[idx];
    return next;
  }, { destructive: true });
  return updated;
}

export async function purgeRegistrationsForPlace(slug: string, venue?: string): Promise<number> {
  const venueLower = venue?.trim().toLowerCase();
  let removed = 0;

  await updateRegistrations((regs) => {
    const next = regs.filter((reg) => {
      if (slug && reg.eventSlug === slug) return false;
      if (venueLower && (reg.venue ?? "").trim().toLowerCase() === venueLower) return false;
      return true;
    });
    removed = regs.length - next.length;
    return next;
  }, { destructive: true });

  return removed;
}

export async function deleteRegistrationsForEvent(slug: string, venue?: string): Promise<number> {
  const venueLower = venue?.trim().toLowerCase();
  let removed = 0;

  await updateRegistrations(async (regs) => {
    const dropping = regs.filter((reg) => {
      if (slug && reg.eventSlug === slug) {
        if (venueLower && reg.venue.trim().toLowerCase() !== venueLower) return false;
        return true;
      }
      if (!slug && venueLower && reg.venue.trim().toLowerCase() === venueLower) return true;
      return false;
    });
    await archiveRegistrationContacts(dropping);
    const next = regs.filter((reg) => !dropping.includes(reg));
    removed = regs.length - next.length;
    return next;
  }, { destructive: true });

  return removed;
}

export async function deleteRegistrationsByIds(ids: string[]): Promise<number> {
  const idSet = new Set(ids);
  if (idSet.size === 0) return 0;

  let removed = 0;
  await updateRegistrations(async (regs) => {
    const dropping = regs.filter((reg) => idSet.has(reg.id));
    await archiveRegistrationContacts(dropping);
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
