import type { QuizSlide } from "@/lib/quiz-deck";
import type { QuizQuestionItem, QuizQuestionKind } from "@/lib/quiz-library";
import { createSlideId } from "@/lib/quiz-deck";

export const MUDRC_ROUND_QUESTION_COUNTS = [15, 15, 15, 10] as const;
export const MUDRC_ROUND4_NORMAL = 5;
export const MUDRC_ROUND4_MUSIC = 5;

export const roundLabels: Record<number, string> = {
  1: "15 otázok",
  2: "15 otázok",
  3: "15 otázok",
  4: "5 otázok + 5 hudobných ukážok",
};

/** Hudba = samostatná skupina na konci 4. kola; ostatné typy zdieľajú číslovanie v kole. */
export function questionRenumberGroupKey(q: QuizQuestionItem): string {
  if (q.kind === "music") return `${q.roundNumber}-music`;
  return `${q.roundNumber}-content`;
}

/** Poradie v kvíze — v 4. kole najprv obsah (text/zvuk/video), potom hudba. */
export function compareQuizQuestions(a: QuizQuestionItem, b: QuizQuestionItem): number {
  if (a.roundNumber !== b.roundNumber) return a.roundNumber - b.roundNumber;
  if (a.roundNumber === 4) {
    const aMusic = a.kind === "music" ? 1 : 0;
    const bMusic = b.kind === "music" ? 1 : 0;
    if (aMusic !== bMusic) return aMusic - bMusic;
  }
  if (a.questionNumber !== b.questionNumber) return a.questionNumber - b.questionNumber;
  return a.id.localeCompare(b.id);
}

export function sortQuizQuestions(questions: QuizQuestionItem[]): QuizQuestionItem[] {
  return [...questions].sort(compareQuizQuestions);
}

/** Prečísluje otázky v rámci každého kola + typu na 1…n. */
export function renumberQuizQuestionGroups(questions: QuizQuestionItem[]): QuizQuestionItem[] {
  const groups = new Map<string, QuizQuestionItem[]>();
  for (const q of questions) {
    const key = questionRenumberGroupKey(q);
    const list = groups.get(key) ?? [];
    list.push(q);
    groups.set(key, list);
  }

  const out: QuizQuestionItem[] = [];
  for (const key of Array.from(groups.keys()).sort()) {
    const list = groups.get(key)!;
    list.sort(
      (a: QuizQuestionItem, b: QuizQuestionItem) =>
        a.questionNumber - b.questionNumber || a.id.localeCompare(b.id)
    );
    list.forEach((q: QuizQuestionItem, index: number) => out.push({ ...q, questionNumber: index + 1 }));
  }
  return sortQuizQuestions(out);
}

function createEmptyQuestion(
  roundNumber: number,
  questionNumber: number,
  kind: QuizQuestionKind = "normal"
): QuizQuestionItem {
  return {
    id: createSlideId(),
    roundNumber,
    questionNumber,
    kind,
    body: "",
    answer: "",
    imageUrl: "",
    audioUrl: "",
    videoUrl: "",
    imageDuringQuestion: false,
  };
}

/** Štandardný Mudrc formát — 55 slotov; zvuk/video vkladáš do ľubovoľného slotu, hudba len na konci 4. kola. */
export function buildStandardMudrcQuestions(): QuizQuestionItem[] {
  const questions: QuizQuestionItem[] = [];

  for (let round = 1; round <= 3; round += 1) {
    for (let num = 1; num <= 15; num += 1) {
      questions.push(createEmptyQuestion(round, num, "normal"));
    }
  }

  for (let num = 1; num <= MUDRC_ROUND4_NORMAL; num += 1) {
    questions.push(createEmptyQuestion(4, num, "normal"));
  }
  for (let num = 1; num <= MUDRC_ROUND4_MUSIC; num += 1) {
    questions.push(createEmptyQuestion(4, num, "music"));
  }

  return questions;
}

