export type QuizSlideType = "title" | "round" | "question" | "text" | "scores";

export type QuizSlide = {
  id: string;
  type: QuizSlideType;
  title?: string;
  subtitle?: string;
  body?: string;
  answer?: string;
  imageUrl?: string;
  roundNumber?: number;
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
    case "round":
      return "Kolo";
    case "question":
      return "Otázka";
    case "text":
      return "Text / prestávka";
    case "scores":
      return "Výsledky";
    default:
      return type;
  }
}

export function createEmptySlide(type: QuizSlideType): QuizSlide {
  const id = createSlideId();
  switch (type) {
    case "title":
      return { id, type, title: "MUDRC KVÍZ", subtitle: "" };
    case "round":
      return { id, type, title: "Kolo 1", roundNumber: 1 };
    case "question":
      return { id, type, title: "Otázka", body: "", answer: "" };
    case "text":
      return { id, type, title: "Prestávka", body: "Zber odpovedí…" };
    case "scores":
      return { id, type, title: "Výsledky", body: "Prejdite na odhalenie tabuľky v admin → Výsledky → Prezentácia." };
  }
}

export function defaultDeck(eventSlug: string, venueTitle: string): QuizDeck {
  return {
    eventSlug,
    venueTitle,
    updatedAt: new Date().toISOString(),
    slides: [
      { ...createEmptySlide("title"), title: "MUDRC KVÍZ", subtitle: venueTitle },
      { ...createEmptySlide("round"), title: "Kolo 1", roundNumber: 1 },
      { ...createEmptySlide("question"), title: "1. Otázka", body: "Sem napíš text otázky…", answer: "Správna odpoveď" },
      { ...createEmptySlide("text"), title: "Prestávka", body: "Zber odpovedí — pripravte sa na ďalšie kolo." },
      { ...createEmptySlide("round"), title: "Kolo 2", roundNumber: 2 },
      { ...createEmptySlide("question"), title: "2. Otázka", body: "Sem napíš text otázky…", answer: "Správna odpoveď" },
      { ...createEmptySlide("scores"), title: "Finále", body: "Po zadaní bodov spustite odhalenie tabuľky." },
    ],
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
          roundNumber: typeof slide.roundNumber === "number" ? slide.roundNumber : undefined,
        }))
    : [];

  return {
    eventSlug,
    venueTitle: input.venueTitle?.trim() || venueTitle,
    slides: slides.length ? slides : defaultDeck(eventSlug, venueTitle).slides,
    updatedAt: new Date().toISOString(),
  };
}
