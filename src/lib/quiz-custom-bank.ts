import type { QuizBankQuestion } from "@/lib/quiz-question-bank";
import { refreshStoredCustomQuestionTags, resolveCustomQuestionTags } from "@/lib/quiz-bank-tag-inference";

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
  try {
    window.localStorage.setItem(CUSTOM_BANK_STORAGE_KEY, JSON.stringify(questions));
  } catch {
    /* localStorage nedostupné alebo plné */
  }
}

export function notifyCustomBankUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("mudrc-custom-bank-updated"));
}

export function normalizeStoredCustomQuestion(raw: unknown): CustomBankQuestion | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.id !== "string" || !isCustomBankQuestionId(row.id)) return null;
  if (typeof row.body !== "string" || !row.body.trim()) return null;
  const isOpenQuestion = Boolean(row.isOpenQuestion);
  const optionsRaw = Array.isArray(row.options) ? row.options : [];
  const optionsPadded = optionsRaw.map((o) => (typeof o === "string" ? o : "")).slice(0, 6);
  while (optionsPadded.length < 6) optionsPadded.push("");
  const options = optionsPadded as QuizBankQuestion["options"];
  const correctIndex = typeof row.correctIndex === "number" ? row.correctIndex : 0;
  const answer =
    typeof row.answer === "string" && row.answer.trim()
      ? row.answer.trim()
      : isOpenQuestion
        ? ""
        : options[correctIndex]?.trim() ?? "";
  if (!answer) return null;

  const tagsRaw = Array.isArray(row.tags)
    ? row.tags.filter((t): t is string => typeof t === "string").map((t) => t.trim().toLowerCase()).filter(Boolean)
    : undefined;
  const tags = refreshStoredCustomQuestionTags(tagsRaw, row.body as string, answer, typeof row.note === "string" ? row.note : undefined);

  return {
    id: row.id,
    body: row.body.trim(),
    answer,
    options,
    correctIndex: Math.min(Math.max(0, correctIndex), 5),
    difficulty: typeof row.difficulty === "number" ? Math.min(10, Math.max(1, row.difficulty)) : 5,
    note: typeof row.note === "string" ? row.note.trim() : "",
    tags: tags.length ? tags : resolveCustomQuestionTags(undefined, row.body as string, answer),
    isImageQuestion: Boolean(row.isImageQuestion),
    isOpenQuestion: Boolean(row.isOpenQuestion),
    suggestedImageUrl:
      typeof row.suggestedImageUrl === "string" && row.suggestedImageUrl.trim()
        ? row.suggestedImageUrl.trim()
        : undefined,
    createdAt: typeof row.createdAt === "number" ? row.createdAt : Date.now(),
  };
}

export function parseCustomBankQuestionList(raw: unknown): CustomBankQuestion[] {
  if (!Array.isArray(raw)) return [];
  const out: CustomBankQuestion[] = [];
  for (const row of raw) {
    const item = normalizeStoredCustomQuestion(row);
    if (item) out.push(item);
  }
  return out;
}

export type NewCustomBankQuestionInput = {
  body: string;
  options: string[];
  correctIndex: number;
  answer?: string;
  note?: string;
  tags?: string[];
  difficulty?: number;
  isImageQuestion?: boolean;
  isOpenQuestion?: boolean;
  suggestedImageUrl?: string;
};

/** Len vyplnené možnosti — pre vloženie a premiešanie. */
export function compactChoiceBankQuestion(item: QuizBankQuestion): QuizBankQuestion {
  const filled = item.options
    .map((opt, index) => ({ opt: opt.trim(), index }))
    .filter((entry) => entry.opt);
  if (filled.length < 2) return item;

  const options = filled.map((entry) => entry.opt);
  const correctSource = Math.min(Math.max(item.correctIndex, 0), item.options.length - 1);
  let correctIndex = filled.findIndex((entry) => entry.index === correctSource);
  if (correctIndex < 0) correctIndex = 0;
  const answer = options[correctIndex] ?? item.answer;

  const padded = [...options] as QuizBankQuestion["options"];
  while (padded.length < 6) padded.push("");

  return {
    ...item,
    options: padded,
    correctIndex,
    answer,
  };
}

