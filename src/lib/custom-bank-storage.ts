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
import { readAppStorageWithFallback, writeAppStorageWithFallback } from "@/lib/app-storage-fallback";

const localPath = path.join(process.cwd(), "src/data/custom-bank.local.json");
const BLOB_NAME = "custom-bank-questions";

function readLocalCustomBank(): CustomBankQuestion[] {
  try {
    if (!fs.existsSync(localPath)) return [];
    const raw = JSON.parse(fs.readFileSync(localPath, "utf-8")) as { questions?: unknown[] };
    const list = Array.isArray(raw.questions) ? raw.questions : [];
    return list
      .map(normalizeStoredCustomQuestion)
      .filter((item): item is CustomBankQuestion => item !== null)
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

function writeLocalCustomBank(questions: CustomBankQuestion[]): void {
  fs.mkdirSync(path.dirname(localPath), { recursive: true });
  fs.writeFileSync(localPath, JSON.stringify({ questions }, null, 2), "utf-8");
}

function parseCustomBankPayload(data: { questions?: unknown[] }): CustomBankQuestion[] {
  const list = Array.isArray(data.questions) ? data.questions : [];
  return list
    .map(normalizeStoredCustomQuestion)
    .filter((item): item is CustomBankQuestion => item !== null)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function readStoredCustomBankQuestions(): Promise<CustomBankQuestion[]> {
  const data = await readAppStorageWithFallback({
    label: "custom-bank",
    blobName: BLOB_NAME,
    readLocal: () => ({ questions: readLocalCustomBank() }),
    empty: { questions: [] },
  });
  return parseCustomBankPayload(data);
}

export async function writeStoredCustomBankQuestions(questions: CustomBankQuestion[]): Promise<void> {
  const sorted = [...questions].sort((a, b) => b.createdAt - a.createdAt);
  const payload = { questions: sorted };
  await writeAppStorageWithFallback({
    label: "custom-bank",
    blobName: BLOB_NAME,
    payload,
    writeLocal: () => writeLocalCustomBank(sorted),
  });
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

/** Zapíše celý zoznam a znova ho prečíta. Keď medzitým prišiel iný zápis, skúsi to znova. */
async function mutateStoredCustomBank(
  mutate: (current: CustomBankQuestion[]) => CustomBankQuestion[]
): Promise<CustomBankQuestion[]> {
  return enqueueBankWrite(async () => {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 6; attempt++) {
      const current = await readStoredCustomBankQuestions();
      const next = mutate(current);
      try {
        await writeStoredCustomBankQuestions(next);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Uloženie banky zlyhalo");
        continue;
      }
      const after = await readStoredCustomBankQuestions();
      const afterIds = new Set(after.map((question) => question.id));
      if (next.every((question) => afterIds.has(question.id))) return after;
    }
    throw lastError ?? new Error("Otázku sa nepodarilo uložiť. Skús to znova.");
  });
}

export async function addStoredCustomBankQuestion(
  input: NewCustomBankQuestionInput
): Promise<{ question: CustomBankQuestion; questions: CustomBankQuestion[] }> {
  const item = createCustomBankQuestion(input);
  if (!item.body.trim() || !item.answer.trim()) {
    throw new Error("Chýba text otázky alebo správna odpoveď");
  }
  const questions = await mutateStoredCustomBank((current) => [
    item,
    ...current.filter((question) => question.id !== item.id),
  ]);
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

  const questions = await mutateStoredCustomBank((existing) => {
    const current = existing.find((q) => q.id === id);
    if (!current) throw new Error("NOT_FOUND");
    const updated = applyCustomBankQuestionUpdate(current, input);
    return existing.map((q) => (q.id === id ? updated : q));
  });
  const saved = questions.find((q) => q.id === id);
  if (!saved) throw new Error("NOT_FOUND");
  return saved;
}

export async function removeStoredCustomBankQuestion(id: string): Promise<boolean> {
  const before = await readStoredCustomBankQuestions();
  if (!before.some((question) => question.id === id)) return false;
  await mutateStoredCustomBank((existing) => existing.filter((question) => question.id !== id));
  return true;
}

export async function mergeStoredCustomBankQuestions(incoming: CustomBankQuestion[]): Promise<CustomBankQuestion[]> {
  return mutateStoredCustomBank((existing) => {
    const byId = new Map<string, CustomBankQuestion>();
    for (const item of existing) byId.set(item.id, item);
    for (const item of incoming) {
      const normalized = normalizeStoredCustomQuestion(item);
      if (normalized && !byId.has(normalized.id)) byId.set(normalized.id, normalized);
    }
    return Array.from(byId.values());
  });
}