/** Vloží prázdnu otázku za dané číslo v kole (0 = na začiatok skupiny). */
export function insertQuestionAfter(
  questions: QuizQuestionItem[],
  roundNumber: number,
  kind: QuizQuestionKind,
  afterQuestionNumber: number
): QuizQuestionItem[] {
  const group = questions
    .filter((q) => q.roundNumber === roundNumber && q.kind === kind)
    .sort((a, b) => a.questionNumber - b.questionNumber);

  const newNumber = afterQuestionNumber + 1;
  const bumped = group.map((q) =>
    q.questionNumber >= newNumber ? { ...q, questionNumber: q.questionNumber + 1 } : q
  );
  bumped.splice(afterQuestionNumber, 0, createEmptyQuestion(roundNumber, newNumber, kind));

  const rest = questions.filter((q) => q.roundNumber !== roundNumber || q.kind !== kind);
  return sortQuizQuestions([...rest, ...bumped]);
}

/** Odstráni otázku a prečísluje zvyšok v rovnakej skupine (kolo + typ). */
export function removeQuestion(questions: QuizQuestionItem[], questionId: string): QuizQuestionItem[] {
  const target = questions.find((q) => q.id === questionId);
  if (!target) return questions;

  const remaining = questions.filter((q) => q.id !== questionId);
  const group = remaining
    .filter((q) => q.roundNumber === target.roundNumber && q.kind === target.kind)
    .sort((a, b) => a.questionNumber - b.questionNumber)
    .map((q, index) => ({ ...q, questionNumber: index + 1 }));

  const rest = remaining.filter(
    (q) => q.roundNumber !== target.roundNumber || q.kind !== target.kind
  );

  return sortQuizQuestions([...rest, ...group]);
}

/** Import starého formátu (samostatné slidy otázka + odpoveď). */
export function migrateSlidesToQuestions(slides: QuizSlide[]): QuizQuestionItem[] {
  const map = new Map<string, QuizQuestionItem>();

  const ensure = (roundNumber: number, questionNumber: number, kind: QuizQuestionKind = "normal") => {
    const key = `${roundNumber}-${questionNumber}-${kind}`;
    if (!map.has(key)) {
      map.set(key, createEmptyQuestion(roundNumber, questionNumber, kind));
    }
    return map.get(key)!;
  };

  for (const slide of slides) {
    const round = slide.roundNumber ?? 0;
    const num = slide.questionNumber ?? 0;
    if (!round || !num) continue;

    if (slide.type === "question" || slide.type === "music") {
      const kind: QuizQuestionKind = slide.type === "music" ? "music" : "normal";
      const item = ensure(round, num, kind);
      map.set(`${round}-${num}-${kind}`, {
        ...item,
        body: slide.body ?? item.body,
        answer: slide.answer?.trim() ? slide.answer : item.answer,
        imageUrl: slide.imageUrl ?? item.imageUrl,
        audioUrl: slide.audioUrl ?? item.audioUrl,
        imageDuringQuestion: Boolean(slide.imageUrl?.trim()),
      });
    }

    if (slide.type === "answer") {
      const kind: QuizQuestionKind = slide.title?.toLowerCase().includes("hudba") ? "music" : "normal";
      const item = ensure(round, num, kind);
      map.set(`${round}-${num}-${kind}`, {
        ...item,
        body: slide.body?.trim() ? slide.body : item.body,
        answer: slide.answer ?? item.answer,
      });
    }
  }

  return sortQuizQuestions(Array.from(map.values()));
}

export function describeQuizContent(questions: QuizQuestionItem[]): string {
  const normal = questions.filter((q) => q.kind === "normal").length;
  const sound = questions.filter((q) => q.kind === "sound").length;
  const video = questions.filter((q) => q.kind === "video").length;
  const music = questions.filter((q) => q.kind === "music").length;
  const rounds = new Set(questions.map((q) => q.roundNumber)).size;
  const extras = [
    sound ? `${sound} zvuk` : "",
    video ? `${video} video` : "",
    music ? `${music} hudba` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return `${questions.length} otázok · ${rounds} kolá · ${normal} klasických${extras ? ` · ${extras}` : ""}`;
}

/** @deprecated používaj buildStandardMudrcQuestions */
export function buildStandardMudrcQuizSlides(): QuizSlide[] {
  return [];
}

export function describeSlideFlow(slides: QuizSlide[]): string {
  const questions = slides.filter((s) => s.type === "question" || s.type === "music").length;
  const corrections = slides.filter((s) => s.type === "correction").length;
  return `${slides.length} slidov · ${questions} otázok · ${corrections}× opravovanie`;
}
