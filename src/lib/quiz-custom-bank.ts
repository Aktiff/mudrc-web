import type { QuizBankQuestion } from "@/lib/quiz-question-bank";

export const CUSTOM_BANK_STORAGE_KEY = "mudrc-custom-bank-questions";

export const CUSTOM_BANK_ID_PREFIX = "custom-";

export type CustomBankQuestion = QuizBankQuestion & {
  createdAt: number;
  /** Predvolená fotka pri vložení do foto slotu */
  suggestedImageUrl?: string;
};

export function isCustomBankQuestionId(id: string): boolean {
  return id.startsWith(CUSTOM_BANK_ID_PREFIX);
}

export function isGeneratedBankQuestion(item: QuizBankQuestion): boolean {
  return !isCustomBankQuestionId(item.id);
}

export function readCustomBankQuestions(): CustomBankQuestion[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_BANK_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeStoredCustomQuestion)
      .filter((item): item is CustomBankQuestion => item !== null)
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export function writeCustomBankQuestions(questions: CustomBankQuestion[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CUSTOM_BANK_STORAGE_KEY, JSON.stringify(questions));
}

export function notifyCustomBankUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("mudrc-custom-bank-updated"));
}

function normalizeStoredCustomQuestion(raw: unknown): CustomBankQuestion | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.id !== "string" || !isCustomBankQuestionId(row.id)) return null;
  if (typeof row.body !== "string" || !row.body.trim()) return null;
  if (!Array.isArray(row.options) || row.options.length !== 6) return null;
  const options = row.options.map((o) => (typeof o === "string" ? o : "")) as QuizBankQuestion["options"];
  const correctIndex = typeof row.correctIndex === "number" ? row.correctIndex : 0;
  const answer =
    typeof row.answer === "string" && row.answer.trim()
      ? row.answer.trim()
      : options[correctIndex]?.trim() ?? "";
  if (!answer) return null;

  const tagsRaw = row.tags;
  const tags = Array.isArray(tagsRaw)
    ? tagsRaw.filter((t): t is string => typeof t === "string").map((t) => t.trim().toLowerCase()).filter(Boolean)
    : ["vlastné"];

  return {
    id: row.id,
    body: row.body.trim(),
    answer,
    options,
    correctIndex: Math.min(Math.max(0, correctIndex), 5),
    difficulty: typeof row.difficulty === "number" ? Math.min(10, Math.max(1, row.difficulty)) : 5,
    note: typeof row.note === "string" ? row.note.trim() : "",
    tags: tags.length ? Array.from(new Set(tags)).slice(0, 8) : ["vlastné"],
    isImageQuestion: Boolean(row.isImageQuestion),
    suggestedImageUrl:
      typeof row.suggestedImageUrl === "string" && row.suggestedImageUrl.trim()
        ? row.suggestedImageUrl.trim()
        : undefined,
    createdAt: typeof row.createdAt === "number" ? row.createdAt : Date.now(),
  };
}

export type NewCustomBankQuestionInput = {
  body: string;
  options: string[];
  correctIndex: number;
  note?: string;
  tags?: string[];
  difficulty?: number;
  isImageQuestion?: boolean;
  suggestedImageUrl?: string;
};

export function createCustomBankQuestion(input: NewCustomBankQuestionInput): CustomBankQuestion {
  const options = [...input.options].slice(0, 6) as QuizBankQuestion["options"];
  while (options.length < 6) options.push("");
  const correctIndex = Math.min(Math.max(0, input.correctIndex), 5);
  const answer = options[correctIndex]?.trim() ?? "";
  const tags = input.tags?.length
    ? Array.from(new Set([...input.tags.map((t) => t.trim().toLowerCase()).filter(Boolean), "vlastné"]))
    : ["vlastné"];

  return {
    id: `${CUSTOM_BANK_ID_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    body: input.body.trim(),
    answer,
    options,
    correctIndex,
    difficulty: input.difficulty ?? 5,
    note: input.note?.trim() ?? "",
    tags: tags.slice(0, 8),
    isImageQuestion: Boolean(input.isImageQuestion),
    suggestedImageUrl: input.suggestedImageUrl?.trim() || undefined,
    createdAt: Date.now(),
  };
}

export function addCustomBankQuestion(input: NewCustomBankQuestionInput): CustomBankQuestion {
  const item = createCustomBankQuestion(input);
  const next = [item, ...readCustomBankQuestions()];
  writeCustomBankQuestions(next);
  notifyCustomBankUpdated();
  return item;
}

export function removeCustomBankQuestion(id: string): void {
  if (!isCustomBankQuestionId(id)) return;
  const next = readCustomBankQuestions().filter((q) => q.id !== id);
  writeCustomBankQuestions(next);
  notifyCustomBankUpdated();
}

export function mergeCustomAndGeneratedBank(
  custom: QuizBankQuestion[],
  generated: QuizBankQuestion[]
): QuizBankQuestion[] {
  const customSorted = [...custom].sort((a, b) => {
    const aTime = "createdAt" in a && typeof a.createdAt === "number" ? a.createdAt : 0;
    const bTime = "createdAt" in b && typeof b.createdAt === "number" ? b.createdAt : 0;
    return bTime - aTime;
  });
  return [...customSorted, ...generated];
}
