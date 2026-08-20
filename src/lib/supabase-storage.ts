import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const EVENTS_KEY = "events";
const REGS_KEY = "registrations";
const QUIZZES_KEY = "quizzes";
const QUIZ_DECKS_KEY = "quiz-decks";
const QUIZ_LIBRARY_KEY = "quiz-library";
const QUIZ_LIBRARY_INDEX_KEY = "quiz-library-index";
export const quizLibraryItemKey = (id: string) => `quiz-library:${id}`;
const POLL_CONFIGS_KEY = "poll-configs";
const POLL_VOTES_KEY = "poll-votes";
const eventLeagueKey = (slug: string) => `event-league:${slug}`;

export type EventLeagueData = {
  pastResults: unknown[];
  leagueTable: unknown[];
  leagueActive?: boolean;
};

let client: SupabaseClient | null = null;

export type SupabaseFetchResult<T> =
  | { status: "ok"; value: T }
  | { status: "missing" }
  | { status: "error"; message: string };

function getConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url, key };
}

export function hasSupabaseStorage(): boolean {
  return getConfig() !== null;
}

function getSupabase(): SupabaseClient {
  const config = getConfig();
  if (!config) throw new Error("SUPABASE_NOT_CONFIGURED");
  if (!client) client = createClient(config.url, config.key, { auth: { persistSession: false } });
  return client;
}

async function supabaseFetch<T>(key: string): Promise<SupabaseFetchResult<T>> {
  if (!hasSupabaseStorage()) return { status: "missing" };

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.from("app_storage").select("value").eq("key", key).maybeSingle();
    if (error) return { status: "error", message: error.message };
    if (!data) return { status: "missing" };
    return { status: "ok", value: data.value as T };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Supabase read failed";
    return { status: "error", message };
  }
}

async function supabaseSet(key: string, value: unknown): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from("app_storage").upsert(
    { key, value, updated_at: new Date().toISOString() },
    { onConflict: "key" }
  );
  if (error) throw new Error(`Supabase write failed (${key}): ${error.message}`);
}

async function supabaseDelete(key: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from("app_storage").delete().eq("key", key);
  if (error) throw new Error(`Supabase delete failed (${key}): ${error.message}`);
}

export async function supabaseFetchEvents(): Promise<SupabaseFetchResult<{ events: unknown[] }>> {
  return supabaseFetch<{ events: unknown[] }>(EVENTS_KEY);
}

export async function supabaseSetEvents(data: { events: unknown[] }): Promise<void> {
  await supabaseSet(EVENTS_KEY, data);
}

export async function supabaseFetchRegistrations(): Promise<SupabaseFetchResult<{ registrations: unknown[] }>> {
  return supabaseFetch<{ registrations: unknown[] }>(REGS_KEY);
}

export async function supabaseSetRegistrations(data: { registrations: unknown[] }): Promise<void> {
  await supabaseSet(REGS_KEY, data);
}

export async function supabaseFetchQuizzes(): Promise<SupabaseFetchResult<{ quizzes: unknown[] }>> {
  return supabaseFetch<{ quizzes: unknown[] }>(QUIZZES_KEY);
}

export async function supabaseSetQuizzes(data: { quizzes: unknown[] }): Promise<void> {
  await supabaseSet(QUIZZES_KEY, data);
}

export async function supabaseFetchQuizDecks(): Promise<SupabaseFetchResult<{ decks: unknown[] }>> {
  return supabaseFetch<{ decks: unknown[] }>(QUIZ_DECKS_KEY);
}

export async function supabaseSetQuizDecks(data: { decks: unknown[] }): Promise<void> {
  await supabaseSet(QUIZ_DECKS_KEY, data);
}

export async function supabaseFetchQuizLibrary(): Promise<SupabaseFetchResult<{ quizzes: unknown[] }>> {
  return supabaseFetch<{ quizzes: unknown[] }>(QUIZ_LIBRARY_KEY);
}

export async function supabaseSetQuizLibrary(data: { quizzes: unknown[] }): Promise<void> {
  await supabaseSet(QUIZ_LIBRARY_KEY, data);
}

export async function supabaseFetchQuizLibraryIndex(): Promise<
  SupabaseFetchResult<{ items: unknown[] }>
> {
  return supabaseFetch<{ items: unknown[] }>(QUIZ_LIBRARY_INDEX_KEY);
}

export async function supabaseSetQuizLibraryIndex(data: { items: unknown[] }): Promise<void> {
  await supabaseSet(QUIZ_LIBRARY_INDEX_KEY, data);
}

export async function supabaseFetchQuizLibraryItem(id: string): Promise<SupabaseFetchResult<unknown>> {
  return supabaseFetch(quizLibraryItemKey(id));
}

export async function supabaseSetQuizLibraryItem(id: string, value: unknown): Promise<void> {
  await supabaseSet(quizLibraryItemKey(id), value);
}

export async function supabaseDeleteQuizLibraryItem(id: string): Promise<void> {
  await supabaseDelete(quizLibraryItemKey(id));
}

export async function supabaseFetchPollConfigs(): Promise<SupabaseFetchResult<{ configs: unknown[] }>> {
  return supabaseFetch<{ configs: unknown[] }>(POLL_CONFIGS_KEY);
}

export async function supabaseSetPollConfigs(data: { configs: unknown[] }): Promise<void> {
  await supabaseSet(POLL_CONFIGS_KEY, data);
}

export async function supabaseFetchPollVotes(): Promise<SupabaseFetchResult<{ votes: unknown[] }>> {
  return supabaseFetch<{ votes: unknown[] }>(POLL_VOTES_KEY);
}

export async function supabaseSetPollVotes(data: { votes: unknown[] }): Promise<void> {
  await supabaseSet(POLL_VOTES_KEY, data);
}

export async function supabaseFetchEventLeague(slug: string): Promise<SupabaseFetchResult<EventLeagueData>> {
  return supabaseFetch<EventLeagueData>(eventLeagueKey(slug));
}

export async function supabaseSetEventLeague(slug: string, data: EventLeagueData): Promise<void> {
  await supabaseSet(eventLeagueKey(slug), data);
}

export async function supabaseUploadPublicImage(
  fileName: string,
  data: Buffer,
  contentType: string
): Promise<string> {
  const supabase = getSupabase();
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
  const objectPath = `events/${Date.now()}-${safeName}`;

  const { error } = await supabase.storage.from("uploads").upload(objectPath, data, {
    contentType,
    upsert: false,
  });
  if (error) throw new Error(`Supabase upload failed: ${error.message}`);

  const { data: publicUrl } = supabase.storage.from("uploads").getPublicUrl(objectPath);
  return publicUrl.publicUrl;
}

export function getSupabaseStorageDiagnostics() {
  return {
    configured: hasSupabaseStorage(),
    url: !!process.env.SUPABASE_URL,
    serviceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}
