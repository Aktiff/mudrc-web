import type { QuizEvent } from "@/lib/data";
import { DEFAULT_REGION, isRegionSlug } from "@/lib/regions";

export function slugifyEvent(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
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
    maxPlayers: Number(body.maxPlayers) || 8,
    minPlayers: Number(body.minPlayers) || 2,
    rounds: Number(body.rounds) || 4,
    questions: Number(body.questions) || 55,
    durationMinutes: Number(body.durationMinutes) || 120,
    active: body.active !== false,
    leagueActive: body.leagueActive !== false,
    registrationOpen: body.registrationOpen !== false,
    imageUrl: String(body.imageUrl ?? "").trim(),
    rules: Array.isArray(body.rules) ? body.rules.map(String) : [],
    leagueTable: Array.isArray(body.leagueTable) ? body.leagueTable : [],
    pastResults: Array.isArray(body.pastResults) ? body.pastResults : [],
  };
}

export function isValidStoredEvent(event: QuizEvent): boolean {
  return Boolean(event.slug?.trim() && event.venue?.trim());
}
