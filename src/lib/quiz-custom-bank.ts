import { inferBankTheme, normalizeBankThemeName } from "@/lib/bank-themes";
import type { QuizBankQuestion } from "@/lib/quiz-question-bank";
import { refreshStoredCustomQuestionTags, resolveCustomQuestionTags } from "@/lib/quiz-bank-tag-inference";
import {
  formatMatchBankAnswer,
  formatOrderAnswer,
  MATCH_PAIR_MAX,
  matchPairsFromBankAnswer,
  matchPairsFromColumns,
  ORDER_OPTION_MAX,
} from "@/lib/quiz-question-options";
import { sameQuizQuestionVariant } from "@/lib/quiz-library";

export const CUSTOM_BANK_STORAGE_KEY = "mudrc-custom-bank-questions";
const DELETED_CUSTOM_BANK_KEY = "mudrc-deleted-custom-bank-ids";

export const CUSTOM_BANK_ID_PREFIX = "custom-";

export type CustomBankQuestion = QuizBankQuestion & {
  createdAt: number;
  /** Čas poslednej úpravy. Novší zápis sa nestratí pri staršom načítaní. */
  updatedAt?: number;
  /** Predvolená fotka pri vložení do foto slotu */
  suggestedImageUrl?: string;
  /** Všeobecné, Hudobné, Filmové alebo vlastná téma */
  theme?: string;
};

export function isCustomBankQuestionId(id: string): boolean {
  return id.startsWith(CUSTOM_BANK_ID_PREFIX);
}

export function isGeneratedBankQuestion(item: QuizBankQuestion): boolean {
  return !isCustomBankQuestionId(item.id);
}

