/** Výsledok bez hotového kvízu z knižnice (projekcia v Canve). */
export const CANVAS_LIBRARY_QUIZ_ID = "__canvas__";

export function isCanvasLibraryQuiz(libraryQuizId?: string | null): boolean {
  return libraryQuizId === CANVAS_LIBRARY_QUIZ_ID;
}

/** Skutočný hotový kvíz z knižnice (nie Canva). */
export function isAssignedLibraryQuiz(libraryQuizId?: string | null): boolean {
  return Boolean(libraryQuizId?.trim() && !isCanvasLibraryQuiz(libraryQuizId));
}

export function normalizeResultLibraryQuizId(libraryQuizId?: string | null): string | undefined {
  const trimmed = libraryQuizId?.trim();
  if (!trimmed) return undefined;
  return trimmed;
}

export function libraryQuizAssignmentLabel(
  libraryQuizId: string | undefined,
  titleById?: Map<string, string> | Record<string, string>
): string {
  if (!libraryQuizId || isCanvasLibraryQuiz(libraryQuizId)) return "Kvíz v Canve";
  const title =
    titleById instanceof Map
      ? titleById.get(libraryQuizId)
      : titleById?.[libraryQuizId];
  return title ?? "Hotový kvíz z knižnice";
}
