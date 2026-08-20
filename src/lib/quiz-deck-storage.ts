import fs from "fs";
import path from "path";
import type { QuizDeck } from "@/lib/quiz-deck";
import { defaultDeck, normalizeQuizDeck } from "@/lib/quiz-deck";
import {
  hasSupabaseStorage,
  supabaseFetchQuizDecks,
  supabaseSetQuizDecks,
} from "@/lib/supabase-storage";

const localPath = path.join(process.cwd(), "src/data/quiz-decks.local.json");

type DeckStore = { decks: QuizDeck[] };

function readLocalDecks(): DeckStore {
  try {
    if (!fs.existsSync(localPath)) return { decks: [] };
    const raw = fs.readFileSync(localPath, "utf-8");
    const data = JSON.parse(raw) as DeckStore;
    return { decks: Array.isArray(data.decks) ? data.decks : [] };
  } catch {
    return { decks: [] };
  }
}

function writeLocalDecks(store: DeckStore): void {
  fs.mkdirSync(path.dirname(localPath), { recursive: true });
  fs.writeFileSync(localPath, JSON.stringify(store, null, 2), "utf-8");
}

async function loadAllDecks(): Promise<QuizDeck[]> {
  if (hasSupabaseStorage()) {
    const result = await supabaseFetchQuizDecks();
    if (result.status === "ok") {
      return (result.value.decks ?? []) as QuizDeck[];
    }
    if (result.status === "error") {
      throw new Error(`Nepodarilo sa načítať prezentácie: ${result.message}`);
    }
    return [];
  }
  return readLocalDecks().decks;
}

async function persistAllDecks(decks: QuizDeck[]): Promise<void> {
  if (hasSupabaseStorage()) {
    await supabaseSetQuizDecks({ decks });
    return;
  }
  writeLocalDecks({ decks });
}

export async function readAllQuizDecks(): Promise<QuizDeck[]> {
  return loadAllDecks();
}

export async function readQuizDeck(eventSlug: string, venueTitle: string): Promise<QuizDeck> {
  const decks = await loadAllDecks();
  const found = decks.find((deck) => deck.eventSlug === eventSlug);
  if (found) return found;
  return defaultDeck(eventSlug, venueTitle);
}

export async function saveQuizDeck(deck: QuizDeck): Promise<QuizDeck> {
  const normalized = normalizeQuizDeck(deck, deck.eventSlug, deck.venueTitle);
  const decks = await loadAllDecks();
  const idx = decks.findIndex((entry) => entry.eventSlug === normalized.eventSlug);
  const next = [...decks];
  if (idx === -1) next.push(normalized);
  else next[idx] = normalized;
  await persistAllDecks(next);
  return normalized;
}
