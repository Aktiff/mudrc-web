export type QuizBankQuestion = {
  id: string;
  body: string;
  answer: string;
  options: string[];
  correctIndex: number;
  /** Obtiažnosť 1–10 pre tím cca 5 hráčov */
  difficulty: number;
  /** Overená poznámka / prečo je to tak */
  note: string;
  /** Tématické tagy (história, geografia, …) */
  tags: string[];
  /** Otázka určená pre slot s fotkou (5, 10 v kole — nie 15) */
  isImageQuestion?: boolean;
  /** Otvorená odpoveď bez možností A–F */
  isOpenQuestion?: boolean;
  /** Položky v správnom poradí. Do kvízu sa zamiešajú. */
  isOrderQuestion?: boolean;
};

/** Vygenerovaná banka je vypnutá. V banke ostávajú len otázky, ktoré pridáš ty. */
export const QUIZ_QUESTION_BANK_RAW: QuizBankQuestion[] = [];

export const QUIZ_QUESTION_BANK: QuizBankQuestion[] = [];

/** Sloty 5 a 10 v kole — otázka s fotkou (15. nie). */
export function isImageQuestionSlot(questionNumber: number): boolean {
  return questionNumber > 0 && questionNumber % 5 === 0 && questionNumber !== 15;
}

export function formatBankQuestionBody(item: QuizBankQuestion): string {
  const letters = ["A", "B", "C", "D", "E", "F"] as const;
  const optionsBlock = item.options
    .map((option, index) => {
      const text = option.trim();
      if (!text) return "";
      const mark = item.isOrderQuestion ? `${index + 1}.` : `${letters[index] ?? index + 1})`;
      return `${mark} ${text}`;
    })
    .filter(Boolean)
    .join("\n");
  return optionsBlock ? `${item.body}\n\n${optionsBlock}` : item.body;
}

export function formatBankQuestionClipboard(item: QuizBankQuestion): string {
  const letters = ["A", "B", "C", "D", "E", "F"] as const;
  const correctLetter = letters[item.correctIndex];
  const answerLine = item.isOrderQuestion
    ? `Správne poradie:\n${item.answer}`
    : `Správna odpoveď: ${correctLetter}) ${item.answer}`;
  return [
    formatBankQuestionBody(item),
    "",
    answerLine,
    `Obtiažnosť (tím 5): ${item.difficulty}/10`,
    "",
    `Poznámka: ${item.note}`,
  ].join("\n");
}

export const HIDDEN_BANK_STORAGE_KEY = "mudrc-hidden-bank-questions";

export function readHiddenBankQuestionIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HIDDEN_BANK_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function writeHiddenBankQuestionIds(ids: string[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(HIDDEN_BANK_STORAGE_KEY, JSON.stringify(ids));
}

export function filterVisibleBankQuestions(
  usedIds: string[],
  hiddenIds: string[],
  extraQuestions: QuizBankQuestion[] = []
): QuizBankQuestion[] {
  const skip = new Set([...usedIds, ...hiddenIds]);
  return extraQuestions.filter((item) => !skip.has(item.id));
}

export function findBankQuestionById(
  id: string,
  extraQuestions: QuizBankQuestion[] = []
): QuizBankQuestion | undefined {
  return extraQuestions.find((item) => item.id === id);
}

/** Na vloženie do kvízu — vlastná otázka z banky. */
export function findRawBankQuestionById(
  id: string,
  extraQuestions: QuizBankQuestion[] = []
): QuizBankQuestion | undefined {
  return extraQuestions.find((item) => item.id === id);
}
