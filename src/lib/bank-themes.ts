export const DEFAULT_BANK_THEMES = ["Všeobecné", "Hudobné", "Filmové"] as const;

export const DEFAULT_BANK_THEME = DEFAULT_BANK_THEMES[0];

const FILM_HINTS = ["film", "kino", "herec", "hereč", "režis", "oscar", "seriál", "serial"];
const MUSIC_HINTS = ["hudb", "skladb", "interpret", "spev", "pesni", "piese", "album", "kapel"];

export function normalizeBankThemeName(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  return trimmed.charAt(0).toLocaleUpperCase("sk") + trimmed.slice(1);
}

export function mergeBankThemes(names: readonly unknown[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (name: string) => {
    const theme = normalizeBankThemeName(name);
    if (!theme) return;
    const key = theme.toLocaleLowerCase("sk");
    if (seen.has(key)) return;
    seen.add(key);
    out.push(theme);
  };
  for (const theme of DEFAULT_BANK_THEMES) push(theme);
  for (const name of names) {
    if (typeof name === "string") push(name);
  }
  return out;
}

export function inferBankTheme(input: {
  theme?: string;
  tags?: string[];
  body?: string;
  note?: string;
  hint?: string;
}): string {
  const explicit = normalizeBankThemeName(input.theme ?? "");
  if (explicit) return explicit;
  const hay = [input.hint, ...(input.tags ?? []), input.body, input.note]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .join(" ")
    .toLocaleLowerCase("sk");
  if (FILM_HINTS.some((word) => hay.includes(word))) return "Filmové";
  if (MUSIC_HINTS.some((word) => hay.includes(word))) return "Hudobné";
  return DEFAULT_BANK_THEME;
}

export function bankQuestionTheme(question: {
  theme?: string;
  tags?: string[];
  body?: string;
  note?: string;
}): string {
  return inferBankTheme(question);
}
