import fs from "fs";
import path from "path";
import {
  applyCustomBankQuestionUpdate,
  createCustomBankQuestion,
  isCustomBankQuestionId,
  normalizeStoredCustomQuestion,
  type CustomBankQuestion,
  type NewCustomBankQuestionInput,
} from "@/lib/quiz-custom-bank";
import { readLatestAppStorageBlob } from "@/lib/blob-app-storage";
import { sameQuizQuestionVariant } from "@/lib/quiz-library";
import { writeAppStorageWithFallback } from "@/lib/app-storage-fallback";
import { hasBlobStorage } from "@/lib/storage";

const localPath = path.join(process.cwd(), "src/data/custom-bank.local.json");
const BLOB_NAME = "custom-bank-questions";

function readLocalBankFile(): BankFile {
  try {
    if (!fs.existsSync(localPath)) return { questions: [], deletedIds: [] };
    const raw = JSON.parse(fs.readFileSync(localPath, "utf-8")) as { questions?: unknown[]; deletedIds?: unknown };
    return parseBankFile(raw);
  } catch {
    return { questions: [], deletedIds: [] };
  }
}

function writeLocalBankFile(file: BankFile): void {
  fs.mkdirSync(path.dirname(localPath), { recursive: true });
  fs.writeFileSync(
    localPath,
    JSON.stringify({ questions: file.questions, deletedIds: file.deletedIds }, null, 2),
    "utf-8"
  );
}

type BankFile = { questions: CustomBankQuestion[]; deletedIds: string[] };

function parseDeletedIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((id): id is string => typeof id === "string" && id.length > 0).slice(-2000);
}

function parseBankFile(data: { questions?: unknown[]; deletedIds?: unknown } | null): BankFile {
  const deletedIds = parseDeletedIds(data?.deletedIds);
  const deleted = new Set(deletedIds);
  const list = Array.isArray(data?.questions) ? data.questions : [];
  const questions = list
    .map(normalizeStoredCustomQuestion)
    .filter((item): item is CustomBankQuestion => item !== null && !deleted.has(item.id))
    .sort((a, b) => b.createdAt - a.createdAt);
  return { questions, deletedIds };
}

function rememberDeleted(existing: string[], ids: string[]): string[] {
  return parseDeletedIds([...existing, ...ids]);
}

async function readBankFile(): Promise<BankFile> {
  if (hasBlobStorage()) {
    const data = await readLatestAppStorageBlob<{ questions?: unknown[]; deletedIds?: unknown }>(BLOB_NAME);
    if (data) return parseBankFile(data);
  }
  return readLocalBankFile();
}

async function writeBankFile(file: BankFile): Promise<void> {
  const questions = [...file.questions].sort((a, b) => b.createdAt - a.createdAt);
  const payload = { questions, deletedIds: file.deletedIds };
  await writeAppStorageWithFallback({
    label: "custom-bank",
    blobName: BLOB_NAME,
    payload,
    writeLocal: () => writeLocalBankFile({ questions, deletedIds: file.deletedIds }),
  });
}

export async function readStoredCustomBankQuestions(): Promise<CustomBankQuestion[]> {
  return (await readBankFile()).questions;
}

let bankWriteQueue: Promise<void> = Promise.resolve();

