import type { QuizQuestionItem } from "@/lib/quiz-library";
import { roundLabels } from "@/lib/quiz-template";

export type PresentationSlide =
  | { type: "rules" }
  | { type: "round"; roundNumber: number; title: string; subtitle: string }
  | { type: "question_phase"; question: QuizQuestionItem }
  | { type: "image_slide"; question: QuizQuestionItem }
  | { type: "correction"; roundNumber: number; body: string }
  | { type: "answers_intro"; roundNumber: number; title: string }
  | { type: "answer_phase"; question: QuizQuestionItem }
  | { type: "scores"; title: string; body: string };

function sortQuestions(questions: QuizQuestionItem[]): QuizQuestionItem[] {
  return [...questions].sort(
    (a, b) =>
      a.roundNumber - b.roundNumber ||
      a.questionNumber - b.questionNumber ||
      (a.kind === "music" ? 1 : 0) - (b.kind === "music" ? 1 : 0)
  );
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
      body: `Skontrolujte odpovede — Kolo ${round}`,
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

export function questionPhaseTitle(question: QuizQuestionItem): string {
  if (question.kind === "music") {
    return `K${question.roundNumber} · Hudba ${question.questionNumber}`;
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
  return Boolean(question.imageUrl?.trim() && question.imageOnAnswerSlide);
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
