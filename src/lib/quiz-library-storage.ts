import fs from "fs";
import path from "path";
import type { QuizDeck } from "@/lib/quiz-deck";
import type { QuizLibraryItem } from "@/lib/quiz-library";
import { createLibraryQuizId, defaultLibraryQuiz, normalizeLibraryQuiz } from "@/lib/quiz-library";
import { readQuizLibraryBackup, writeQuizLibraryBackup } from "@/lib/quiz-library-backup";
import { readAllQuizDecks } from "@/lib/quiz-deck-storage";
import { deleteAppStorageBlob, readAppStorageBlob, writeAppStorageBlob } from "@/lib/blob-app-storage";
import { shouldWriteBlob } from "@/lib/storage";

const QUIZ_LIBRARY_INDEX_BLOB = "quiz-library-index";
const quizLibraryItemBlobName = (id: string) => `quiz-library-item-${id}`;

const localIndexPath = path.join(process.cwd(), "src/data/quiz-library-index.local.json");
const localItemPath = (id: string) => path.join(process.cwd(), `src/data/quiz-library-${id}.local.json`);

type LibraryIndex = { items: QuizLibraryIndexEntry[] };
type QuizLibraryIndexEntry = {
  id: string;
  title: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  slideCount: number;
};

function toIndexEntry(quiz: QuizLibraryItem): QuizLibraryIndexEntry {
  return {
    id: quiz.id,
    title: quiz.title,
    notes: quiz.notes,
    createdAt: quiz.createdAt,
    updatedAt: quiz.updatedAt,
    slideCount: quiz.questions?.length ?? 0,
  };
}

function readLocalIndex(): LibraryIndex {
  try {
    if (!fs.existsSync(localIndexPath)) return { items: [] };
    const raw = fs.readFileSync(localIndexPath, "utf-8");
    const data = JSON.parse(raw) as LibraryIndex;
    return { items: Array.isArray(data.items) ? data.items : [] };
  } catch {
    return { items: [] };
  }
}

function writeLocalIndex(index: LibraryIndex): void {
  fs.mkdirSync(path.dirname(localIndexPath), { recursive: true });
  fs.writeFileSync(localIndexPath, JSON.stringify(index, null, 2), "utf-8");
}

function readLocalItem(id: string): QuizLibraryItem | null {
  try {
    const filePath = localItemPath(id);
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as QuizLibraryItem;
  } catch {
    return null;
  }
}

function writeLocalItem(quiz: QuizLibraryItem): void {
  fs.writeFileSync(localItemPath(quiz.id), JSON.stringify(quiz, null, 2), "utf-8");
}

function deleteLocalItem(id: string): void {
  const filePath = localItemPath(id);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

function deckToLibraryItem(deck: QuizDeck): QuizLibraryItem {
  const now = new Date().toISOString();
  return normalizeLibraryQuiz({
    id: createLibraryQuizId(),
    title: deck.venueTitle?.trim() || deck.eventSlug,
    slides: deck.slides,
    notes: `Importované z podniku ${deck.eventSlug}`,
    createdAt: deck.updatedAt || now,
    updatedAt: deck.updatedAt || now,
  });
}

async function migrateLegacyMonolithicStore(): Promise<QuizLibraryItem[]> {
  const monolithic = await readAppStorageBlob<{ quizzes?: QuizLibraryItem[] }>("quiz-library");
  const quizzes = monolithic?.quizzes ?? [];
  if (!quizzes.length) return [];

  const items = quizzes.map(toIndexEntry);
  for (const quiz of quizzes) {
    const normalized = normalizeLibraryQuiz(quiz);
    if (shouldWriteBlob()) {
      await writeAppStorageBlob(quizLibraryItemBlobName(normalized.id), normalized);
    } else {
      writeLocalItem(normalized);
    }
  }
  await persistQuizIndexItems(items);
  return quizzes;
}

async function migrateLegacyDecks(existing: QuizLibraryItem[]): Promise<QuizLibraryItem[]> {
  if (existing.length) return existing;
  const legacyDecks = await readAllQuizDecks();
  if (!legacyDecks.length) return existing;
  const migrated = legacyDecks.filter((deck) => deck.slides.length).map(deckToLibraryItem);
  for (const quiz of migrated) {
    await persistQuiz(quiz);
  }
  return migrated;
}

async function readIndexFromBlobOrLocal(): Promise<LibraryIndex> {
  const fromBlob = await readAppStorageBlob<LibraryIndex>(QUIZ_LIBRARY_INDEX_BLOB);
  if (fromBlob?.items?.length) return fromBlob;
  return readLocalIndex();
}

async function mergeIndexEntry(items: QuizLibraryIndexEntry[], entry: QuizLibraryIndexEntry): Promise<LibraryIndex> {
  const merged = [...items.filter((item) => item.id !== entry.id), entry].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt)
  );
  return { items: merged };
}

async function writeQuizBlobPair(normalized: QuizLibraryItem, entry: QuizLibraryIndexEntry): Promise<void> {
  await writeAppStorageBlob(quizLibraryItemBlobName(normalized.id), normalized);
  const fromBlob = await readAppStorageBlob<LibraryIndex>(QUIZ_LIBRARY_INDEX_BLOB);
  const baseItems = fromBlob?.items?.length ? fromBlob.items : readLocalIndex().items;
  const index = await mergeIndexEntry(baseItems, entry);
  await writeAppStorageBlob(QUIZ_LIBRARY_INDEX_BLOB, index);
}

