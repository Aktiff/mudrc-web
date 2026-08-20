import fs from "fs";
import path from "path";
import type { QuizDeck } from "@/lib/quiz-deck";
import type { QuizLibraryItem } from "@/lib/quiz-library";
import { createLibraryQuizId, defaultLibraryQuiz, normalizeLibraryQuiz } from "@/lib/quiz-library";
import { readAllQuizDecks } from "@/lib/quiz-deck-storage";
import {
  hasSupabaseStorage,
  supabaseFetchQuizLibrary,
  supabaseSetQuizLibrary,
} from "@/lib/supabase-storage";

const localPath = path.join(process.cwd(), "src/data/quiz-library.local.json");

type LibraryStore = { quizzes: QuizLibraryItem[] };

function readLocalLibrary(): LibraryStore {
  try {
    if (!fs.existsSync(localPath)) return { quizzes: [] };
    const raw = fs.readFileSync(localPath, "utf-8");
    const data = JSON.parse(raw) as LibraryStore;
    return { quizzes: Array.isArray(data.quizzes) ? data.quizzes : [] };
  } catch {
    return { quizzes: [] };
  }
}

function writeLocalLibrary(store: LibraryStore): void {
  fs.mkdirSync(path.dirname(localPath), { recursive: true });
  fs.writeFileSync(localPath, JSON.stringify(store, null, 2), "utf-8");
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

async function migrateLegacyDecks(existing: QuizLibraryItem[]): Promise<QuizLibraryItem[]> {
  if (existing.length) return existing;
  const legacyDecks = await readAllQuizDecks();
  if (!legacyDecks.length) return existing;
  const migrated = legacyDecks.filter((deck) => deck.slides.length).map(deckToLibraryItem);
  if (migrated.length) await persistAllQuizzes(migrated);
  return migrated;
}

async function loadAllQuizzes(): Promise<QuizLibraryItem[]> {
  if (hasSupabaseStorage()) {
    const result = await supabaseFetchQuizLibrary();
    if (result.status === "ok") {
      const quizzes = (result.value.quizzes ?? []) as QuizLibraryItem[];
      return migrateLegacyDecks(quizzes);
    }
    if (result.status === "error") {
      throw new Error(`Nepodarilo sa načítať knižnicu kvízov: ${result.message}`);
    }
    return migrateLegacyDecks([]);
  }
  const local = readLocalLibrary().quizzes;
  return migrateLegacyDecks(local);
}

async function persistAllQuizzes(quizzes: QuizLibraryItem[]): Promise<void> {
  if (hasSupabaseStorage()) {
    await supabaseSetQuizLibrary({ quizzes });
    return;
  }
  writeLocalLibrary({ quizzes });
}

export async function readAllLibraryQuizzes(): Promise<QuizLibraryItem[]> {
  return loadAllQuizzes();
}

export async function readLibraryQuiz(id: string): Promise<QuizLibraryItem | null> {
  const quizzes = await loadAllQuizzes();
  return quizzes.find((quiz) => quiz.id === id) ?? null;
}

export async function createLibraryQuiz(title?: string): Promise<QuizLibraryItem> {
  const quiz = defaultLibraryQuiz(title?.trim() || "Nový kvíz");
  const quizzes = await loadAllQuizzes();
  await persistAllQuizzes([...quizzes, quiz]);
  return quiz;
}

export async function saveLibraryQuiz(input: Partial<QuizLibraryItem>): Promise<QuizLibraryItem> {
  const quizzes = await loadAllQuizzes();
  const existing = input.id ? quizzes.find((quiz) => quiz.id === input.id) : undefined;
  const normalized = normalizeLibraryQuiz({
    ...existing,
    ...input,
    id: input.id || existing?.id,
    createdAt: existing?.createdAt,
  });
  const idx = quizzes.findIndex((quiz) => quiz.id === normalized.id);
  const next = [...quizzes];
  if (idx === -1) next.push(normalized);
  else next[idx] = normalized;
  await persistAllQuizzes(next);
  return normalized;
}

export async function deleteLibraryQuiz(id: string): Promise<boolean> {
  const quizzes = await loadAllQuizzes();
  const next = quizzes.filter((quiz) => quiz.id !== id);
  if (next.length === quizzes.length) return false;
  await persistAllQuizzes(next);
  return true;
}
