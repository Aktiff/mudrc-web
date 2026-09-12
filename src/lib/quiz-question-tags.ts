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

/** Váhy tagov pre banku — celý kvíz + zvýraznenie aktuálneho kola a susedných slotov. */
export function buildBankTagWeightMap(
  allQuizQuestions: QuizQuestionItem[],
  roundQuestions: QuizQuestionItem[],
  targetQuestionId?: string
): Record<string, number> {
  const weights = countTagUsageInQuestions(allQuizQuestions);

  for (const [tag, count] of Object.entries(countTagUsageInQuestions(roundQuestions))) {
    weights[tag] = (weights[tag] ?? 0) + count * 3;
  }

  if (!targetQuestionId) return weights;

  const target = roundQuestions.find((q) => q.id === targetQuestionId && q.kind !== "music");
  if (!target) return weights;

  const slot = target.questionNumber;
  const nearby = roundQuestions.filter(
    (q) =>
      q.kind !== "music" &&
      isQuestionFilledForTags(q) &&
      Math.abs(q.questionNumber - slot) <= 2
  );

  for (const [tag, count] of Object.entries(countTagUsageInQuestions(nearby))) {
    weights[tag] = (weights[tag] ?? 0) + count * 8;
  }

  return weights;
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
  tagCounts: Record<string, number>
): QuizBankQuestion[] {
  return [...items].sort((a, b) => {
    const maxDiff = bankQuestionTagScore(a, tagCounts) - bankQuestionTagScore(b, tagCounts);
    if (maxDiff !== 0) return maxDiff;

    const sumDiff = bankQuestionTagUsageSum(a, tagCounts) - bankQuestionTagUsageSum(b, tagCounts);
    if (sumDiff !== 0) return sumDiff;

    const overlapDiff =
      bankQuestionUsedTagCount(a, tagCounts) - bankQuestionUsedTagCount(b, tagCounts);
    if (overlapDiff !== 0) return overlapDiff;

    return a.body.localeCompare(b.body, "sk");
  });
}

function tagOverlapCount(a: QuizBankQuestion, b: QuizBankQuestion): number {
  const bTags = new Set(b.tags ?? []);
  return (a.tags ?? []).filter((tag) => bTags.has(tag)).length;
}

function recentTagOverlapScore(item: QuizBankQuestion, recent: QuizBankQuestion[]): number {
  let score = 0;
  for (let index = 0; index < recent.length; index += 1) {
    const distance = recent.length - index;
    const overlap = tagOverlapCount(item, recent[index]!);
    if (overlap > 0) score += overlap * (1000 / distance);
  }
  return score;
}

/** Premieša otázky — preferuje menej použité tagy, ale vyhýba sa opakovaným tagom za sebou. */
export function shuffleBankQuestionsByTagBalance(
  items: QuizBankQuestion[],
  tagCounts: Record<string, number>,
  options?: { separationWindow?: number }
): QuizBankQuestion[] {
  const separationWindow = options?.separationWindow ?? 8;
  const pool = sortBankQuestionsByTagBalance(items, tagCounts);
  const result: QuizBankQuestion[] = [];
  const remaining = [...pool];

  while (remaining.length > 0) {
    const recent = result.slice(-separationWindow);
    let bestIndex = 0;
    let bestScore = Number.POSITIVE_INFINITY;

    for (let index = 0; index < remaining.length; index += 1) {
      const item = remaining[index]!;
      let score =
        bankQuestionTagScore(item, tagCounts) * 10_000 +
        bankQuestionTagUsageSum(item, tagCounts) * 500 +
        bankQuestionUsedTagCount(item, tagCounts) * 50 +
        recentTagOverlapScore(item, recent) * 2;

      score += Math.random() * 5;

      if (score < bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }

    result.push(remaining.splice(bestIndex, 1)[0]!);
  }

  return result;
}

export function applyBankQuestionOrder(
  items: QuizBankQuestion[],
  orderIds: string[]
): QuizBankQuestion[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  const seen = new Set<string>();
  const ordered: QuizBankQuestion[] = [];

  for (const id of orderIds) {
    const item = byId.get(id);
    if (!item) continue;
    ordered.push(item);
    seen.add(id);
  }

  for (const item of items) {
    if (!seen.has(item.id)) ordered.push(item);
  }

  return ordered;
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
