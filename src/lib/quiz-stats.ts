import type { PastResult, PastResultTeam, QuizEvent } from "@/lib/data";
import { parseSkEventDateTime } from "@/lib/data";
import { findQuizResult, quizResultKey } from "@/lib/quiz-result-key";
import { estimatedEntryRevenue } from "@/lib/registration-utils";
import { quizTypeOrDefault } from "@/lib/quiz-type";
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
  quizType: string;
  players: number;
  estimated: boolean;
  earned: number;
  teams: QuizStatTeam[];
};

export type QuizStatVenue = { slug: string; venue: string; city: string; entryFee: number };

export type TeamQuizAppearance = {
  id: string;
  teamName: string;
  date: string;
  venue: string;
  city: string;
  quizType: string;
  players: number;
  playersEstimated: boolean;
  place: number;
  teamCount: number;
};

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
    quizType: quizTypeOrDefault(result.quizType),
    players,
    estimated,
    earned: estimatedEntryRevenue(event.entryFee, players),
    teams,
  };
}

function placesForTeams(teams: PastResultTeam[]): Map<string, number> {
  const sorted = teams
    .map((team) => ({ name: team.teamName.trim(), total: Number(team.total) || 0 }))
    .filter((team) => team.name)
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "sk"));
  const places = new Map<string, number>();
  let lastTotal = Number.NaN;
  let lastPlace = 0;
  sorted.forEach((team, index) => {
    const place = team.total === lastTotal ? lastPlace : index + 1;
    lastTotal = team.total;
    lastPlace = place;
    const key = team.name.toLocaleLowerCase("sk");
    if (!places.has(key)) places.set(key, place);
  });
  return places;
}

export function teamAppearancesFromEvents(events: QuizEvent[]): TeamQuizAppearance[] {
  const rows: TeamQuizAppearance[] = [];
  for (const event of events) {
    for (const result of event.pastResults ?? []) {
      const detailed = (result.teams ?? []).filter((team) => team.teamName.trim());
      if (!detailed.length) continue;
      const quizKey = quizResultKey(result);
      const seed = `${event.slug}|${quizKey}`;
      const places = placesForTeams(detailed);
      detailed.forEach((team, index) => {
        const teamName = team.teamName.trim();
        const stored = storedTeamPlayers(team);
        rows.push({
          id: `${event.slug}|${quizKey}|${index}|${teamName.toLocaleLowerCase("sk")}`,
          teamName,
          date: result.date,
          venue: event.venue,
          city: event.city,
          quizType: quizTypeOrDefault(result.quizType),
          players: stored > 0 ? stored : suggestedTeamPlayers(teamName, seed),
          playersEstimated: stored <= 0,
          place: places.get(teamName.toLocaleLowerCase("sk")) ?? index + 1,
          teamCount: detailed.length,
        });
      });
    }
  }
  rows.sort((a, b) => {
    const byName = a.teamName.localeCompare(b.teamName, "sk");
    if (byName !== 0) return byName;
    const ta = parseSkEventDateTime(a.date)?.getTime() ?? 0;
    const tb = parseSkEventDateTime(b.date)?.getTime() ?? 0;
    return tb - ta || a.venue.localeCompare(b.venue, "sk");
  });
  return rows;
}

export async function listQuizStatistics(): Promise<{
  rows: QuizStatRow[];
  venues: QuizStatVenue[];
  teams: TeamQuizAppearance[];
}> {
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
  return { rows, venues, teams: teamAppearancesFromEvents(events) };
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
  quizType?: string;
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
    quizType: quizTypeOrDefault(input.quizType ?? result.quizType),
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
      quizType: updated.quizType,
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
