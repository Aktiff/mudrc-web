import fs from "fs";
import path from "path";
import { readAppStorageWithFallback, writeAppStorageWithFallback } from "@/lib/app-storage-fallback";
import { readStoredCustomBankQuestions } from "@/lib/custom-bank-storage";
import { uniqueQuestionTags } from "@/lib/quiz-question-tags";

const localPath = path.join(process.cwd(), "src/data/used-question-tags.local.json");
const BLOB_NAME = "used-question-tags";

function readLocalTags(): string[] {
  try {
    if (!fs.existsSync(localPath)) return [];
    const raw = JSON.parse(fs.readFileSync(localPath, "utf-8")) as { tags?: unknown };
    return uniqueQuestionTags(raw.tags);
  } catch {
    return [];
  }
}

function writeLocalTags(tags: string[]): void {
  fs.mkdirSync(path.dirname(localPath), { recursive: true });
  fs.writeFileSync(localPath, JSON.stringify({ tags }, null, 2), "utf-8");
}

async function readVocabulary(): Promise<string[]> {
  const data = await readAppStorageWithFallback<{ tags?: unknown }>({
    label: "used-question-tags",
    blobName: BLOB_NAME,
    readLocal: () => ({ tags: readLocalTags() }),
    empty: { tags: [] },
  });
  return uniqueQuestionTags(data.tags);
}

async function writeVocabulary(tags: string[]): Promise<void> {
  const sorted = uniqueQuestionTags(tags);
  await writeAppStorageWithFallback({
    label: "used-question-tags",
    blobName: BLOB_NAME,
    payload: { tags: sorted },
    writeLocal: () => writeLocalTags(sorted),
  });
}

let writeQueue: Promise<void> = Promise.resolve();

function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(job, job);
  writeQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

/** Uložené tagy plus tagy, ktoré už sú na vlastných otázkach. */
export async function readUsedQuestionTagSuggestions(): Promise<string[]> {
  const [stored, questions] = await Promise.all([
    readVocabulary(),
    readStoredCustomBankQuestions().catch(() => []),
  ]);
  return uniqueQuestionTags([...stored, ...questions.flatMap((question) => question.tags)]);
}

/** Pridá nové tagy. Existujúce nemaže. */
export async function mergeStoredUsedTags(incoming: string[]): Promise<string[]> {
  const extra = uniqueQuestionTags(incoming);
  if (!extra.length) return readUsedQuestionTagSuggestions();

  return enqueue(async () => {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 6; attempt++) {
      const current = await readVocabulary();
      const next = uniqueQuestionTags([...current, ...extra]);
      try {
        await writeVocabulary(next);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Uloženie tagov zlyhalo");
        continue;
      }
      const after = await readVocabulary();
      if (next.every((tag) => after.includes(tag))) {
        return uniqueQuestionTags([...after, ...extra]);
      }
    }
    throw lastError ?? new Error("Tagy sa nepodarilo uložiť.");
  });
}
