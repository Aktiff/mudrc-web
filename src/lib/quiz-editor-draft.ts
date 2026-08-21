import type { QuizLibraryItem } from "@/lib/quiz-library";

const draftStorageKey = (id: string) => `mudrc-quiz-draft-${id}`;

export function parseQuizPayload(data: unknown): QuizLibraryItem {
  if (!data || typeof data !== "object") {
    throw new Error("Neplatná odpoveď servera.");
  }
  const quiz = { ...(data as QuizLibraryItem & Record<string, unknown>) };
  delete quiz.usages;
  delete quiz.usageCount;
  delete quiz.playedTeamNames;
  return quiz as QuizLibraryItem;
}

export function readQuizDraft(quizId: string): QuizLibraryItem | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(draftStorageKey(quizId));
    if (!raw) return null;
    return parseQuizPayload(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeQuizDraft(quiz: QuizLibraryItem): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(draftStorageKey(quiz.id), JSON.stringify(quiz));
  } catch {
    /* sessionStorage plné alebo nedostupné */
  }
}

export function clearQuizDraft(quizId: string): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(draftStorageKey(quizId));
}
