import { buildStandardMudrcQuizSlides } from "@/lib/quiz-template";

export type QuizSlideType =
  | "title"
  | "rules"
  | "round"
  | "question"
  | "music"
  | "correction"
  | "answer"
  | "text"
  | "scores";

export type QuizSlide = {
  id: string;
  type: QuizSlideType;
  title?: string;
  subtitle?: string;
  body?: string;
  answer?: string;
  imageUrl?: string;
  audioUrl?: string;
  roundNumber?: number;
  questionNumber?: number;
};

export type QuizDeck = {
  eventSlug: string;
  venueTitle: string;
  slides: QuizSlide[];
  updatedAt: string;
};

export function createSlideId(): string {
  return `slide-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function slideTypeLabel(type: QuizSlideType): string {
  switch (type) {
    case "title":
      return "Úvod";
    case "rules":
      return "Pravidlá";
    case "round":
      return "Kolo";
    case "question":
      return "Otázka";
    case "music":
      return "Hudobná ukážka";
    case "correction":
      return "Opravovanie";
    case "answer":
      return "Správna odpoveď";
    case "text":
      return "Text / oddelenie";
    case "scores":
      return "Vyhodnotenie";
    default:
      return type;
  }
}

export function createEmptySlide(type: QuizSlideType): QuizSlide {
  const id = createSlideId();
  switch (type) {
    case "title":
      return { id, type, title: "MUDRC KVÍZ", subtitle: "" };
    case "rules":
      return { id, type, title: "Pravidlá", body: "" };
    case "round":
      return { id, type, title: "Kolo 1", roundNumber: 1 };
    case "question":
      return { id, type, title: "Otázka", body: "", answer: "" };
    case "music":
      return { id, type, title: "Hudobná ukážka", body: "", answer: "", audioUrl: "" };
    case "correction":
      return { id, type, title: "Opravovanie", body: "Skontrolujte odpovede…" };
    case "answer":
      return { id, type, title: "Správna odpoveď", body: "", answer: "" };
    case "text":
      return { id, type, title: "Oddelenie", body: "" };
    case "scores":
      return { id, type, title: "Vyhodnotenie", body: "Odhalenie tabuľky v admin → Výsledky → Prezentácia." };
  }
}

export function defaultDeck(eventSlug: string, venueTitle: string): QuizDeck {
  return {
    eventSlug,
    venueTitle,
    updatedAt: new Date().toISOString(),
    slides: buildStandardMudrcQuizSlides(),
  };
}

export function normalizeQuizDeck(input: Partial<QuizDeck>, eventSlug: string, venueTitle: string): QuizDeck {
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
          audioUrl: slide.audioUrl?.trim() || undefined,
          roundNumber: typeof slide.roundNumber === "number" ? slide.roundNumber : undefined,
          questionNumber: typeof slide.questionNumber === "number" ? slide.questionNumber : undefined,
        }))
    : [];

  return {
    eventSlug,
    venueTitle: input.venueTitle?.trim() || venueTitle,
    slides: slides.length ? slides : defaultDeck(eventSlug, venueTitle).slides,
    updatedAt: new Date().toISOString(),
  };
}
