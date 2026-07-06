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

export function rebuildLeagueTableFromResults(pastResults: PastResult[]): LeagueEntry[] {
  const table: LeagueEntry[] = [];
  for (const result of pastResults) {
    if (!result.teams?.length) continue;
    for (const team of result.teams) {
      const existing = table.find((row) => row.teamName === team.teamName);
      if (existing) {
        existing.points += team.ligaPoints;
        existing.quizzesPlayed += 1;
      } else {
        table.push({
          rank: 0,
          teamName: team.teamName,
          points: team.ligaPoints,
          quizzesPlayed: 1,
        });
      }
    }
  }
  return sortLeagueTable(table);
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
