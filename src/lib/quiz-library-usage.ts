import type { PastResultTeam, QuizEvent } from "@/lib/data";
import type { QuizUsage } from "@/lib/quiz-library";
import { isAssignedLibraryQuiz } from "@/lib/quiz-result-library";
import { normalizeDateKey } from "@/lib/quiz-result-key";
import { teamKey } from "@/lib/poll";
import type { StoredQuiz } from "@/lib/storage";

export function normalizeGuestTeams(hostName: string, names: unknown): string[] {
  const host = teamKey(hostName);
  const seen = new Set<string>();
  const out: string[] = [];
  const list = Array.isArray(names) ? names : [];
  for (const raw of list) {
    const name = String(raw ?? "").trim();
    const key = teamKey(name);
    if (!name || !key || key === host || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

function usageTeamNames(teams: PastResultTeam[]): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const team of teams) {
    const guests = normalizeGuestTeams(team.teamName, team.guestTeams);
    for (const name of [team.teamName, ...guests]) {
      const trimmed = name.trim();
      const key = teamKey(trimmed);
      if (!trimmed || !key || seen.has(key)) continue;
      seen.add(key);
      names.push(trimmed);
    }
  }
  return names;
}

export type QuizUsageExclude = { eventSlug: string; quizResultId: string };

function storedMatchesUsageExclude(stored: StoredQuiz, exclude: QuizUsageExclude): boolean {
  const key = normalizeDateKey(exclude.quizResultId);
  return (
    stored.eventSlug === exclude.eventSlug &&
    (stored.id === exclude.quizResultId ||
      stored.id === key ||
      normalizeDateKey(stored.date) === key ||
      stored.date.trim() === exclude.quizResultId.trim())
  );
}

function parseUsageDate(date: string): number {
  const match = date.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!match) return 0;
  const [, day, month, year] = match;
  return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
}

export function buildQuizUsageMap(
  storedQuizzes: StoredQuiz[],
  events: QuizEvent[],
  excludeUsage?: QuizUsageExclude | null
): Map<string, QuizUsage[]> {
  const eventMap = new Map(events.map((event) => [event.slug, event]));
  const byLibrary = new Map<string, QuizUsage[]>();

  for (const stored of storedQuizzes) {
    if (excludeUsage && storedMatchesUsageExclude(stored, excludeUsage)) continue;
    const libraryQuizId = stored.libraryQuizId?.trim();
    if (!libraryQuizId || !isAssignedLibraryQuiz(libraryQuizId)) continue;
    const event = eventMap.get(stored.eventSlug);
    const usage: QuizUsage = {
      eventSlug: stored.eventSlug,
      venue: event?.venue ?? stored.eventSlug,
      city: event?.city ?? "",
      date: stored.date,
      quizResultId: stored.id,
      winnerTeam: stored.winnerTeam,
      teamNames: usageTeamNames(stored.teams),
    };
    const list = byLibrary.get(libraryQuizId) ?? [];
    list.push(usage);
    byLibrary.set(libraryQuizId, list);
  }

  for (const id of Array.from(byLibrary.keys())) {
    const usages = byLibrary.get(id)!;
    usages.sort((a: QuizUsage, b: QuizUsage) => parseUsageDate(b.date) - parseUsageDate(a.date));
    byLibrary.set(id, usages);
  }

  return byLibrary;
}

/** „Lili café - 15.9., Alipub - 17.9.“ od najstaršieho večera. */
export function formatQuizUsagePlaces(usages: Pick<QuizUsage, "venue" | "date">[]): string {
  const sorted = [...usages].sort((a, b) => parseUsageDate(a.date) - parseUsageDate(b.date));
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const usage of sorted) {
    const venue = usage.venue.trim();
    const match = usage.date.trim().match(/^(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?$/);
    const day = match ? `${Number(match[1])}.${Number(match[2])}.` : usage.date.trim();
    if (!venue || !day) continue;
    const line = `${venue} - ${day}`;
    if (seen.has(line)) continue;
    seen.add(line);
    parts.push(line);
  }
  return parts.join(", ");
}

export function getQuizUsages(
  libraryQuizId: string,
  storedQuizzes: StoredQuiz[],
  events: QuizEvent[]
): QuizUsage[] {
  return buildQuizUsageMap(storedQuizzes, events).get(libraryQuizId) ?? [];
}
