export type QuizEvent = {
  slug: string;
  venue: string;
  city: string;
  address: string;
  date: string;
  time: string;
  entryFee: number;
  maxPlayers: number;
  minPlayers: number;
  rounds: number;
  questions: number;
  durationMinutes: number;
  active: boolean;
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

export function isLeagueVisible(event: QuizEvent): boolean {
  return (
    event.active === true &&
    (event.leagueTable.length > 0 || event.pastResults.length > 0)
  );
}

export function getVisibleLeagues(events: QuizEvent[]): QuizEvent[] {
  return events.filter(isLeagueVisible);
}
