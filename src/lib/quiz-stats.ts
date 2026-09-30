import type { PastResult, PastResultTeam, QuizEvent } from "@/lib/data";
import { parseSkEventDateTime } from "@/lib/data";
import { findQuizResult, quizResultKey } from "@/lib/quiz-result-key";
import { estimatedEntryRevenue } from "@/lib/registration-utils";
import {
  deleteStoredQuiz,
  readAllEventsRaw,
  rebuildLeagueTableForEvent,
  updateEvents,
  upsertStoredQuiz,
} from "@/lib/storage";

export type QuizStatTeam = { teamName: string; players: number };

export type QuizStatRow = {
  key: string;
  slug: string;
  date: string;
  venue: string;
  city: string;
  entryFee: number;
  players: number;
  estimated: boolean;
  earned: number;
  teams: QuizStatTeam[];
};

export type QuizStatVenue = { slug: string; venue: string; city: string; entryFee: number };

function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 33 + seed.charCodeAt(i)) >>> 0;
  return hash;
}

export function suggestedTeamPlayers(teamName: string, quizSeed: string): number {
  return 3 + (hashSeed(`${quizSeed}|${teamName}`) % 3);
}

export function suggestedQuizPlayers(quizSeed: string): number {
  return 18 + (hashSeed(quizSeed) % 11);
}

