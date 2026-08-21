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
