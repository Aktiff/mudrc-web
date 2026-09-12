import type { QuizEvent } from "@/lib/data";
import type { QuizUsage } from "@/lib/quiz-library";
import { isAssignedLibraryQuiz } from "@/lib/quiz-result-library";
import { normalizeDateKey } from "@/lib/quiz-result-key";
import type { StoredQuiz } from "@/lib/storage";

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
      teamNames: stored.teams.map((team) => team.teamName),
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

export function getQuizUsages(
  libraryQuizId: string,
  storedQuizzes: StoredQuiz[],
  events: QuizEvent[]
): QuizUsage[] {
  return buildQuizUsageMap(storedQuizzes, events).get(libraryQuizId) ?? [];
}
