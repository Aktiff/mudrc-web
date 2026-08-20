import fs from "fs";
import path from "path";
import type { QuizDeck } from "@/lib/quiz-deck";
import type { QuizLibraryItem } from "@/lib/quiz-library";
import { createLibraryQuizId, defaultLibraryQuiz, normalizeLibraryQuiz } from "@/lib/quiz-library";
import { readAllQuizDecks } from "@/lib/quiz-deck-storage";
import {
  hasSupabaseStorage,
  supabaseDeleteQuizLibraryItem,
  supabaseFetchQuizLibrary,
  supabaseFetchQuizLibraryIndex,
  supabaseFetchQuizLibraryItem,
  supabaseSetQuizLibraryIndex,
  supabaseSetQuizLibraryItem,
} from "@/lib/supabase-storage";

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
    slideCount: quiz.slides.length,
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
  if (!hasSupabaseStorage()) return [];
  const legacy = await supabaseFetchQuizLibrary();
  if (legacy.status !== "ok") return [];
  const quizzes = (legacy.value.quizzes ?? []) as QuizLibraryItem[];
  if (!quizzes.length) return [];
  for (const quiz of quizzes) {
    await supabaseSetQuizLibraryItem(quiz.id, quiz);
  }
  await supabaseSetQuizLibraryIndex({ items: quizzes.map(toIndexEntry) });
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

async function readIndex(): Promise<LibraryIndex> {
  if (hasSupabaseStorage()) {
    let result = await supabaseFetchQuizLibraryIndex();
    if (result.status === "missing") {
      await migrateLegacyMonolithicStore();
      result = await supabaseFetchQuizLibraryIndex();
    }
    if (result.status === "ok") {
      return { items: (result.value.items ?? []) as QuizLibraryIndexEntry[] };
    }
    if (result.status === "error") {
      throw new Error(`Nepodarilo sa načítať index kvízov: ${result.message}`);
    }
    return { items: [] };
  }
  return readLocalIndex();
}

async function readQuizById(id: string): Promise<QuizLibraryItem | null> {
  if (hasSupabaseStorage()) {
    const result = await supabaseFetchQuizLibraryItem(id);
    if (result.status === "ok") return result.value as QuizLibraryItem;
    if (result.status === "error") {
      throw new Error(`Nepodarilo sa načítať kvíz ${id}: ${result.message}`);
    }
    return null;
  }
  return readLocalItem(id);
}

async function persistQuiz(quiz: QuizLibraryItem): Promise<void> {
  const normalized = normalizeLibraryQuiz(quiz);
  if (hasSupabaseStorage()) {
    await supabaseSetQuizLibraryItem(normalized.id, normalized);
    const index = await readIndex();
    const entry = toIndexEntry(normalized);
    const items = [...index.items.filter((item) => item.id !== normalized.id), entry].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt)
    );
    await supabaseSetQuizLibraryIndex({ items });
    return;
  }
  writeLocalItem(normalized);
  const index = readLocalIndex();
  const entry = toIndexEntry(normalized);
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

export async function saveLibraryQuiz(input: Partial<QuizLibraryItem>): Promise<QuizLibraryItem> {
  const existing = input.id ? await readQuizById(input.id) : null;
  const normalized = normalizeLibraryQuiz({
    ...existing,
    ...input,
    id: input.id || existing?.id,
    createdAt: existing?.createdAt,
  });
  await persistQuiz(normalized);
  return normalized;
}

export async function deleteLibraryQuiz(id: string): Promise<boolean> {
  const existing = await readQuizById(id);
  if (!existing) return false;

  if (hasSupabaseStorage()) {
    await supabaseDeleteQuizLibraryItem(id);
    const index = await readIndex();
    await supabaseSetQuizLibraryIndex({ items: index.items.filter((item) => item.id !== id) });
  } else {
    deleteLocalItem(id);
    const index = readLocalIndex();
    writeLocalIndex({ items: index.items.filter((item) => item.id !== id) });
  }
  return true;
}
