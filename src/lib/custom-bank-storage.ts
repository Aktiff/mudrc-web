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

export async function addStoredCustomBankQuestion(
  input: NewCustomBankQuestionInput
): Promise<CustomBankQuestion> {
  const item = createCustomBankQuestion(input);
  const existing = await readStoredCustomBankQuestions();
  await writeStoredCustomBankQuestions([item, ...existing.filter((q) => q.id !== item.id)]);
  return item;
}

export async function updateStoredCustomBankQuestion(
  id: string,
  input: NewCustomBankQuestionInput
): Promise<CustomBankQuestion> {
  if (!isCustomBankQuestionId(id)) throw new Error("NOT_FOUND");
  if (!input?.body?.trim()) throw new Error("Chýba text otázky");

  const existing = await readStoredCustomBankQuestions();
  const current = existing.find((q) => q.id === id);
  if (!current) throw new Error("NOT_FOUND");

  const updated = applyCustomBankQuestionUpdate(current, input);
  await writeStoredCustomBankQuestions(
    existing.map((q) => (q.id === id ? updated : q))
  );
  return updated;
}

export async function removeStoredCustomBankQuestion(id: string): Promise<boolean> {
  const existing = await readStoredCustomBankQuestions();
  const next = existing.filter((q) => q.id !== id);
  if (next.length === existing.length) return false;
  await writeStoredCustomBankQuestions(next);
  return true;
}

export async function mergeStoredCustomBankQuestions(incoming: CustomBankQuestion[]): Promise<CustomBankQuestion[]> {
  const existing = await readStoredCustomBankQuestions();
  const byId = new Map<string, CustomBankQuestion>();
  for (const item of existing) byId.set(item.id, item);
  for (const item of incoming) {
    const normalized = normalizeStoredCustomQuestion(item);
    if (normalized && !byId.has(normalized.id)) byId.set(normalized.id, normalized);
  }
  const merged = Array.from(byId.values()).sort((a, b) => b.createdAt - a.createdAt);
  await writeStoredCustomBankQuestions(merged);
  return merged;
}
