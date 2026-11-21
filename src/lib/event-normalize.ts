import type { QuizEvent } from "@/lib/data";
import { normalizeQuizRules } from "@/lib/quiz-rules";
import { DEFAULT_REGION, isRegionSlug } from "@/lib/regions";

export function slugifyEvent(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Normalize and accept only http(s) URLs. Empty string = not an external event. */
export function normalizeExternalUrl(raw: unknown): string {
  const value = String(raw ?? "").trim();
  if (!value) return "";
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    return parsed.toString();
  } catch {
    return "";
  }
}

export function isExternalEvent(event: Pick<QuizEvent, "externalUrl"> | null | undefined): boolean {
  return Boolean(normalizeExternalUrl(event?.externalUrl));
}

export function eventExternalUrl(event: Pick<QuizEvent, "externalUrl"> | null | undefined): string {
  return normalizeExternalUrl(event?.externalUrl);
}

export function normalizeNewEvent(body: Partial<QuizEvent> & { venue?: string }): QuizEvent {
  const venue = String(body.venue ?? "").trim();
  const slug = String(body.slug ?? "").trim() || slugifyEvent(venue);

  return {
    slug,
    venue,
    city: String(body.city ?? "").trim(),
    address: String(body.address ?? "").trim(),
    regionSlug: body.regionSlug && isRegionSlug(body.regionSlug) ? body.regionSlug : DEFAULT_REGION,
    date: String(body.date ?? "").trim(),
    time: String(body.time ?? "19:00").trim() || "19:00",
    entryFee: Number(body.entryFee) || 0,
    ...(body.earlyFee != null && Number.isFinite(Number(body.earlyFee))
      ? { earlyFee: Number(body.earlyFee) }
      : {}),
    ...(body.lateFee != null && Number.isFinite(Number(body.lateFee))
      ? { lateFee: Number(body.lateFee) }
      : {}),
    ...(body.walkUpFee != null && Number.isFinite(Number(body.walkUpFee))
      ? { walkUpFee: Number(body.walkUpFee) }
      : {}),
    ...(body.earlyWindowHours != null && Number.isFinite(Number(body.earlyWindowHours))
      ? { earlyWindowHours: Number(body.earlyWindowHours) }
      : {}),
    ...(body.onlineLockMinutes != null && Number.isFinite(Number(body.onlineLockMinutes))
      ? { onlineLockMinutes: Number(body.onlineLockMinutes) }
      : {}),
    quizType: String(body.quizType ?? "").trim(),
    thematic: body.thematic === true,
    specialRules: normalizeQuizRules(body.specialRules),
    maxPlayers: Number(body.maxPlayers) || 8,
    minPlayers: Number(body.minPlayers) || 2,
    rounds: Number(body.rounds) || 4,
    questions: Number(body.questions) || 55,
    durationMinutes: Number(body.durationMinutes) || 120,
    active: body.active !== false,
    leagueActive: body.leagueActive !== false,
    registrationOpen: body.registrationOpen !== false,
    externalUrl: normalizeExternalUrl(body.externalUrl),
    imageUrl: String(body.imageUrl ?? "").trim(),
    rules: normalizeQuizRules(body.rules),
    leagueTable: Array.isArray(body.leagueTable) ? body.leagueTable : [],
    pastResults: Array.isArray(body.pastResults) ? body.pastResults : [],
  };
}

export function isValidStoredEvent(event: QuizEvent): boolean {
  return Boolean(event.slug?.trim() && event.venue?.trim());
}
