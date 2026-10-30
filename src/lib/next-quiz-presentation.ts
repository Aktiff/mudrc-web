import { parseSkEventDateTime, quizIntervalDays, type QuizEvent } from "@/lib/data";

export const MAX_NEXT_QUIZ_LINES = 5;

/** Predvolený termín najbližšieho kvízu: o 14 dní o 20:00 (lokálny čas). */
export function defaultNextQuizDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  d.setHours(20, 0, 0, 0);
  return d;
}

export function toDatetimeLocalValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${h}:${min}`;
}

export function parseDatetimeLocalValue(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Ak je názov celý VEĽKÝMI, zobrazí sa v normálnom tvare (Ratatouille Food…). */
export function normalizeShoutingVenue(venue: string): string {
  const t = venue.trim();
  if (!t) return t;
  const hasLower = /[a-záäčďéíľĺňóôřšťúýž]/.test(t);
  const hasUpper = /[A-ZÁÄČĎÉÍĽĹŇÓÔŘŠŤÚÝŽ]/.test(t);
  if (hasUpper && !hasLower) {
    return t
      .toLocaleLowerCase("sk-SK")
      .replace(/(^|[\s\-–—])([^\s\-–—])/g, (_, sep, ch: string) => sep + ch.toUpperCase());
  }
  return t;
}

/** Napr. „Alipub, Bratislava – piatok 26.9. o 20:00“ */
export function formatNextQuizLine(venue: string, date: Date, city?: string): string {
  const place = venueWithCity(venue, city);
  const weekdayRaw = date.toLocaleDateString("sk-SK", { weekday: "long" });
  const weekday = weekdayRaw.charAt(0).toUpperCase() + weekdayRaw.slice(1);
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const time = date.toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" });
  return `${place} – ${weekday} ${day}.${month}. o ${time}`;
}

function venueWithCity(venue: string, city?: string): string {
  const place = normalizeShoutingVenue(venue.trim()) || "—";
  const town = city?.trim() ?? "";
  if (!town) return place;
  const placeKey = place.toLocaleLowerCase("sk");
  const townKey = town.toLocaleLowerCase("sk");
  if (placeKey === townKey || placeKey.includes(townKey)) return place;
  return `${place}, ${town}`;
}

export function formatNextQuizLines(entries: { venue: string; at: Date; city?: string }[]): string[] {
  return [...entries]
    .filter((entry) => entry.venue.trim() && entry.at && !Number.isNaN(entry.at.getTime()))
    .sort((a, b) => a.at.getTime() - b.at.getTime() || a.venue.localeCompare(b.venue, "sk"))
    .slice(0, MAX_NEXT_QUIZ_LINES)
    .map((entry) => formatNextQuizLine(entry.venue, entry.at, entry.city));
}

function calendarDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** Podnik, v ktorom práve beží kvíz: dnešný termín, inak ten vybraný v úvode. */
export function findHomeQuizEvent(events: QuizEvent[], eventSlug: string): QuizEvent | undefined {
  const today = calendarDay(new Date());
  const todays = events.filter((event) => {
    const at = parseSkEventDateTime(event.date, event.time);
    return Boolean(at && calendarDay(at) === today);
  });
  const selectedToday = todays.find((event) => event.slug === eventSlug);
  if (selectedToday) return selectedToday;
  if (todays.length > 0) return todays[0];
  return eventSlug ? events.find((event) => event.slug === eventSlug) : undefined;
}

/**
 * Domáci podnik s dnešným alebo starším termínom sa ukáže o týždeň alebo o dva v rovnakom čase.
 * Ostatné podniky ostanú na dátume a čase z udalosti.
 */
export function nextQuizMomentForEvent(event: QuizEvent, home: boolean): Date | null {
  const at = parseSkEventDateTime(event.date, event.time);
  if (!at) return null;
  if (!home) return at;
  if (calendarDay(at) <= calendarDay(new Date())) {
    const next = new Date(at);
    next.setDate(next.getDate() + quizIntervalDays(event));
    return next;
  }
  return at;
}

/** Najbližšie budúce termíny z kalendára udalostí (aktívne). */
export function getUpcomingQuizEvents(events: QuizEvent[], limit = MAX_NEXT_QUIZ_LINES): QuizEvent[] {
  const now = Date.now();
  return events
    .filter((e) => e.active !== false)
    .map((e) => ({ e, t: parseSkEventDateTime(e.date, e.time)?.getTime() ?? Number.NaN }))
    .filter((row) => Number.isFinite(row.t) && row.t >= now - 60 * 60 * 1000)
    .sort((a, b) => a.t - b.t || a.e.venue.localeCompare(b.e.venue, "sk"))
    .slice(0, limit)
    .map((row) => row.e);
}

export function eventToDatetimeLocalValue(event: QuizEvent): string | null {
  const at = parseSkEventDateTime(event.date, event.time);
  return at ? toDatetimeLocalValue(at) : null;
}

export function defaultNextQuizDateAfter(previous: Date, index: number): Date {
  const d = new Date(previous);
  d.setDate(d.getDate() + 7 * Math.max(1, index));
  return d;
}
