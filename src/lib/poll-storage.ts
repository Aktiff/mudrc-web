import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import {
  buildPollPublicData,
  canonicalPollOption,
  createPollConfigForEvent,
  filterUpcomingPollOptions,
  getDefaultPollConfig,
  normalizePollDateLabel,
  normalizePollOptions,
  normalizePollVote,
  normalizeTeamName,
  pollOptionsMatch,
  sortPollOptions,
  teamKey,
  type LegacyPollVote,
  type PollConfig,
  type PollPublicData,
  type PollVote,
} from "@/lib/poll";
import { readAppStorageBlob, writeAppStorageBlob } from "@/lib/blob-app-storage";
import { readEvents, shouldWriteBlob } from "@/lib/storage";

const pollVotesPath = path.join(process.cwd(), "src/data/poll-votes.json");
const pollVotesLocalPath = path.join(process.cwd(), "src/data/poll-votes.local.json");
const pollConfigsPath = path.join(process.cwd(), "src/data/poll-configs.json");
const pollConfigsLocalPath = path.join(process.cwd(), "src/data/poll-configs.local.json");
const isVercel = !!process.env.VERCEL;

export type PollAdminData = {
  config: PollConfig | null;
  storedInDatabase: boolean;
  storage: "blob" | "local" | "unconfigured";
  votes: PollVote[];
  teamCount: number;
  upcomingOptions: string[];
  configOptions: string[];
  publicVisible: boolean;
};

function requirePollStorage(): void {
  if (isVercel && !shouldWriteBlob()) {
    throw new Error("STORAGE_NOT_CONFIGURED");
  }
}

function normalizeStoredConfig(config: PollConfig): PollConfig {
  return {
    ...config,
    options: normalizePollOptions(config.options),
  };
}

function readLocalPollVotes(): PollVote[] {
  try {
    const file = fs.existsSync(pollVotesLocalPath) ? pollVotesLocalPath : pollVotesPath;
    if (!fs.existsSync(file)) return [];
    let raw = fs.readFileSync(file, "utf-8");
    if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
    const data = JSON.parse(raw) as { votes?: LegacyPollVote[] };
    return (data.votes ?? []).map(normalizePollVote);
  } catch {
    return [];
  }
}

function writeLocalPollVotes(votes: PollVote[]) {
  fs.writeFileSync(pollVotesLocalPath, JSON.stringify({ votes }, null, 2), "utf-8");
}

function readLocalPollConfigs(): PollConfig[] {
  try {
    const file = fs.existsSync(pollConfigsLocalPath) ? pollConfigsLocalPath : pollConfigsPath;
    if (!fs.existsSync(file)) return [];
    let raw = fs.readFileSync(file, "utf-8");
    if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
    const data = JSON.parse(raw) as { configs?: PollConfig[] };
    return (data.configs ?? []).map(normalizeStoredConfig);
  } catch {
    return [];
  }
}

function writeLocalPollConfigs(configs: PollConfig[]) {
  fs.writeFileSync(pollConfigsLocalPath, JSON.stringify({ configs }, null, 2), "utf-8");
}

function getPollStorageMode(): PollAdminData["storage"] {
  if (shouldWriteBlob()) return "blob";
  if (isVercel) return "unconfigured";
  return "local";
}

async function loadStoredPollConfigs(): Promise<PollConfig[]> {
  const fromBlob = await readAppStorageBlob<{ configs?: PollConfig[] }>("poll-configs");
  if (fromBlob?.configs) return fromBlob.configs.map(normalizeStoredConfig);
  return readLocalPollConfigs();
}

async function persistPollConfigs(
  configs: PollConfig[],
  options: { requireWritable?: boolean } = {}
): Promise<void> {
  const requireWritable = options.requireWritable !== false;
  const normalized = configs.map(normalizeStoredConfig);

  if (shouldWriteBlob()) {
    await writeAppStorageBlob("poll-configs", { configs: normalized });
    return;
  }

  if (isVercel) {
    if (requireWritable) requirePollStorage();
    console.warn("Poll configs not persisted (Vercel without Blob).");
    return;
  }

  writeLocalPollConfigs(normalized);
}

async function loadPollVotes(): Promise<PollVote[]> {
  const fromBlob = await readAppStorageBlob<{ votes?: LegacyPollVote[] }>("poll-votes");
  if (fromBlob?.votes) return fromBlob.votes.map(normalizePollVote);
  return readLocalPollVotes();
}

