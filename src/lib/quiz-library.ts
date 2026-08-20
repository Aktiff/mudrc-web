import type { QuizSlide, QuizSlideType } from "@/lib/quiz-deck";
import { createEmptySlide, createSlideId } from "@/lib/quiz-deck";
import { teamKey } from "@/lib/poll";

export type { QuizSlide, QuizSlideType };

export type QuizLibraryItem = {
  id: string;
  title: string;
  slides: QuizSlide[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type QuizUsage = {
  eventSlug: string;
  venue: string;
  city: string;
  date: string;
  quizResultId: string;
  winnerTeam: string;
  teamNames: string[];
};

export function createLibraryQuizId(): string {
  return `quiz-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function defaultLibraryQuiz(title = "Nový kvíz"): QuizLibraryItem {
  const now = new Date().toISOString();
  return {
    id: createLibraryQuizId(),
    title,
    createdAt: now,
    updatedAt: now,
    slides: [
      { ...createEmptySlide("title"), title: "MUDRC KVÍZ", subtitle: title },
      { ...createEmptySlide("round"), title: "Kolo 1", roundNumber: 1 },
      {
        ...createEmptySlide("question"),
        title: "1. Otázka",
        body: "Sem napíš text otázky…",
        answer: "Správna odpoveď",
      },
      { ...createEmptySlide("text"), title: "Prestávka", body: "Zber odpovedí — pripravte sa na ďalšie kolo." },
      { ...createEmptySlide("scores"), title: "Finále", body: "Po zadaní bodov spustite odhalenie tabuľky." },
    ],
  };
}

export function normalizeLibraryQuiz(input: Partial<QuizLibraryItem>): QuizLibraryItem {
  const title = input.title?.trim() || "Bez názvu";
  const now = new Date().toISOString();
  const slides = Array.isArray(input.slides)
    ? input.slides
        .filter((slide): slide is QuizSlide => Boolean(slide && typeof slide === "object" && slide.id && slide.type))
        .map((slide) => ({
          id: String(slide.id),
          type: slide.type as QuizSlideType,
          title: slide.title?.trim() || undefined,
          subtitle: slide.subtitle?.trim() || undefined,
          body: slide.body?.trim() || undefined,
          answer: slide.answer?.trim() || undefined,
          imageUrl: slide.imageUrl?.trim() || undefined,
          roundNumber: typeof slide.roundNumber === "number" ? slide.roundNumber : undefined,
        }))
    : defaultLibraryQuiz(title).slides;

  return {
    id: input.id?.trim() || createLibraryQuizId(),
    title,
    notes: input.notes?.trim() || undefined,
    slides: slides.length ? slides : defaultLibraryQuiz(title).slides,
    createdAt: input.createdAt || now,
    updatedAt: now,
  };
}

export function parseTeamFilterInput(raw: string): string[] {
  return raw
    .split(/[\n,;]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function getConflictingTeams(playedTeamNames: string[], filterTeams: string[]): string[] {
  const played = new Set(playedTeamNames.map((name) => teamKey(name)));
  const seen = new Set<string>();
  const conflicts: string[] = [];
  for (const team of filterTeams) {
    const key = teamKey(team);
    if (!played.has(key) || seen.has(key)) continue;
    seen.add(key);
    conflicts.push(team);
  }
  return conflicts;
}

export function isQuizSafeForTeams(playedTeamNames: string[], filterTeams: string[]): boolean {
  if (!filterTeams.length) return true;
  return getConflictingTeams(playedTeamNames, filterTeams).length === 0;
}

export function collectPlayedTeamNames(usages: QuizUsage[]): string[] {
  const names: string[] = [];
  for (const usage of usages) {
    names.push(...usage.teamNames);
  }
  return names;
}