export function applyCustomBankQuestionUpdate(
  existing: CustomBankQuestion,
  input: NewCustomBankQuestionInput
): CustomBankQuestion {
  const next = createCustomBankQuestion(input);
  return { ...next, id: existing.id, createdAt: existing.createdAt };
}

export function createCustomBankQuestion(input: NewCustomBankQuestionInput): CustomBankQuestion {
  const isOpenQuestion = Boolean(input.isOpenQuestion);
  const options = [...input.options].slice(0, 6) as QuizBankQuestion["options"];
  while (options.length < 6) options.push("");

  let correctIndex = 0;
  let answer = "";

  if (isOpenQuestion) {
    answer = input.answer?.trim() ?? "";
  } else {
    correctIndex = Math.min(Math.max(0, input.correctIndex), 5);
    answer = options[correctIndex]?.trim() ?? input.answer?.trim() ?? "";
  }

  const tags = resolveCustomQuestionTags(input.tags, input.body.trim(), answer, input.note);

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
    isOpenQuestion,
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

const CUSTOM_BANK_SYNC_FLAG = "mudrc-custom-bank-synced-v1";

export async function syncLocalCustomBankToServerOnce(): Promise<void> {
  if (typeof window === "undefined") return;
  if (window.sessionStorage.getItem(CUSTOM_BANK_SYNC_FLAG)) return;

  const local = readCustomBankQuestions();
  if (!local.length) {
    window.sessionStorage.setItem(CUSTOM_BANK_SYNC_FLAG, "1");
    return;
  }

  try {
    const res = await fetch("/api/admin/custom-bank", {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ merge: true, questions: local }),
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.questions)) {
        writeCustomBankQuestions(parseCustomBankQuestionList(data.questions));
      }
    }
  } catch {
    /* sync zlyhal — zostane localStorage */
  } finally {
    window.sessionStorage.setItem(CUSTOM_BANK_SYNC_FLAG, "1");
  }
}

export async function fetchCustomBankQuestionsFromServer(): Promise<CustomBankQuestion[]> {
  await syncLocalCustomBankToServerOnce();

  try {
    const res = await fetch(`/api/admin/custom-bank?_=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return readCustomBankQuestions();
    const data = await res.json();
    const questions = parseCustomBankQuestionList(data.questions).sort((a, b) => b.createdAt - a.createdAt);
    writeCustomBankQuestions(questions);
    notifyCustomBankUpdated();
    return questions;
  } catch {
    return readCustomBankQuestions();
  }
}

export async function addCustomBankQuestionAsync(input: NewCustomBankQuestionInput): Promise<CustomBankQuestion> {
  try {
    const res = await fetch("/api/admin/custom-bank", {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(typeof data.error === "string" ? data.error : "Uloženie zlyhalo");
    }
    const created = normalizeStoredCustomQuestion(data.question) ?? createCustomBankQuestion(input);
    const questions = parseCustomBankQuestionList(
      Array.isArray(data.questions) ? data.questions : [data.question]
    );
    writeCustomBankQuestions(questions);
    notifyCustomBankUpdated();
    return created;
  } catch {
    return addCustomBankQuestion(input);
  }
}

export async function updateCustomBankQuestionAsync(
  id: string,
  input: NewCustomBankQuestionInput
): Promise<CustomBankQuestion> {
  if (!isCustomBankQuestionId(id)) {
    throw new Error("Neplatné id otázky v banke.");
  }
  const res = await fetch("/api/admin/custom-bank", {
    method: "PATCH",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, ...input }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : "Uloženie zlyhalo");
  }
  const updated = normalizeStoredCustomQuestion(data.question);
  if (!updated) throw new Error("Uloženie zlyhalo");
  const questions = parseCustomBankQuestionList(data.questions ?? [updated]);
  writeCustomBankQuestions(questions);
  notifyCustomBankUpdated();
  return updated;
}

export async function removeCustomBankQuestionAsync(id: string): Promise<void> {
  if (!isCustomBankQuestionId(id)) return;

  try {
    const res = await fetch(`/api/admin/custom-bank?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      const questions = parseCustomBankQuestionList(data.questions);
      writeCustomBankQuestions(questions);
      notifyCustomBankUpdated();
      return;
    }
  } catch {
    /* fallback local */
  }

  removeCustomBankQuestion(id);
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
