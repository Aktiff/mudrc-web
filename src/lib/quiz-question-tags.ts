import type { QuizQuestionItem } from "@/lib/quiz-library";
import type { QuizBankQuestion } from "@/lib/quiz-question-bank";

export function normalizeTags(raw: unknown): string[] | undefined {
  let parts: string[] = [];
  if (typeof raw === "string") {
    parts = raw.split(/[,;]+/);
  } else if (Array.isArray(raw)) {
    parts = raw.map((value) => (typeof value === "string" ? value : ""));
  } else {
    return undefined;
  }

  const tags = Array.from(
    new Set(parts.map((part) => part.trim().toLowerCase()).filter(Boolean))
  ).slice(0, 8);

  return tags.length ? tags : undefined;
}

export function parseTagsInput(raw: string): string[] | undefined {
  return normalizeTags(raw);
}

export function formatTagsInput(tags: string[] | undefined): string {
  return tags?.join(", ") ?? "";
}

export function isQuestionFilledForTags(question: QuizQuestionItem): boolean {
  return Boolean(question.body.trim() || question.answer.trim());
}

export function countTagUsageInQuestions(questions: QuizQuestionItem[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const question of questions) {
    if (!isQuestionFilledForTags(question)) continue;
    for (const tag of question.tags ?? []) {
      counts[tag] = (counts[tag] ?? 0) + 1;
    }
  }
  return counts;
}

/** Najvyšší počet použití medzi tagmi otázky — čím nižší, tým vhodnejšia pre kvíz. */
export function bankQuestionTagScore(
  item: QuizBankQuestion,
  tagCounts: Record<string, number>
): number {
  if (!item.tags?.length) return Number.MAX_SAFE_INTEGER;
  return Math.max(...item.tags.map((tag) => tagCounts[tag] ?? 0));
}

function bankQuestionUsedTagCount(item: QuizBankQuestion, tagCounts: Record<string, number>): number {
  return item.tags.filter((tag) => (tagCounts[tag] ?? 0) > 0).length;
}

function bankQuestionTagUsageSum(item: QuizBankQuestion, tagCounts: Record<string, number>): number {
  return item.tags.reduce((sum, tag) => sum + (tagCounts[tag] ?? 0), 0);
}

export function sortBankQuestionsByTagBalance(
  items: QuizBankQuestion[],
  tagCounts: Record<string, number>,
  options?: { prioritizeImageQuestions?: boolean }
): QuizBankQuestion[] {
  const sortGroup = (group: QuizBankQuestion[]) =>
    [...group].sort((a, b) => {
      const sumDiff = bankQuestionTagUsageSum(a, tagCounts) - bankQuestionTagUsageSum(b, tagCounts);
      if (sumDiff !== 0) return sumDiff;

      const scoreDiff = bankQuestionTagScore(a, tagCounts) - bankQuestionTagScore(b, tagCounts);
      if (scoreDiff !== 0) return scoreDiff;

      const overlapDiff =
        bankQuestionUsedTagCount(a, tagCounts) - bankQuestionUsedTagCount(b, tagCounts);
      if (overlapDiff !== 0) return overlapDiff;

      return a.body.localeCompare(b.body, "sk");
    });

  if (!options?.prioritizeImageQuestions) {
    return sortGroup(items);
  }

  const imageItems = items.filter((item) => item.isImageQuestion);
  const textItems = items.filter((item) => !item.isImageQuestion);
  return [...sortGroup(imageItems), ...sortGroup(textItems)];
}

export function filterBankQuestionsByTags(
  items: QuizBankQuestion[],
  excludedTags: string[]
): QuizBankQuestion[] {
  if (!excludedTags.length) return items;
  const excluded = new Set(excludedTags);
  return items.filter((item) => !item.tags?.some((tag) => excluded.has(tag)));
}

export function collectTagsFromBank(items: QuizBankQuestion[]): string[] {
  const tags = new Set<string>();
  for (const item of items) {
    for (const tag of item.tags ?? []) tags.add(tag);
  }
  return Array.from(tags).sort((a, b) => a.localeCompare(b, "sk"));
}

export function collectTagsFromQuestions(questions: QuizQuestionItem[]): string[] {
  const tags = new Set<string>();
  for (const question of questions) {
    for (const tag of question.tags ?? []) tags.add(tag);
  }
  return Array.from(tags).sort((a, b) => a.localeCompare(b, "sk"));
}
