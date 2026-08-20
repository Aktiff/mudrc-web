import type { QuizSlide } from "@/lib/quiz-deck";
import { createEmptySlide, createSlideId } from "@/lib/quiz-deck";

export const MUDRC_ROUND_QUESTION_COUNTS = [15, 15, 15, 10] as const;
export const MUDRC_ROUND4_NORMAL = 5;
export const MUDRC_ROUND4_MUSIC = 5;

function questionSlide(round: number, num: number, kind: "normal" | "music" = "normal"): QuizSlide {
  const type = kind === "music" ? "music" : "question";
  const prefix = kind === "music" ? "Hudba" : "Otázka";
  return {
    ...createEmptySlide(type),
    title: `K${round} · ${prefix} ${num}`,
    body: "",
    answer: "",
    roundNumber: round,
    questionNumber: num,
  };
}

function answerSlide(round: number, num: number, kind: "normal" | "music" = "normal"): QuizSlide {
  const prefix = kind === "music" ? "Hudba" : "Otázka";
  return {
    ...createEmptySlide("answer"),
    title: `K${round} · ${prefix} ${num}`,
    body: "",
    answer: "",
    roundNumber: round,
    questionNumber: num,
  };
}

function roundIntro(round: number, label: string): QuizSlide {
  return {
    ...createEmptySlide("round"),
    title: `Kolo ${round}`,
    subtitle: label,
    roundNumber: round,
  };
}

function answersIntro(round: number): QuizSlide {
  return {
    ...createEmptySlide("text"),
    title: `Správne odpovede — Kolo ${round}`,
    body: "",
    roundNumber: round,
  };
}

function correctionSlide(round: number): QuizSlide {
  return {
    ...createEmptySlide("correction"),
    title: "Opravovanie",
    body: `Skontrolujte odpovede — Kolo ${round}`,
    roundNumber: round,
  };
}

/** Štandardný flow Mudrc kvízu: pravidlá → kolá → opravy → odpovede → vyhodnotenie. */
export function buildStandardMudrcQuizSlides(): QuizSlide[] {
  const slides: QuizSlide[] = [
    {
      ...createEmptySlide("rules"),
      title: "Pravidlá",
      body: "Pravidlá sa načítajú z podniku pri spustení projekcie.",
    },
  ];

  for (let round = 1; round <= 3; round += 1) {
    slides.push(roundIntro(round, "15 otázok"));
    for (let q = 1; q <= 15; q += 1) {
      slides.push(questionSlide(round, q));
    }
    slides.push(correctionSlide(round));
    slides.push(answersIntro(round));
    for (let q = 1; q <= 15; q += 1) {
      slides.push(answerSlide(round, q));
    }
  }

  slides.push(roundIntro(4, "5 otázok + 5 hudobných ukážok"));
  for (let q = 1; q <= MUDRC_ROUND4_NORMAL; q += 1) {
    slides.push(questionSlide(4, q, "normal"));
  }
  for (let q = 1; q <= MUDRC_ROUND4_MUSIC; q += 1) {
    slides.push(questionSlide(4, q, "music"));
  }
  slides.push(correctionSlide(4));
  slides.push(answersIntro(4));
  for (let q = 1; q <= MUDRC_ROUND4_NORMAL; q += 1) {
    slides.push(answerSlide(4, q, "normal"));
  }
  for (let q = 1; q <= MUDRC_ROUND4_MUSIC; q += 1) {
    slides.push(answerSlide(4, q, "music"));
  }

  slides.push({
    ...createEmptySlide("scores"),
    title: "Vyhodnotenie",
    body: "Po zadaní bodov spustite odhalenie tabuľky v admin → Výsledky → Prezentácia.",
  });

  return slides.map((slide) => ({ ...slide, id: createSlideId() }));
}

export function describeSlideFlow(slides: QuizSlide[]): string {
  const questions = slides.filter((s) => s.type === "question" || s.type === "music").length;
  const corrections = slides.filter((s) => s.type === "correction").length;
  return `${slides.length} slidov · ${questions} otázok · ${corrections}× opravovanie`;
}
