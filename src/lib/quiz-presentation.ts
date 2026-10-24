import { resolveMediaSrc } from "@/lib/media-url";
import type { QuizQuestionItem } from "@/lib/quiz-library";
import { compareQuizQuestions, displayQuestionNumber, roundLabels } from "@/lib/quiz-template";

export type PresentationSlide =
  | { type: "rules" }
  | { type: "round"; roundNumber: number; title: string; subtitle: string }
  | { type: "question_phase"; question: QuizQuestionItem }
  | { type: "image_slide"; question: QuizQuestionItem; media?: "image" | "video"; playUntilSeconds?: number }
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

  const roundNumbers = Array.from(new Set(questions.map((q) => q.roundNumber)))
    .filter((round) => round >= 1)
    .sort((a, b) => a - b);
  for (const round of roundNumbers) {
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
        slides.push({ type: "image_slide", question, media: "image" });
      }
      if (shouldShowVideoBeforeQuestion(question)) {
        slides.push({ type: "image_slide", question, media: "video", playUntilSeconds: videoQuestionClipSeconds(question) });
      }
      slides.push({ type: "question_phase", question });
      if (shouldShowImageOnNextSlide(question)) {
        slides.push({ type: "image_slide", question, media: "image" });
      }
      if (shouldShowVideoOnNextSlide(question)) {
        slides.push({ type: "image_slide", question, media: "video", playUntilSeconds: videoQuestionClipSeconds(question) });
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
      if (shouldShowImageBeforeAnswer(question)) {
        slides.push({ type: "image_slide", question, media: "image" });
      }
      if (shouldShowVideoBeforeAnswer(question)) {
        slides.push({ type: "image_slide", question, media: "video" });
      }
      slides.push({ type: "answer_phase", question });
      if (shouldShowImageAfterAnswer(question)) {
        slides.push({ type: "image_slide", question, media: "image" });
      }
      if (shouldShowVideoAfterAnswer(question)) {
        slides.push({ type: "image_slide", question, media: "video" });
      }
    }
  }

  slides.push({
    type: "scores",
    title: "Vyhodnotenie",
    body: "",
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
  let answerBlockFirst: number | null = null;
  let inRoundAnswerBlock = false;

  for (let i = 0; i < slides.length; i += 1) {
    const slide = slides[i];
    if (slide.type === "answers_intro" && slide.roundNumber === roundNumber) {
      inRoundAnswerBlock = true;
      continue;
    }
    if (slide.type === "round" && slide.roundNumber > roundNumber) {
      inRoundAnswerBlock = false;
    }
    if (slide.type === "scores") {
      inRoundAnswerBlock = false;
    }
    if (slide.type !== "question_phase" && slide.type !== "image_slide" && slide.type !== "answer_phase") {
      continue;
    }
    const { roundNumber: r, questionNumber: qn } = slide.question;
    if (r !== roundNumber || qn !== questionNumber) continue;
    if (!inRoundAnswerBlock && firstMatch == null) firstMatch = i;
    if (inRoundAnswerBlock && answerBlockFirst == null) answerBlockFirst = i;
  }

  if (preferAnswerPhase && answerBlockFirst != null) return answerBlockFirst;
  return firstMatch;
}

export function questionPhaseTitle(question: QuizQuestionItem): string {
  return `K${question.roundNumber} · Otázka ${displayQuestionNumber(question)}`;
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

export function shouldShowImageBeforeAnswer(question: QuizQuestionItem): boolean {
  return Boolean(question.imageUrl?.trim() && question.imageBeforeAnswer);
}

export function shouldShowImageAfterAnswer(question: QuizQuestionItem): boolean {
  return Boolean(question.imageUrl?.trim() && question.imageAfterAnswer);
}

export function videoQuestionClipSeconds(question: Pick<QuizQuestionItem, "videoQuestionSeconds">): number | undefined {
  const seconds = question.videoQuestionSeconds;
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) return undefined;
  return seconds;
}

export function shouldShowVideoBeforeQuestion(question: QuizQuestionItem): boolean {
  return Boolean(question.videoUrl?.trim() && question.videoBeforeQuestion);
}

export function shouldShowVideoInQuestionPhase(question: QuizQuestionItem): boolean {
  return Boolean(question.videoUrl?.trim() && question.videoDuringQuestion);
}

export function shouldShowVideoInAnswerPhase(question: QuizQuestionItem): boolean {
  return Boolean(question.videoUrl?.trim() && question.videoOnAnswerSlide);
}

export function shouldShowVideoOnNextSlide(question: QuizQuestionItem): boolean {
  return Boolean(question.videoUrl?.trim() && question.videoOnNextSlide);
}

export function shouldShowVideoBeforeAnswer(question: QuizQuestionItem): boolean {
  return Boolean(question.videoUrl?.trim() && question.videoBeforeAnswer);
}

export function shouldShowVideoAfterAnswer(question: QuizQuestionItem): boolean {
  return Boolean(question.videoUrl?.trim() && question.videoAfterAnswer);
}

/** Wikimedia thumb URL → plné rozlíšenie (inak ponechá pôvodnú URL). */
export function bestPresentationImageUrl(url: string): string {
  const trimmed = resolveMediaSrc(url.trim()) ?? url.trim();
  if (!trimmed) return trimmed;

  const wikiThumb = trimmed.match(
    /^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/thumb\/(.+\/)(?:\d+px-)?([^/?#]+)$/i
  );
  if (wikiThumb) {
    return `https://upload.wikimedia.org/wikipedia/commons/${wikiThumb[1]}${wikiThumb[2]}`;
  }

  return trimmed;
}