async function persistPollVotes(votes: PollVote[]): Promise<void> {
  requirePollStorage();
  const normalized = votes.map(normalizePollVote);
  if (shouldWriteBlob()) {
    await writeAppStorageBlob("poll-votes", { votes: normalized });
    return;
  }
  writeLocalPollVotes(normalized);
}

async function savePollConfig(
  config: PollConfig,
  options: { requireWritable?: boolean } = {}
): Promise<PollConfig> {
  const normalized = normalizeStoredConfig(config);
  const current = await loadStoredPollConfigs();
  const idx = current.findIndex((entry) => entry.eventSlug === normalized.eventSlug);
  const next = idx === -1 ? [...current, normalized] : current.map((entry, i) => (i === idx ? normalized : entry));
  await persistPollConfigs(next, options);
  return normalized;
}

async function resolveVenue(eventSlug: string, fallbackVenue?: string): Promise<string> {
  if (fallbackVenue?.trim()) return fallbackVenue.trim();
  const { events } = await readEvents();
  return events.find((event) => event.slug === eventSlug)?.venue ?? eventSlug;
}

/** Zapíše default/code config do Blob, ak ešte neexistuje — len pre podniky s defaultom v kóde. */
async function ensurePollConfigPersisted(eventSlug: string, venue?: string): Promise<PollConfig | null> {
  const stored = (await loadStoredPollConfigs()).find((entry) => entry.eventSlug === eventSlug);
  if (stored) return stored;

  const defaultConfig = getDefaultPollConfig(eventSlug);
  if (!defaultConfig) return null;

  const resolvedVenue = await resolveVenue(eventSlug, venue ?? defaultConfig.venue);
  const config = normalizeStoredConfig({ ...defaultConfig, venue: resolvedVenue });
  try {
    await savePollConfig(config, { requireWritable: false });
  } catch (error) {
    console.error("Poll config auto-seed failed:", error);
  }
  return config;
}

async function loadPollConfig(eventSlug: string, venue?: string): Promise<PollConfig | null> {
  const stored = (await loadStoredPollConfigs()).find((entry) => entry.eventSlug === eventSlug);
  if (stored) return stored;

  const defaultConfig = getDefaultPollConfig(eventSlug);
  if (defaultConfig) {
    const resolvedVenue = await resolveVenue(eventSlug, venue ?? defaultConfig.venue);
    return normalizeStoredConfig({ ...defaultConfig, venue: resolvedVenue });
  }

  if (venue) {
    return normalizeStoredConfig(createPollConfigForEvent(eventSlug, venue, false));
  }

  return null;
}

export async function getPollPublicData(eventSlug: string, venue?: string): Promise<PollPublicData | null> {
  const resolvedVenue = venue ?? (await resolveVenue(eventSlug));
  await ensurePollConfigPersisted(eventSlug, resolvedVenue);
  const config = await loadPollConfig(eventSlug, resolvedVenue);
  if (!config || !config.active) return null;

  const votes = (await loadPollVotes()).filter((vote) => vote.eventSlug === eventSlug);
  const data = buildPollPublicData(config, votes);
  if (data.config.options.length === 0) return null;
  return data;
}

export async function getPollAdminData(eventSlug: string, venue?: string): Promise<PollAdminData> {
  const resolvedVenue = venue ? await resolveVenue(eventSlug, venue) : await resolveVenue(eventSlug);
  await ensurePollConfigPersisted(eventSlug, resolvedVenue);
  const stored = (await loadStoredPollConfigs()).find((entry) => entry.eventSlug === eventSlug);
  const defaultConfig = getDefaultPollConfig(eventSlug);
  const config =
    stored ??
    (defaultConfig
      ? normalizeStoredConfig({ ...defaultConfig, venue: resolvedVenue })
      : null);
  const votes = (await loadPollVotes())
    .filter((vote) => vote.eventSlug === eventSlug)
    .map(normalizePollVote)
    .sort((a, b) => a.teamName.localeCompare(b.teamName, "sk"));

  const configOptions = config ? normalizePollOptions(config.options) : [];
  const upcomingOptions = config ? filterUpcomingPollOptions(configOptions) : [];
  const publicVisible = !!(config?.active && upcomingOptions.length > 0);

  return {
    config: config ?? null,
    storedInDatabase: !!stored,
    storage: getPollStorageMode(),
    votes,
    teamCount: votes.length,
    upcomingOptions,
    configOptions,
    publicVisible,
  };
}

