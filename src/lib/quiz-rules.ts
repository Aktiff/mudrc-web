export type QuizRule = {
  text: string;
  hidden?: boolean;
};

/** Staré pravidlá sú len text. Nové môžu byť dočasne skryté. */
export type StoredQuizRule = string | QuizRule;

export function normalizeQuizRules(value: unknown): QuizRule[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (typeof item === "string") return { text: item };
    if (item && typeof item === "object") {
      const text = String((item as { text?: unknown }).text ?? "");
      return (item as { hidden?: unknown }).hidden === true ? { text, hidden: true } : { text };
    }
    return { text: "" };
  });
}

export function visibleRuleTexts(value: unknown): string[] {
  return normalizeQuizRules(value)
    .filter((rule) => !rule.hidden && rule.text.trim())
    .map((rule) => rule.text.trim());
}
