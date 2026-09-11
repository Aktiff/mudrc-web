import fs from "fs";
import path from "path";
import {
  createCustomBankQuestion,
  normalizeStoredCustomQuestion,
  type CustomBankQuestion,
  type NewCustomBankQuestionInput,
} from "@/lib/quiz-custom-bank";
import {
  hasSupabaseStorage,
  supabaseFetchCustomBank,
  supabaseSetCustomBank,
} from "@/lib/supabase-storage";

const localPath = path.join(process.cwd(), "src/data/custom-bank.local.json");

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

export async function readStoredCustomBankQuestions(): Promise<CustomBankQuestion[]> {
  if (hasSupabaseStorage()) {
    const result = await supabaseFetchCustomBank();
    if (result.status === "error") throw new Error(result.message);
    if (result.status === "missing") return [];
    const list = Array.isArray(result.value.questions) ? result.value.questions : [];
    return list
      .map(normalizeStoredCustomQuestion)
      .filter((item): item is CustomBankQuestion => item !== null)
      .sort((a, b) => b.createdAt - a.createdAt);
  }
  return readLocalCustomBank();
}

export async function writeStoredCustomBankQuestions(questions: CustomBankQuestion[]): Promise<void> {
  const sorted = [...questions].sort((a, b) => b.createdAt - a.createdAt);
  if (hasSupabaseStorage()) {
    await supabaseSetCustomBank({ questions: sorted });
    return;
  }
  writeLocalCustomBank(sorted);
}

export async function addStoredCustomBankQuestion(
  input: NewCustomBankQuestionInput
): Promise<CustomBankQuestion> {
  const item = createCustomBankQuestion(input);
  const existing = await readStoredCustomBankQuestions();
  await writeStoredCustomBankQuestions([item, ...existing.filter((q) => q.id !== item.id)]);
  return item;
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
  for (const item of [...existing, ...incoming]) {
    const normalized = normalizeStoredCustomQuestion(item);
    if (normalized) byId.set(normalized.id, normalized);
  }
  const merged = Array.from(byId.values()).sort((a, b) => b.createdAt - a.createdAt);
  await writeStoredCustomBankQuestions(merged);
  return merged;
}