function enqueueBankWrite<T>(job: () => Promise<T>): Promise<T> {
  const run = bankWriteQueue.then(job, job);
  bankWriteQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function sameQuestionIds(left: CustomBankQuestion[], right: CustomBankQuestion[]): boolean {
  if (left.length !== right.length) return false;
  const ids = new Set(right.map((question) => question.id));
  return left.every((question) => ids.has(question.id));
}

function sameTextList(left: string[] | undefined, right: string[] | undefined): boolean {
  return (left ?? []).join("\n") === (right ?? []).join("\n");
}

function savedQuestionMatches(expected: CustomBankQuestion, actual: CustomBankQuestion): boolean {
  return (
    expected.body === actual.body &&
    expected.answer === actual.answer &&
    sameTextList(expected.options, actual.options) &&
    expected.correctIndex === actual.correctIndex &&
    expected.note === actual.note &&
    expected.difficulty === actual.difficulty &&
    expected.isImageQuestion === actual.isImageQuestion &&
    expected.isOpenQuestion === actual.isOpenQuestion &&
    expected.isOrderQuestion === actual.isOrderQuestion &&
    expected.isMatchQuestion === actual.isMatchQuestion &&
    sameTextList(expected.matchRight, actual.matchRight) &&
    (expected.suggestedImageUrl ?? "") === (actual.suggestedImageUrl ?? "") &&
    (expected.theme ?? "") === (actual.theme ?? "")
  );
}

/** Zapíše celý zoznam a znova ho prečíta. Keď medzitým prišiel iný zápis, skúsi to znova. */
async function mutateStoredCustomBank(
  mutate: (current: BankFile) => BankFile,
  confirm?: (written: CustomBankQuestion[], read: CustomBankQuestion[]) => boolean
): Promise<CustomBankQuestion[]> {
  return enqueueBankWrite(async () => {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 6; attempt++) {
      const current = await readBankFile();
      const next = mutate(current);
      try {
        await writeBankFile(next);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Uloženie banky zlyhalo");
        await sleep(200);
        continue;
      }
      const after = await readBankFile();
      const deleted = new Set(next.deletedIds);
      const idsMatch =
        sameQuestionIds(next.questions, after.questions) &&
        after.questions.every((question) => !deleted.has(question.id));
      if (idsMatch && (!confirm || confirm(next.questions, after.questions))) {
        return after.questions;
      }
      await sleep(250);
    }
    throw lastError ?? new Error("Otázku sa nepodarilo uložiť. Skús to znova.");
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function addStoredCustomBankQuestion(
  input: NewCustomBankQuestionInput
): Promise<{ question: CustomBankQuestion; questions: CustomBankQuestion[] }> {
  const item = createCustomBankQuestion(input);
  if (!item.body.trim() || !item.answer.trim()) {
    throw new Error("Chýba text otázky alebo správna odpoveď");
  }
  const questions = await mutateStoredCustomBank((current) => ({
    ...current,
    questions: [item, ...current.questions.filter((question) => question.id !== item.id)],
  }));
  const saved = questions.find((question) => question.id === item.id);
  if (!saved) throw new Error("Otázku sa nepodarilo uložiť. Skús to znova.");
  return { question: saved, questions };
}

export async function updateStoredCustomBankQuestion(
  id: string,
  input: NewCustomBankQuestionInput
): Promise<CustomBankQuestion> {
  if (!isCustomBankQuestionId(id)) throw new Error("NOT_FOUND");
  if (!input?.body?.trim()) throw new Error("Chýba text otázky");

  const questions = await mutateStoredCustomBank(
    (existing) => {
      const current = existing.questions.find((q) => q.id === id);
      if (!current) throw new Error("NOT_FOUND");
      const updated = applyCustomBankQuestionUpdate(current, input);
      return {
        ...existing,
        questions: existing.questions.map((q) => (q.id === id ? updated : q)),
      };
    },
    (written, read) => {
      const expected = written.find((question) => question.id === id);
      const actual = read.find((question) => question.id === id);
      return Boolean(expected && actual && savedQuestionMatches(expected, actual));
    }
  );
  const saved = questions.find((q) => q.id === id);
  if (!saved) throw new Error("NOT_FOUND");
  return saved;
}

export async function removeStoredCustomBankQuestion(id: string): Promise<CustomBankQuestion[]> {
  const before = await readBankFile();
  const target = before.questions.find((question) => question.id === id);
  const dropIds = before.questions
    .filter((question) => question.id === id || (target ? sameQuizQuestionVariant(question, target) : false))
    .map((question) => question.id);
  if (!dropIds.includes(id)) dropIds.push(id);

  const after = await mutateStoredCustomBank((existing) => {
    const gone = new Set(dropIds);
    return {
      deletedIds: rememberDeleted(existing.deletedIds, dropIds),
      questions: existing.questions.filter((question) => {
        if (gone.has(question.id)) return false;
        return !target || !sameQuizQuestionVariant(question, target);
      }),
    };
  });
  if (after.some((question) => question.id === id || (target ? sameQuizQuestionVariant(question, target) : false))) {
    throw new Error("Otázku sa nepodarilo vymazať. Skús to znova.");
  }
  return after;
}

export async function mergeStoredCustomBankQuestions(incoming: CustomBankQuestion[]): Promise<CustomBankQuestion[]> {
  return mutateStoredCustomBank((existing) => {
    const deleted = new Set(existing.deletedIds);
    const byId = new Map<string, CustomBankQuestion>();
    for (const item of existing.questions) byId.set(item.id, item);
    for (const item of incoming) {
      const normalized = normalizeStoredCustomQuestion(item);
      if (!normalized || deleted.has(normalized.id) || byId.has(normalized.id)) continue;
      byId.set(normalized.id, normalized);
    }
    return { ...existing, questions: Array.from(byId.values()) };
  });
}