export async function getPollActiveFlagsBySlug(slugs: string[]): Promise<Record<string, boolean>> {
  const stored = await loadStoredPollConfigs();
  const storedBySlug = new Map(stored.map((entry) => [entry.eventSlug, entry]));
  const flags: Record<string, boolean> = {};

  for (const slug of slugs) {
    const storedConfig = storedBySlug.get(slug);
    if (storedConfig) {
      flags[slug] = storedConfig.active;
      continue;
    }
    const defaultConfig = getDefaultPollConfig(slug);
    flags[slug] = defaultConfig?.active ?? false;
  }

  return flags;
}

export async function setPollActive(eventSlug: string, venue: string, active: boolean): Promise<PollConfig> {
  requirePollStorage();
  const existing = (await loadStoredPollConfigs()).find((entry) => entry.eventSlug === eventSlug);
  const resolvedVenue = await resolveVenue(eventSlug, venue);
  const config = existing
    ? normalizeStoredConfig({
        ...existing,
        venue: resolvedVenue,
        active,
        options: normalizePollOptions(existing.options),
      })
    : normalizeStoredConfig(createPollConfigForEvent(eventSlug, resolvedVenue, active));
  return savePollConfig(config);
}

async function prunePollVotesForEvent(eventSlug: string, options: string[]): Promise<void> {
  const allowed = filterUpcomingPollOptions(normalizePollOptions(options));
  const current = await loadPollVotes();
  let changed = false;

  const next = current.flatMap((vote) => {
    if (vote.eventSlug !== eventSlug) return [vote];

    const filteredDates = sortPollOptions(
      vote.optionDates
        .map((date) => canonicalPollOption(date, allowed))
        .filter((date): date is string => !!date)
    );

    if (
      filteredDates.length === vote.optionDates.length &&
      filteredDates.every((date, index) => pollOptionsMatch(date, vote.optionDates[index] ?? ""))
    ) {
      return [vote];
    }

    changed = true;
    if (filteredDates.length === 0) return [];
    return [{ ...vote, optionDates: filteredDates }];
  });

  if (changed) await persistPollVotes(next);
}

export async function setPollOptions(eventSlug: string, venue: string, options: string[]): Promise<PollConfig> {
  requirePollStorage();
  const existing = (await loadStoredPollConfigs()).find((entry) => entry.eventSlug === eventSlug);
  const resolvedVenue = await resolveVenue(eventSlug, venue);
  const normalizedOptions = normalizePollOptions(options);
  const config = existing
    ? normalizeStoredConfig({ ...existing, venue: resolvedVenue, options: normalizedOptions, active: existing.active })
    : normalizeStoredConfig({
        ...createPollConfigForEvent(eventSlug, resolvedVenue, normalizedOptions.length > 0),
        options: normalizedOptions,
      });
  const saved = await savePollConfig(config);
  await prunePollVotesForEvent(eventSlug, normalizedOptions);
  return saved;
}

