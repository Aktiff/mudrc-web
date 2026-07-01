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
  return events.filter(isLeagueVisible);
}
