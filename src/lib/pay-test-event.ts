import type { QuizEvent } from "@/lib/data";
import { normalizeNewEvent } from "@/lib/event-normalize";
import { readEvents, updateEvents } from "@/lib/storage";

/** Real Blob-backed test venue on mudrc.sk for pay dry-runs (Ľuboš). */
export const PAY_TEST_EVENT_SLUG = "test-platby-silvester";

export function buildPayTestEvent(): QuizEvent {
  return normalizeNewEvent({
    slug: PAY_TEST_EVENT_SLUG,
    venue: "TEST Platby — Silvester (nie reálny podnik)",
    city: "Testovacie mesto",
    address: "Testovacia 1 — len skúška predplatného / mock platby",
    regionSlug: "prievidza",
    date: "31.12.2026",
    time: "19:00",
    entryFee: 4,
    quizType: "TEST — predplatné",
    minPlayers: 2,
    maxPlayers: 8,
    rounds: 4,
    questions: 55,
    durationMinutes: 120,
    active: true,
    registrationOpen: true,
    leagueActive: false,
    rules: [
      "TOTO JE TESTOVACIA UDALOSŤ — nie je to reálny kvíz a nechodí sa na ňu.",
      "Slúži len na skúšanie registrácie tímu a mock platby (pay.mudrc.sk / /pay).",
      "Tím môže mať 2 až 8 hráčov.",
      "Vstupné 4 € / osoba (mock — bez skutočnej karty).",
    ],
    leagueTable: [],
    pastResults: [],
  });
}

let ensureInFlight: Promise<QuizEvent> | null = null;

/**
 * Idempotent: creates or refreshes the Silvester test event in Blob/local events.
 * Safe to call from public read paths (fixed slug + fixed content).
 */
export async function ensurePayTestEvent(): Promise<QuizEvent> {
  if (ensureInFlight) return ensureInFlight;

  ensureInFlight = (async () => {
    const desired = buildPayTestEvent();
    try {
      const { events } = await readEvents();
      const existing = events.find((e) => e.slug === PAY_TEST_EVENT_SLUG);
      const needsWrite =
        !existing ||
        existing.date !== desired.date ||
        existing.time !== desired.time ||
        existing.venue !== desired.venue ||
        existing.registrationOpen === false ||
        existing.active === false ||
        existing.maxPlayers !== desired.maxPlayers ||
        existing.minPlayers !== desired.minPlayers;

      if (!needsWrite && existing) return existing;

      const { events: next } = await updateEvents((list) => {
        const idx = list.findIndex((e) => e.slug === PAY_TEST_EVENT_SLUG);
        if (idx < 0) return [...list, desired];
        const copy = [...list];
        copy[idx] = {
          ...copy[idx],
          ...desired,
          // Keep any accidental league data empty for a test venue.
          leagueTable: [],
          pastResults: [],
        };
        return copy;
      });
      return next.find((e) => e.slug === PAY_TEST_EVENT_SLUG) ?? desired;
    } catch (error) {
      console.error("ensurePayTestEvent failed:", error);
      return desired;
    } finally {
      ensureInFlight = null;
    }
  })();

  return ensureInFlight;
}
