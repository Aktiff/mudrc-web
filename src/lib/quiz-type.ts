export const DEFAULT_QUIZ_TYPE = "Všeobecný kvíz";

export function normalizeQuizTypeLabel(raw: string | undefined | null): string {
  const trimmed = String(raw ?? "").trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  return trimmed.charAt(0).toLocaleUpperCase("sk") + trimmed.slice(1).toLocaleLowerCase("sk");
}

export function quizTypeOrDefault(value: string | undefined | null): string {
  return normalizeQuizTypeLabel(value) || DEFAULT_QUIZ_TYPE;
}

/** Ak je typ kvízu pripísaný za pomlčkou v názve podniku, oddelí ho. */
export function splitVenueQuizType(venue: string, quizType?: string): { venue: string; quizType: string } {
  const place = venue.trim();
  const existing = normalizeQuizTypeLabel(quizType);
  if (existing) return { venue: place, quizType: existing };
  const match = place.match(/^(.+?)\s*[-–—]\s*(.+kvíz)\s*$/i);
  if (!match) return { venue: place, quizType: "" };
  const nextPlace = match[1].trim();
  const nextType = normalizeQuizTypeLabel(match[2]);
  if (!nextPlace || !nextType) return { venue: place, quizType: "" };
  return { venue: nextPlace, quizType: nextType };
}

export function rememberQuizTypes(values: Array<string | undefined | null>): string[] {
  const seen = new Map<string, string>();
  const add = (value: string | undefined | null) => {
    const label = normalizeQuizTypeLabel(value);
    if (!label) return;
    const key = label.toLocaleLowerCase("sk");
    if (!seen.has(key)) seen.set(key, label);
  };
  add(DEFAULT_QUIZ_TYPE);
  for (const value of values) add(value);
  return Array.from(seen.values()).sort((a, b) => a.localeCompare(b, "sk"));
}
