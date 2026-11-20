import type { QuizEvent } from "@/lib/data";
import { normalizeExternalUrl, normalizeNewEvent } from "@/lib/event-normalize";
import { readEvents, updateEvents } from "@/lib/storage";

export {
  eventExternalUrl,
  isExternalEvent,
  normalizeExternalUrl,
} from "@/lib/event-normalize";

/** Public Silvester night that registers on Novella (not mudrc). */
export const EXTERNAL_SILVESTER_SLUG = "silvester-2026";
export const EXTERNAL_SILVESTER_URL =
  "https://events.novella.sk/eventy/4415f28d-942d-4f8f-8696-5c1d5165cae0";

export function buildExternalSilvesterEvent(): QuizEvent {
  return normalizeNewEvent({
    slug: EXTERNAL_SILVESTER_SLUG,
    venue: "Silvester",
    city: "Novella",
    address: "Registrácia a info na Novella — nie cez mudrc.sk",
    regionSlug: "prievidza",
    date: "31.12.2026",
    time: "19:00",
    entryFee: 0,
    quizType: "Silvesterský kvíz",
    minPlayers: 2,
    maxPlayers: 8,
    rounds: 4,
    questions: 55,
    durationMinutes: 120,
    active: true,
    registrationOpen: true,
    leagueActive: false,
    externalUrl: EXTERNAL_SILVESTER_URL,
    rules: [
      "Toto je špeciálny silvesterský kvíz — registrácia prebieha mimo mudrc.sk.",
      "Všetky informácie a prihlásenie nájdeš na stránke Novella (externý odkaz).",
    ],
    leagueTable: [],
    pastResults: [],
  });
}

let ensureInFlight: Promise<QuizEvent> | null = null;

/**
 * Idempotent: creates or refreshes the public Silvester external-link event.
 * Leaves the pay test venue (`test-platby-silvester`) alone.
 */
export async function ensureExternalSilvesterEvent(): Promise<QuizEvent> {
  if (ensureInFlight) return ensureInFlight;

  ensureInFlight = (async () => {
    const desired = buildExternalSilvesterEvent();
    try {
      const { events } = await readEvents();
      const existing = events.find((e) => e.slug === EXTERNAL_SILVESTER_SLUG);
      const needsWrite =
        !existing ||
        existing.date !== desired.date ||
        existing.time !== desired.time ||
        normalizeExternalUrl(existing.externalUrl) !== desired.externalUrl ||
        existing.active === false;

      if (!needsWrite && existing) return existing;

      const { events: next } = await updateEvents((list) => {
        const idx = list.findIndex((e) => e.slug === EXTERNAL_SILVESTER_SLUG);
        if (idx < 0) return [...list, desired];
        const copy = [...list];
        copy[idx] = {
          ...copy[idx],
          date: desired.date,
          time: desired.time,
          externalUrl: desired.externalUrl,
          active: true,
          registrationOpen: true,
          leagueActive: false,
          quizType: copy[idx].quizType?.trim() || desired.quizType,
          venue: copy[idx].venue?.trim() || desired.venue,
          city: copy[idx].city?.trim() || desired.city,
        };
        return copy;
      });
      return next.find((e) => e.slug === EXTERNAL_SILVESTER_SLUG) ?? desired;
    } catch (error) {
      console.error("ensureExternalSilvesterEvent failed:", error);
      return desired;
    } finally {
      ensureInFlight = null;
    }
  })();

  return ensureInFlight;
}