function storedTeamPlayers(team: PastResultTeam): number {
  const n = Number(team.players);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

function clampTeamPlayers(value: unknown): number {
  const n = typeof value === "number" ? value : parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(99, Math.round(n));
}

export function quizStatFromResult(event: QuizEvent, result: PastResult): QuizStatRow {
  const key = quizResultKey(result);
  const seed = `${event.slug}|${key}`;
  const detailed = result.teams ?? [];
  const hasStoredTeamPlayers = detailed.some((team) => storedTeamPlayers(team) > 0);
  const storedTotal =
    typeof result.playerCount === "number" && result.playerCount > 0 ? Math.round(result.playerCount) : 0;

  let players = 0;
  let estimated = false;
  let teams: QuizStatTeam[] = [];

  if (hasStoredTeamPlayers) {
    teams = detailed.map((team) => ({ teamName: team.teamName, players: storedTeamPlayers(team) }));
    players = teams.reduce((sum, team) => sum + team.players, 0);
  } else if (storedTotal > 0 && detailed.length === 0) {
    players = storedTotal;
  } else if (detailed.length > 0) {
    estimated = true;
    teams = detailed.map((team) => ({
      teamName: team.teamName,
      players: suggestedTeamPlayers(team.teamName, seed),
    }));
    players = teams.reduce((sum, team) => sum + team.players, 0);
  } else {
    estimated = true;
    players = suggestedQuizPlayers(seed);
  }

  return {
    key,
    slug: event.slug,
    date: result.date,
    venue: event.venue,
    city: event.city,
    entryFee: Number(event.entryFee) || 0,
    players,
    estimated,
    earned: estimatedEntryRevenue(event.entryFee, players),
    teams,
  };
}

export async function listQuizStatistics(): Promise<{ rows: QuizStatRow[]; venues: QuizStatVenue[] }> {
  const { events } = await readAllEventsRaw();
  const rows = events.flatMap((event) =>
    (event.pastResults ?? []).map((result) => quizStatFromResult(event, result))
  );
  rows.sort((a, b) => {
    const ta = parseSkEventDateTime(a.date)?.getTime() ?? 0;
    const tb = parseSkEventDateTime(b.date)?.getTime() ?? 0;
    return tb - ta || a.venue.localeCompare(b.venue, "sk");
  });
  const venues = events
    .map((event) => ({
      slug: event.slug,
      venue: event.venue,
      city: event.city,
      entryFee: Number(event.entryFee) || 0,
    }))
    .sort((a, b) => a.venue.localeCompare(b.venue, "sk") || a.city.localeCompare(b.city, "sk"));
  return { rows, venues };
}

async function rebuildLeague(slug: string) {
  const { events } = await readAllEventsRaw();
  const event = events.find((entry) => entry.slug === slug);
  if (!event) return;
  const rebuilt = await rebuildLeagueTableForEvent(event);
  if (rebuilt.leagueTable.length === 0) return;
  await updateEvents((all) =>
    all.map((entry) =>
      entry.slug === slug
        ? { ...entry, leagueTable: rebuilt.leagueTable, pastResults: rebuilt.pastResults, leagueActive: true }
        : entry
    )
  );
}

export async function updateQuizStatistic(input: {
  slug: string;
  quizKey: string;
  date: string;
  targetSlug: string;
  playerCount: number;
  teams?: { teamName: string; players: number }[];
}) {
  const { events } = await readAllEventsRaw();
  const source = events.find((event) => event.slug === input.slug);
  const result = source ? findQuizResult(source.pastResults ?? [], input.quizKey) : undefined;
  const target = events.find((event) => event.slug === input.targetSlug);
  if (!source || !result || !target) throw new Error("NOT_FOUND");

  const date = input.date.trim();
  if (!/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(date)) throw new Error("Dátum zadaj ako deň.mesiac.rok");

  let teams = result.teams;
  if (teams?.length && input.teams?.length) {
    const byName = new Map(
      input.teams.map((team) => [team.teamName.trim().toLowerCase(), clampTeamPlayers(team.players)])
    );
    teams = teams.map((team) => {
      const players = byName.get(team.teamName.trim().toLowerCase()) ?? 0;
      if (players > 0) return { ...team, players };
      const next = { ...team };
      delete next.players;
      return next;
    });
  }

  const fromTeams = (teams ?? []).reduce((sum, team) => sum + (team.players ?? 0), 0);
  const playerCount = fromTeams > 0 ? fromTeams : clampTeamPlayers(input.playerCount);
  const updated: PastResult = {
    ...result,
    id: result.id || quizResultKey(result),
    date,
    teams,
    ...(playerCount > 0 ? { playerCount } : {}),
  };
  if (playerCount <= 0) delete updated.playerCount;

  const moving = input.targetSlug !== input.slug;
  const sourceKey = quizResultKey(result);
  if (moving) await deleteStoredQuiz(input.slug, input.quizKey);
  if ((updated.teams?.length ?? 0) > 0) {
    await upsertStoredQuiz({
      id: quizResultKey(updated),
      eventSlug: input.targetSlug,
      date: updated.date,
      winnerTeam: updated.winnerTeam,
      points: updated.points,
      teams: updated.teams ?? [],
      libraryQuizId: updated.libraryQuizId,
    });
  }

  await updateEvents((list) =>
    list.map((event) => {
      if (event.slug !== input.slug && event.slug !== input.targetSlug) return event;
      let pastResults = event.pastResults ?? [];
      if (event.slug === input.slug) {
        pastResults = pastResults.filter((entry) => quizResultKey(entry) !== sourceKey);
      }
      if (event.slug === input.targetSlug) {
        pastResults = [...pastResults.filter((entry) => quizResultKey(entry) !== sourceKey), updated];
      }
      return { ...event, pastResults };
    })
  );

  if (moving && (result.teams?.length ?? 0) > 0) {
    await rebuildLeague(input.slug);
    await rebuildLeague(input.targetSlug);
  }
}

export async function deleteQuizStatistic(slug: string, quizKey: string) {
  const { events } = await readAllEventsRaw();
  const event = events.find((entry) => entry.slug === slug);
  const result = event ? findQuizResult(event.pastResults ?? [], quizKey) : undefined;
  if (!event || !result) throw new Error("NOT_FOUND");

  const hadTeams = (result.teams?.length ?? 0) > 0;
  await deleteStoredQuiz(slug, quizKey);
  const sourceKey = quizResultKey(result);
  await updateEvents(
    (list) =>
      list.map((entry) =>
        entry.slug === slug
          ? {
              ...entry,
              pastResults: (entry.pastResults ?? []).filter((item) => quizResultKey(item) !== sourceKey),
            }
          : entry
      ),
    { destructive: true }
  );

  if (hadTeams) await rebuildLeague(slug);
}