export function customQuestionHasPhoto(item: {
  isImageQuestion?: boolean;
  suggestedImageUrl?: string;
}): boolean {
  return Boolean(item.isImageQuestion || item.suggestedImageUrl?.trim());
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

export function readDeletedCustomBankIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(DELETED_CUSTOM_BANK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function rememberDeletedCustomBankIds(ids: string[]): void {
  if (typeof window === "undefined" || !ids.length) return;
  const next = [...readDeletedCustomBankIds(), ...ids].filter((id, index, all) => id && all.indexOf(id) === index);
  try {
    window.localStorage.setItem(DELETED_CUSTOM_BANK_KEY, JSON.stringify(next.slice(-2000)));
  } catch {
    /* localStorage plné */
  }
}

export function withoutDeletedCustomQuestions<T extends { id: string }>(questions: T[]): T[] {
  const deleted = new Set(readDeletedCustomBankIds());
  if (!deleted.size) return questions;
  return questions.filter((question) => !deleted.has(question.id));
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
  const isMatchQuestion = Boolean(row.isMatchQuestion);
  const isOrderQuestion = Boolean(row.isOrderQuestion) && !isMatchQuestion;
  const isOpenQuestion = Boolean(row.isOpenQuestion) && !isOrderQuestion && !isMatchQuestion;
  const optionsRaw = Array.isArray(row.options) ? row.options : [];
  const optionLimit = isMatchQuestion ? MATCH_PAIR_MAX : isOrderQuestion ? ORDER_OPTION_MAX : 6;
  const options = optionsRaw
    .map((o) => (typeof o === "string" ? o : ""))
    .slice(0, optionLimit);
  let matchRight: string[] | undefined;
  if (isMatchQuestion) {
    const rightRaw = Array.isArray(row.matchRight) ? row.matchRight : [];
    let pairs = matchPairsFromColumns(
      options,
      rightRaw.map((item) => (typeof item === "string" ? item : ""))
    );
    if (pairs.length < 2 && typeof row.answer === "string") {
      pairs = matchPairsFromBankAnswer(row.answer);
    }
    if (pairs.length < 2) return null;
    options.splice(0, options.length, ...pairs.map((pair) => pair.left));
    matchRight = pairs.map((pair) => pair.right);
  } else if (!isOrderQuestion) {
    while (options.length < 6) options.push("");
  } else {
    const filled = options.map((option) => option.trim()).filter(Boolean);
    options.splice(0, options.length, ...filled);
  }
  const correctIndex = typeof row.correctIndex === "number" ? row.correctIndex : 0;
  const answer = isMatchQuestion
    ? formatMatchBankAnswer(matchPairsFromColumns(options, matchRight ?? []))
    : isOrderQuestion
      ? (typeof row.answer === "string" && row.answer.trim()
          ? row.answer.trim()
          : formatOrderAnswer(options))
      : typeof row.answer === "string" && row.answer.trim()
        ? row.answer.trim()
        : isOpenQuestion
          ? ""
          : options[correctIndex]?.trim() ?? "";
  if (!answer) return null;
  if (isOrderQuestion && options.filter((option) => option.trim()).length < 2) return null;

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
    isOpenQuestion,
    isOrderQuestion,
    isMatchQuestion,
    matchRight,
    suggestedImageUrl:
      typeof row.suggestedImageUrl === "string" && row.suggestedImageUrl.trim()
        ? row.suggestedImageUrl.trim()
        : undefined,
    theme: typeof row.theme === "string" ? normalizeBankThemeName(row.theme) || undefined : undefined,
    createdAt: typeof row.createdAt === "number" ? row.createdAt : Date.now(),
    ...(typeof row.updatedAt === "number" ? { updatedAt: row.updatedAt } : {}),
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
  isOrderQuestion?: boolean;
  isMatchQuestion?: boolean;
  matchRight?: string[];
  suggestedImageUrl?: string;
  theme?: string;
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
  const isMatchQuestion = Boolean(input.isMatchQuestion);
  const isOrderQuestion = Boolean(input.isOrderQuestion) && !isMatchQuestion;
  const isOpenQuestion = Boolean(input.isOpenQuestion) && !isOrderQuestion && !isMatchQuestion;
  const columnPairs = isMatchQuestion ? matchPairsFromColumns(input.options, input.matchRight ?? []) : [];
  const matchPairs = isMatchQuestion
    ? columnPairs.length >= 2
      ? columnPairs
      : matchPairsFromBankAnswer(input.answer ?? "")
    : [];
  const options = isMatchQuestion
    ? matchPairs.map((pair) => pair.left)
    : [...input.options].map((option) => option.trim()).slice(0, isOrderQuestion ? ORDER_OPTION_MAX : 6);
  if (!isMatchQuestion && isOrderQuestion) {
    const filled = options.filter(Boolean);
    options.splice(0, options.length, ...filled);
  } else if (!isMatchQuestion) {
    while (options.length < 6) options.push("");
  }

  let correctIndex = 0;
  let answer = "";
  let matchRight: string[] | undefined;

  if (isMatchQuestion) {
    matchRight = matchPairs.map((pair) => pair.right);
    answer = formatMatchBankAnswer(matchPairs);
  } else if (isOrderQuestion) {
    answer = input.answer?.trim() || formatOrderAnswer(options);
  } else if (isOpenQuestion) {
    answer = input.answer?.trim() ?? "";
  } else {
    correctIndex = Math.min(Math.max(0, input.correctIndex), 5);
    answer = options[correctIndex]?.trim() || input.answer?.trim() || "";
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
    isOrderQuestion,
    isMatchQuestion,
    matchRight,
    suggestedImageUrl: input.suggestedImageUrl?.trim() || undefined,
    theme: inferBankTheme({
      theme: input.theme,
      tags: input.tags,
      body: input.body,
      note: input.note,
    }),
    createdAt: Date.now(),
    updatedAt: Date.now(),
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
let customBankSync: Promise<void> | null = null;

export function ensureCustomBankSynced(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (!customBankSync) {
    customBankSync = syncLocalCustomBankToServerOnce().catch((error) => {
      customBankSync = null;
      throw error;
    });
  }
  return customBankSync;
}

export async function syncLocalCustomBankToServerOnce(): Promise<void> {
  if (typeof window === "undefined") return;
  if (window.sessionStorage.getItem(CUSTOM_BANK_SYNC_FLAG)) return;

  const local = withoutDeletedCustomQuestions(readCustomBankQuestions());
  if (!local.length) {
    window.sessionStorage.setItem(CUSTOM_BANK_SYNC_FLAG, "1");
    return;
  }

  const current = await fetch(`/api/admin/custom-bank?_=${Date.now()}`, { cache: "no-store" });
  if (!current.ok) return;
  const currentData = await current.json().catch(() => ({}));
  const server = withoutDeletedCustomQuestions(parseCustomBankQuestionList(currentData.questions));
  if (server.length > 0) {
    writeCustomBankQuestions(server);
    window.sessionStorage.setItem(CUSTOM_BANK_SYNC_FLAG, "1");
    return;
  }

  const res = await fetch("/api/admin/custom-bank", {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ merge: true, questions: withoutDeletedCustomQuestions(local) }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : "Synchronizácia banky zlyhala");
  }
  if (Array.isArray(data.questions)) {
    writeCustomBankQuestions(parseCustomBankQuestionList(data.questions));
  }
  window.sessionStorage.setItem(CUSTOM_BANK_SYNC_FLAG, "1");
}

function preferNewerCustomQuestions(
  local: CustomBankQuestion[],
  server: CustomBankQuestion[]
): CustomBankQuestion[] {
  const localById = new Map(local.map((question) => [question.id, question]));
  return server.map((question) => {
    const previous = localById.get(question.id);
    if (previous && (previous.updatedAt ?? 0) > (question.updatedAt ?? 0)) return previous;
    return question;
  });
}

export async function fetchCustomBankQuestionsFromServer(): Promise<CustomBankQuestion[]> {
  await ensureCustomBankSynced().catch(() => undefined);

  try {
    const res = await fetch(`/api/admin/custom-bank?_=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return readCustomBankQuestions();
    const data = await res.json();
    const questions = preferNewerCustomQuestions(
      readCustomBankQuestions(),
      withoutDeletedCustomQuestions(
        parseCustomBankQuestionList(data.questions).sort((a, b) => b.createdAt - a.createdAt)
      )
    );
    writeCustomBankQuestions(questions);
    notifyCustomBankUpdated();
    return questions;
  } catch {
    return readCustomBankQuestions();
  }
}

export async function addCustomBankQuestionAsync(input: NewCustomBankQuestionInput): Promise<CustomBankQuestion> {
  await ensureCustomBankSynced().catch(() => undefined);

  const res = await fetch("/api/admin/custom-bank", {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : "Uloženie zlyhalo");
  }
  const created = normalizeStoredCustomQuestion(data.question);
  if (!created) throw new Error("Uloženie zlyhalo");
  const questions = withoutDeletedCustomQuestions(
    parseCustomBankQuestionList(Array.isArray(data.questions) ? data.questions : [])
  );
  if (!questions.some((question) => question.id === created.id)) {
    questions.unshift(created);
  }
  writeCustomBankQuestions(questions);
  notifyCustomBankUpdated();
  return created;
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
  const questions = withoutDeletedCustomQuestions(parseCustomBankQuestionList(data.questions ?? [updated])).map((item) =>
    item.id === updated.id ? updated : item
  );
  if (!questions.some((item) => item.id === updated.id)) questions.unshift(updated);
  writeCustomBankQuestions(questions);
  notifyCustomBankUpdated();
  return updated;
}

export async function removeCustomBankQuestionAsync(id: string): Promise<void> {
  if (!isCustomBankQuestionId(id)) return;

  const local = readCustomBankQuestions();
  const target = local.find((question) => question.id === id);
  const dropIds = local
    .filter((question) => question.id === id || (target ? sameQuizQuestionVariant(question, target) : false))
    .map((question) => question.id);
  if (!dropIds.includes(id)) dropIds.push(id);

  const res = await fetch(`/api/admin/custom-bank?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : "Vymazanie zlyhalo");
  }
  const returned = parseCustomBankQuestionList(data.questions);
  if (
    returned.some(
      (question) => question.id === id || (target ? sameQuizQuestionVariant(question, target) : false)
    )
  ) {
    throw new Error("Otázka v banke zostala. Skús vymazať znova.");
  }
  rememberDeletedCustomBankIds(dropIds);
  writeCustomBankQuestions(withoutDeletedCustomQuestions(returned));
  notifyCustomBankUpdated();
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
