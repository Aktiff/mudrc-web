import { normalizeLibraryQuiz, type QuizLibraryItem } from "@/lib/quiz-library";

const draftStorageKey = (id: string) => `mudrc-quiz-draft-${id}`;
const localBackupKey = (id: string) => `mudrc-quiz-backup-${id}`;

export function parseQuizPayload(data: unknown): QuizLibraryItem {
  if (!data || typeof data !== "object") {
    throw new Error("Neplatná odpoveď servera.");
  }
  const raw = { ...(data as QuizLibraryItem & Record<string, unknown>) };
  delete raw.usages;
  delete raw.usageCount;
  delete raw.playedTeamNames;
  return normalizeLibraryQuiz(raw);
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
    const json = JSON.stringify(quiz);
    window.sessionStorage.setItem(draftStorageKey(quiz.id), json);
    window.localStorage.setItem(localBackupKey(quiz.id), json);
  } catch {
    /* sessionStorage plné alebo nedostupné */
  }
}

export function readQuizLocalBackup(quizId: string): QuizLibraryItem | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(localBackupKey(quizId));
    if (!raw) return null;
    return parseQuizPayload(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function clearQuizDraft(quizId: string): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(draftStorageKey(quizId));
}
