import { isCustomBankQuestionId, isGeneratedBankQuestion } from "@/lib/quiz-custom-bank";
import { filterVisibleBankQuestions, type QuizBankQuestion } from "@/lib/quiz-question-bank";

/** Celá textová banka (vlastné + vygenerované), bez otázok už vložených v kvíze. */
export function getFullTextBankQuestions(
  customQuestions: QuizBankQuestion[],
  hiddenIds: string[]
): QuizBankQuestion[] {
  return filterVisibleBankQuestions([], hiddenIds, customQuestions);
}

/** Otázky ponúkané na vloženie do aktuálneho kvízu. */
export function getInsertableTextBankQuestions(
  customQuestions: QuizBankQuestion[],
  usedIds: string[],
  hiddenIds: string[]
): QuizBankQuestion[] {
  return filterVisibleBankQuestions(usedIds, hiddenIds, customQuestions);
}

export function countTextBankSources(questions: QuizBankQuestion[]): {
  all: number;
  custom: number;
  generated: number;
} {
  return {
    all: questions.length,
    custom: questions.filter((q) => isCustomBankQuestionId(q.id)).length,
    generated: questions.filter((q) => isGeneratedBankQuestion(q)).length,
  };
}

export type TextBankSourceFilter = "all" | "custom" | "generated";

export function filterTextBankBySource(
  questions: QuizBankQuestion[],
  source: TextBankSourceFilter
): QuizBankQuestion[] {
  if (source === "custom") {
    return questions.filter((q) => isCustomBankQuestionId(q.id));
  }
  if (source === "generated") {
    return questions.filter((q) => isGeneratedBankQuestion(q));
  }
  return questions;
}