async function readIndex(): Promise<LibraryIndex> {
  if (shouldWriteBlob()) {
    const fromBlob = await readAppStorageBlob<LibraryIndex>(QUIZ_LIBRARY_INDEX_BLOB);
    if (fromBlob?.items?.length) return fromBlob;
  }
  const index = await readIndexFromBlobOrLocal();
  if (index.items.length) return index;
  try {
    const migrated = await migrateLegacyMonolithicStore();
    if (migrated.length) return { items: migrated.map(toIndexEntry) };
  } catch (error) {
    console.error("migrateLegacyMonolithicStore from blob/local failed:", error);
  }
  return index;
}

async function readQuizById(id: string): Promise<QuizLibraryItem | null> {
  if (shouldWriteBlob()) {
    const fromBlob = await readAppStorageBlob<QuizLibraryItem>(quizLibraryItemBlobName(id));
    if (fromBlob) return fromBlob;
  }
  const fromBlob = await readAppStorageBlob<QuizLibraryItem>(quizLibraryItemBlobName(id));
  if (fromBlob) return fromBlob;
  return readLocalItem(id);
}

async function persistQuizIndexItems(items: QuizLibraryIndexEntry[]): Promise<void> {
  const sorted = [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  if (shouldWriteBlob()) {
    await writeAppStorageBlob(QUIZ_LIBRARY_INDEX_BLOB, { items: sorted });
    return;
  }
  if (process.env.VERCEL) {
    throw new Error("Nepodarilo sa uložiť zoznam kvízov — nastav Blob vo Verceli.");
  }
  writeLocalIndex({ items: sorted });
}

async function persistQuiz(quiz: QuizLibraryItem): Promise<void> {
  const normalized = normalizeLibraryQuiz(quiz);
  const entry = toIndexEntry(normalized);

  if (shouldWriteBlob()) {
    await writeQuizBlobPair(normalized, entry);
    return;
  }

  if (process.env.VERCEL) {
    throw new Error("Nepodarilo sa uložiť kvíz — Blob nie je nastavený.");
  }

  writeLocalItem(normalized);
  const index = readLocalIndex();
  writeLocalIndex({
    items: [...index.items.filter((item) => item.id !== normalized.id), entry].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt)
    ),
  });
}

async function loadAllQuizzes(): Promise<QuizLibraryItem[]> {
  const index = await readIndex();
  const quizzes: QuizLibraryItem[] = [];
  for (const entry of index.items) {
    const quiz = await readQuizById(entry.id);
    if (quiz) quizzes.push(quiz);
  }
  return migrateLegacyDecks(quizzes);
}

export async function readAllLibraryQuizzes(): Promise<QuizLibraryItem[]> {
  return loadAllQuizzes();
}

export async function readLibraryQuiz(id: string): Promise<QuizLibraryItem | null> {
  return readQuizById(id);
}

export async function createLibraryQuiz(title?: string): Promise<QuizLibraryItem> {
  const quiz = defaultLibraryQuiz(title?.trim() || "Nový kvíz");
  await persistQuiz(quiz);
  return quiz;
}

function countFilledQuestions(quiz: QuizLibraryItem | null | undefined): number {
  if (!quiz?.questions?.length) return 0;
  return quiz.questions.filter((q) => q.body.trim() || q.answer.trim() || q.audioUrl?.trim() || q.videoUrl?.trim()).length;
}

export async function saveLibraryQuiz(input: Partial<QuizLibraryItem>): Promise<QuizLibraryItem> {
  const existing = input.id ? await readQuizById(input.id) : null;
  const merged: Partial<QuizLibraryItem> = {
    ...existing,
    ...input,
    id: input.id || existing?.id,
    createdAt: existing?.createdAt,
  };

  if (input.usedBankQuestionIds === undefined && existing?.usedBankQuestionIds?.length) {
    merged.usedBankQuestionIds = existing.usedBankQuestionIds;
  }

  const existingFilled = countFilledQuestions(existing);
  const incomingFilled = countFilledQuestions(merged as QuizLibraryItem);
  if (existingFilled >= 5 && incomingFilled < Math.max(3, existingFilled - 5)) {
    throw new Error(
      `Uloženie zrušené — v kvíze by ostalo len ${incomingFilled} vyplnených otázok (predtým ${existingFilled}). Obnov stránku alebo zálohu.`
    );
  }

  if (existing?.questions?.length) {
    try {
      await writeQuizLibraryBackup(existing);
    } catch (error) {
      console.error("writeQuizLibraryBackup before save failed:", error);
    }
  }

  const normalized = normalizeLibraryQuiz(merged);
  await persistQuiz(normalized);
  return normalized;
}

export async function restoreLibraryQuizFromBackup(id: string): Promise<QuizLibraryItem | null> {
  const backup = await readQuizLibraryBackup(id);
  if (!backup) return null;
  await persistQuiz(backup);
  return backup;
}

export { readQuizLibraryBackup };

export async function deleteLibraryQuiz(id: string): Promise<boolean> {
  const existing = await readQuizById(id);
  if (!existing) return false;

  if (shouldWriteBlob()) {
    await deleteAppStorageBlob(quizLibraryItemBlobName(id));
  } else {
    deleteLocalItem(id);
  }

  const index = await readIndex();
  await persistQuizIndexItems(index.items.filter((item) => item.id !== id));
  return true;
}
