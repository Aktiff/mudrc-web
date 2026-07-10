export type QuizEvent = {
  slug: string;
  venue: string;
  city: string;
  address: string;
  regionSlug?: string;
  date: string;
  time: string;
  entryFee: number;
  maxPlayers: number;
  minPlayers: number;
  rounds: number;
  questions: number;
  durationMinutes: number;
  active: boolean;
  leagueActive?: boolean;
  imageUrl?: string;
  rules?: string[];
  leagueTable: LeagueEntry[];
  pastResults: PastResult[];
};
export type LeagueEntry = { rank: number; teamName: string; points: number; quizzesPlayed: number };
export type PastResultTeam = { teamName: string; rounds: number[]; total: number; ligaPoints: number };
export type PastResult = { id: string; date: string; winnerTeam: string; points: number; teams?: PastResultTeam[] };

import eventsData from "@/data/events.json";
import { quizResultKey } from "@/lib/quiz-result-key";

export const events: QuizEvent[] = eventsData.events as QuizEvent[];

export function getEventBySlug(slug: string): QuizEvent | undefined {
  return events.find((e) => e.slug === slug);
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h} hod.`;
  return `${h} hod. ${m} min.`;
}

const SK_WEEKDAYS = ["nedeľa", "pondelok", "utorok", "streda", "štvrtok", "piatok", "sobota"] as const;

export function parseSkEventDateTime(date: string, time?: string): Date | null {
  const match = date.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  let hours = 0;
  let minutes = 0;
  if (time) {
    const timeMatch = time.trim().match(/^(\d{1,2}):(\d{2})$/);
    if (timeMatch) {
      hours = Number(timeMatch[1]);
      minutes = Number(timeMatch[2]);
    }
  }
  const parsed = new Date(Number(year), Number(month) - 1, Number(day), hours, minutes);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function sortEventsByDate(events: QuizEvent[]): QuizEvent[] {
  return [...events].sort((a, b) => {
    const dateA = parseSkEventDateTime(a.date, a.time)?.getTime() ?? Number.POSITIVE_INFINITY;
    const dateB = parseSkEventDateTime(b.date, b.time)?.getTime() ?? Number.POSITIVE_INFINITY;
    return dateA - dateB || a.venue.localeCompare(b.venue, "sk");
  });
}

export function formatSkWeekday(date: string): string | null {
  const match = date.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));
  if (Number.isNaN(parsed.getTime())) return null;
  return SK_WEEKDAYS[parsed.getDay()];
}

export function formatEventDateLabel(date: string): string {
  const weekday = formatSkWeekday(date);
  return weekday ? `${weekday} - ${date}` : date;
}

export function isQuizVisible(event: QuizEvent): boolean {
  return event.active !== false;
}

export function isLeagueActive(event: QuizEvent): boolean {
  return event.leagueActive !== false;
}

export function isLeagueVisible(event: QuizEvent): boolean {
  if (event.leagueActive === false) return false;
  return event.leagueTable.length > 0 || event.pastResults.length > 0;
}

export function sortLeagueTable(table: LeagueEntry[]): LeagueEntry[] {
  return [...table]
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.quizzesPlayed - a.quizzesPlayed ||
        a.teamName.localeCompare(b.teamName, "sk")
    )
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export function mergeLeagueTablesMax(a: LeagueEntry[], b: LeagueEntry[]): LeagueEntry[] {
  const map = new Map<string, LeagueEntry>();

  const upsert = (row: LeagueEntry) => {
    const name = row.teamName.trim();
    if (!name) return;
    const prev = map.get(name);
    if (!prev) {
      map.set(name, { ...row, teamName: name, rank: 0 });
      return;
    }
    map.set(name, {
      rank: 0,
      teamName: name,
      points: Math.max(prev.points, row.points),
      quizzesPlayed: Math.max(prev.quizzesPlayed, row.quizzesPlayed),
    });
  };

  for (const row of a) upsert(row);
  for (const row of b) upsert(row);
  return sortLeagueTable(Array.from(map.values()));
}

export function rebuildLeagueTableFromResults(
  pastResults: PastResult[],
  options?: { preserveFromTable?: LeagueEntry[] }
): LeagueEntry[] {
  const table: LeagueEntry[] = [];
  const detailedKeys = new Set<string>();

  const addContribution = (teamName: string, ligaPoints: number, quizzes = 1) => {
    const name = teamName.trim();
    if (!name) return;
    const existing = table.find((row) => row.teamName === name);
    if (existing) {
      existing.points += ligaPoints;
      existing.quizzesPlayed += quizzes;
      return;
    }
    table.push({
      rank: 0,
      teamName: name,
      points: ligaPoints,
      quizzesPlayed: quizzes,
    });
  };

  for (const result of pastResults) {
    if (!result.teams?.length) continue;
    detailedKeys.add(quizResultKey(result));
    for (const team of result.teams) {
      addContribution(team.teamName, team.ligaPoints, 1);
    }
  }

  const preserveFromTable = options?.preserveFromTable ?? [];
  for (const result of pastResults) {
    if (result.teams?.length) continue;
    const key = quizResultKey(result);
    if (detailedKeys.has(key)) continue;

    const winner = result.winnerTeam?.trim();
    if (!winner) continue;

    const preserved = preserveFromTable.find((row) => row.teamName === winner);
    const estimatedPoints =
      preserved && preserved.quizzesPlayed > 0
        ? preserved.points / preserved.quizzesPlayed
        : Math.max(0, preserveFromTable.filter((row) => row.quizzesPlayed > 0).length - 1);

    addContribution(winner, estimatedPoints, 1);
  }

  const rebuilt = sortLeagueTable(table);
  if (preserveFromTable.length === 0) return rebuilt;
  return mergeLeagueTablesMax(rebuilt, preserveFromTable);
}

export function getVisibleLeagues(events: QuizEvent[]): QuizEvent[] {
  return sortEventsByDate(events.filter(isLeagueVisible));
}

export function collectEventTeamNames(event: QuizEvent, extra: string[] = []): string[] {
  const names = new Set<string>();

  for (const entry of event.leagueTable ?? []) {
    const name = entry.teamName?.trim();
    if (name) names.add(name);
  }

  for (const result of event.pastResults ?? []) {
    const winner = result.winnerTeam?.trim();
    if (winner) names.add(winner);
    for (const team of result.teams ?? []) {
      const name = team.teamName?.trim();
      if (name) names.add(name);
    }
  }

  for (const name of extra) {
    const trimmed = name?.trim();
    if (trimmed) names.add(trimmed);
  }

  return Array.from(names).sort((a, b) => a.localeCompare(b, "sk"));
}
