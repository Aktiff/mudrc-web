import type { QuizQuestionItem } from "@/lib/quiz-library";
import { compareQuizQuestions, roundLabels } from "@/lib/quiz-template";

export type PresentationSlide =
  | { type: "rules" }
  | { type: "round"; roundNumber: number; title: string; subtitle: string }
  | { type: "question_phase"; question: QuizQuestionItem }
  | { type: "image_slide"; question: QuizQuestionItem }
  | { type: "correction"; roundNumber: number }
  | { type: "answers_intro"; roundNumber: number; title: string }
  | { type: "answer_phase"; question: QuizQuestionItem }
  | { type: "scores"; title: string; body: string };

function sortQuestions(questions: QuizQuestionItem[]): QuizQuestionItem[] {
  return [...questions].sort(compareQuizQuestions);
}

function questionsForRound(questions: QuizQuestionItem[], roundNumber: number): QuizQuestionItem[] {
  return sortQuestions(questions.filter((q) => q.roundNumber === roundNumber));
}

export function buildPresentationSlides(questions: QuizQuestionItem[]): PresentationSlide[] {
  const slides: PresentationSlide[] = [{ type: "rules" }];

  for (let round = 1; round <= 4; round += 1) {
    const roundQuestions = questionsForRound(questions, round);
    if (!roundQuestions.length) continue;

    slides.push({
      type: "round",
      roundNumber: round,
      title: `${round}. kolo`,
      subtitle: roundLabels[round] ?? "",
    });

    for (const question of roundQuestions) {
      if (shouldShowImageBeforeQuestion(question)) {
        slides.push({ type: "image_slide", question });
      }
      slides.push({ type: "question_phase", question });
      if (shouldShowImageOnNextSlide(question)) {
        slides.push({ type: "image_slide", question });
      }
    }

    slides.push({
      type: "correction",
      roundNumber: round,
    });

    slides.push({
      type: "answers_intro",
      roundNumber: round,
      title: `Správne odpovede — Kolo ${round}`,
    });

    for (const question of roundQuestions) {
      slides.push({ type: "answer_phase", question });
    }
  }

  slides.push({
    type: "scores",
    title: "Vyhodnotenie",
    body: "Po zadaní bodov spustite odhalenie tabuľky v admin → Výsledky → Prezentácia.",
  });

  return slides;
}

export function presentationRoundAtSlide(
  slides: PresentationSlide[],
  slideIndex: number
): number {
  const slide = slides[slideIndex];
  if (!slide) return 1;

  if (slide.type === "round" || slide.type === "correction" || slide.type === "answers_intro") {
    return slide.roundNumber;
  }
  if (slide.type === "question_phase" || slide.type === "image_slide" || slide.type === "answer_phase") {
    return slide.question.roundNumber;
  }

  for (let i = slideIndex; i >= 0; i -= 1) {
    const s = slides[i];
    if (s.type === "round") return s.roundNumber;
    if (s.type === "correction" || s.type === "answers_intro") return s.roundNumber;
  }

  return 1;
}

/** Slide úvodu kola („1. kolo“). */
export function findSlideIndexForRoundIntro(
  slides: PresentationSlide[],
  roundNumber: number
): number | null {
  for (let i = 0; i < slides.length; i += 1) {
    const slide = slides[i];
    if (slide.type === "round" && slide.roundNumber === roundNumber) {
      return i;
    }
  }
  return null;
}

/** Slide otázky v kole; pri `preferAnswerPhase` skočí na správnu odpoveď, ak existuje. */
export function findSlideIndexForQuestionInRound(
  slides: PresentationSlide[],
  roundNumber: number,
  questionNumber: number,
  preferAnswerPhase = false
): number | null {
  let firstMatch: number | null = null;
  let answerMatch: number | null = null;

  for (let i = 0; i < slides.length; i += 1) {
    const slide = slides[i];
    if (slide.type !== "question_phase" && slide.type !== "image_slide" && slide.type !== "answer_phase") {
      continue;
    }
    const { roundNumber: r, questionNumber: qn } = slide.question;
    if (r !== roundNumber || qn !== questionNumber) continue;
    if (firstMatch == null) firstMatch = i;
    if (slide.type === "answer_phase") answerMatch = i;
  }

  if (preferAnswerPhase && answerMatch != null) return answerMatch;
  return firstMatch;
}

export function questionPhaseTitle(question: QuizQuestionItem): string {
  if (question.kind === "music") {
    return `K${question.roundNumber} · Hudba ${question.questionNumber}`;
  }
  if (question.kind === "sound") {
    return `K${question.roundNumber} · Zvuk ${question.questionNumber}`;
  }
  if (question.kind === "video") {
    return `K${question.roundNumber} · Video ${question.questionNumber}`;
  }
  return `K${question.roundNumber} · Otázka ${question.questionNumber}`;
}

export function shouldShowImageBeforeQuestion(question: QuizQuestionItem): boolean {
  return Boolean(question.imageUrl?.trim() && question.imageBeforeQuestion);
}

export function shouldShowImageInQuestionPhase(question: QuizQuestionItem): boolean {
  return Boolean(question.imageUrl?.trim() && question.imageDuringQuestion);
}

export function shouldShowImageInAnswerPhase(question: QuizQuestionItem): boolean {
  return Boolean(
    question.imageUrl?.trim() &&
      (question.imageDuringQuestion || question.imageOnAnswerSlide)
  );
}

export function shouldShowImageOnNextSlide(question: QuizQuestionItem): boolean {
  return Boolean(question.imageUrl?.trim() && question.imageOnNextSlide);
}

/** Wikimedia thumb URL → plné rozlíšenie (inak ponechá pôvodnú URL). */
export function bestPresentationImageUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;

  const wikiThumb = trimmed.match(
    /^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/thumb\/(.+\/)(?:\d+px-)?([^/?#]+)$/i
  );
  if (wikiThumb) {
    return `https://upload.wikimedia.org/wikipedia/commons/${wikiThumb[1]}${wikiThumb[2]}`;
  }

  return trimmed;
}
