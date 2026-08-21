import type { QuizQuestionItem } from "@/lib/quiz-library";

const OPTION_LINE = /^[A-F]\)\s*(.+)$/i;
const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"] as const;

export function parseEmbeddedOptions(body: string): { questionText: string; options: string[] } {
  const lines = body.split("\n");
  const options: string[] = [];
  let splitIndex = lines.length;

  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i].trim();
    if (!line) {
      if (options.length) splitIndex = i;
      continue;
    }
    const match = line.match(OPTION_LINE);
    if (match) {
      options.unshift(match[1].trim());
      splitIndex = i;
    } else {
      break;
    }
  }

  if (options.length < 2) {
    return { questionText: body.trim(), options: [] };
  }

  const questionText = lines
    .slice(0, splitIndex)
    .join("\n")
    .trim();
  return { questionText, options };
}

export function normalizeQuestionOptions(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const options = raw
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean)
    .slice(0, 6);
  return options.length ? options : undefined;
}

export function getQuestionOptions(question: QuizQuestionItem): string[] {
  if (question.options?.length) {
    return question.options.filter((option) => option.trim());
  }
  return parseEmbeddedOptions(question.body).options;
}

export function getQuestionBodyText(question: QuizQuestionItem): string {
  if (question.options?.length) {
    return question.body.trim();
  }
  const parsed = parseEmbeddedOptions(question.body);
  if (parsed.options.length) return parsed.questionText;
  return question.body.trim();
}

export function optionLetter(index: number): string {
  return OPTION_LETTERS[index] ?? String(index + 1);
}

export function findCorrectOptionIndex(options: string[], answer: string): number {
  const normalizedAnswer = answer.trim().toLowerCase();
  if (!normalizedAnswer) return -1;
  return options.findIndex((option) => option.trim().toLowerCase() === normalizedAnswer);
}

function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededUnit(seed: string, round: number): number {
  let state = (hashSeed(seed) + Math.imul(round, 2654435761)) >>> 0;
  state = Math.imul(state ^ (state >>> 16), 2246822519);
  state = Math.imul(state ^ (state >>> 13), 3266489917);
  return ((state ^ (state >>> 16)) >>> 0) / 4294967296;
}

/** Fisher-Yates s deterministickým seedom — rovnaké id = rovnaké poradie, ale vyvážené A–F v banke. */
export function shuffleQuestionOptionsDeterministic<T extends { options: string[]; correctIndex: number; answer: string }>(
  item: T,
  seed: string
): T {
  if (item.options.length < 2) return item;

  const indices = item.options.map((_, index) => index);
  for (let i = indices.length - 1; i > 0; i -= 1) {
    const j = Math.floor(seededUnit(seed, i) * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  const shuffledOptions = indices.map((index) => item.options[index]!);
  const correctSourceIndex = Math.min(Math.max(item.correctIndex, 0), item.options.length - 1);
  const newCorrectIndex = indices.indexOf(correctSourceIndex);
  const answer = item.options[correctSourceIndex] ?? item.answer;

  return {
    ...item,
    options: shuffledOptions as T["options"],
    correctIndex: newCorrectIndex >= 0 ? newCorrectIndex : item.correctIndex,
    answer,
  };
}

/** Náhodné premiešanie pri vložení — tá istá banková otázka môže mať inú pozíciu správnej odpovede. */
export function shuffleQuestionOptionsRandom<T extends { options: string[]; correctIndex: number; answer: string }>(
  item: T
): T {
  if (item.options.length < 2) return item;

  const indices = item.options.map((_, index) => index);
  for (let i = indices.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  const shuffledOptions = indices.map((index) => item.options[index]!);
  const correctSourceIndex = Math.min(Math.max(item.correctIndex, 0), item.options.length - 1);
  const newCorrectIndex = indices.indexOf(correctSourceIndex);
  const answer = item.options[correctSourceIndex] ?? item.answer;

  return {
    ...item,
    options: shuffledOptions as T["options"],
    correctIndex: newCorrectIndex >= 0 ? newCorrectIndex : item.correctIndex,
    answer,
  };
}
