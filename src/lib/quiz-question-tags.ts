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

export function bankQuestionTagScore(
  item: QuizBankQuestion,
  tagCounts: Record<string, number>
): number {
  if (!item.tags?.length) return Number.MAX_SAFE_INTEGER;
  return Math.min(...item.tags.map((tag) => tagCounts[tag] ?? 0));
}

export function sortBankQuestionsByTagBalance(
  items: QuizBankQuestion[],
  tagCounts: Record<string, number>
): QuizBankQuestion[] {
  return [...items].sort((a, b) => {
    const scoreDiff = bankQuestionTagScore(a, tagCounts) - bankQuestionTagScore(b, tagCounts);
    if (scoreDiff !== 0) return scoreDiff;
    return a.body.localeCompare(b.body, "sk");
  });
}

export function filterBankQuestionsByTags(
  items: QuizBankQuestion[],
  selectedTags: string[]
): QuizBankQuestion[] {
  if (!selectedTags.length) return items;
  const selected = new Set(selectedTags);
  return items.filter((item) => item.tags?.some((tag) => selected.has(tag)));
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