export async function resetPollVotes(eventSlug: string, venue?: string): Promise<number> {
  requirePollStorage();
  const configsBefore = await loadStoredPollConfigs();
  const existingConfig = configsBefore.find((entry) => entry.eventSlug === eventSlug);

  for (let attempt = 0; attempt < 5; attempt++) {
    const current = await loadPollVotes();
    const next = current.filter((vote) => vote.eventSlug !== eventSlug);
    const removed = current.length - next.length;
    if (removed === 0) {
      if (existingConfig) await savePollConfig(existingConfig);
      return 0;
    }

    try {
      await persistPollVotes(next);
      if (existingConfig) await savePollConfig(existingConfig);
      return removed;
    } catch (error) {
      if (attempt === 4) throw error;
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }

  return 0;
}

export async function deletePollDataForEvent(eventSlug: string): Promise<void> {
  const configs = (await loadStoredPollConfigs()).filter((entry) => entry.eventSlug !== eventSlug);
  await persistPollConfigs(configs);
  const votes = (await loadPollVotes()).filter((vote) => vote.eventSlug !== eventSlug);
  await persistPollVotes(votes);
}

export async function deletePollTeamVote(eventSlug: string, voteId: string): Promise<boolean> {
  requirePollStorage();
  const trimmedId = voteId.trim();
  if (!trimmedId) return false;

  for (let attempt = 0; attempt < 5; attempt++) {
    const current = await loadPollVotes();
    const target = current.find((vote) => vote.id === trimmedId && vote.eventSlug === eventSlug);
    if (!target) return false;

    const next = current.filter(
      (vote) => !(vote.id === trimmedId && vote.eventSlug === eventSlug)
    );
    if (next.length !== current.length - 1) {
      if (attempt === 4) throw new Error("DELETE_COUNT_MISMATCH");
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
      continue;
    }
    try {
      await persistPollVotes(next);
      return true;
    } catch (error) {
      if (attempt === 4) throw error;
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }

  return false;
}

/** @deprecated Použi deletePollTeamVote s voteId. */
export async function deletePollTeamVoteByName(eventSlug: string, teamName: string): Promise<boolean> {
  const key = teamKey(teamName);
  const current = await loadPollVotes();
  const target = current.find((vote) => vote.eventSlug === eventSlug && teamKey(vote.teamName) === key);
  if (!target) return false;
  return deletePollTeamVote(eventSlug, target.id);
}

export async function upsertPollVote(input: {
  eventSlug: string;
  teamName: string;
  optionDates: string[];
}): Promise<PollVote> {
  requirePollStorage();
  const venue = await resolveVenue(input.eventSlug);
  await ensurePollConfigPersisted(input.eventSlug, venue);

  const config = await loadPollConfig(input.eventSlug, venue);
  if (!config || !config.active) throw new Error("POLL_INACTIVE");

  const availableOptions = filterUpcomingPollOptions(normalizePollOptions(config.options));
  const requestedDates = sortPollOptions(
    Array.from(new Set(input.optionDates.map((date) => normalizePollDateLabel(date)).filter(Boolean)))
  );

  if (requestedDates.length === 0) throw new Error("NO_OPTIONS");

  const uniqueDates = requestedDates
    .map((date) => canonicalPollOption(date, availableOptions))
    .filter((date): date is string => !!date);

  if (uniqueDates.length !== requestedDates.length) throw new Error("INVALID_OPTION");

  const normalizedTeam = normalizeTeamName(input.teamName);
  if (!normalizedTeam) throw new Error("INVALID_TEAM");

  const key = teamKey(normalizedTeam);
  const now = new Date().toLocaleString("sk-SK", { timeZone: "Europe/Bratislava" });

  for (let attempt = 0; attempt < 5; attempt++) {
    const current = await loadPollVotes();
    const existing = current.find(
      (vote) => vote.eventSlug === input.eventSlug && teamKey(vote.teamName) === key
    );

    const nextVote: PollVote = existing
      ? { ...existing, teamName: normalizedTeam, optionDates: uniqueDates, updatedAt: now }
      : {
          id: randomUUID(),
          eventSlug: input.eventSlug,
          teamName: normalizedTeam,
          optionDates: uniqueDates,
          createdAt: now,
          updatedAt: now,
        };

    const next = existing
      ? current.map((vote) => (vote.id === existing.id ? nextVote : vote))
      : [...current, nextVote];

    try {
      await persistPollVotes(next);
      return nextVote;
    } catch (error) {
      if (attempt === 4) throw error;
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }

  throw new Error("VOTE_FAILED");
}

export async function isPollActive(eventSlug: string, venue?: string): Promise<boolean> {
  try {
    const resolvedVenue = venue ?? (await resolveVenue(eventSlug));
    const config = await loadPollConfig(eventSlug, resolvedVenue);
    if (!config?.active) return false;
    return filterUpcomingPollOptions(normalizePollOptions(config.options)).length > 0;
  } catch (error) {
    console.error("isPollActive failed:", error);
    return false;
  }
}

export async function getPollStorageSummary() {
  const configs = await loadStoredPollConfigs();
  const votes = await loadPollVotes();
  return {
    mode: getPollStorageMode(),
    blobConfigured: shouldWriteBlob(),
    configsInDatabase: configs.length,
    votesInDatabase: votes.length,
    configsMissing: configs.length === 0,
    votesMissing: votes.length === 0,
  };
}
