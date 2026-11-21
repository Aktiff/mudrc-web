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
    earlyFee: 4,
    lateFee: 5,
    walkUpFee: 6,
    earlyWindowHours: 24,
    onlineLockMinutes: 10,
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
      "Ceny podľa času platby: 4 € (≥24 h pred štartom) · 5 € (<24 h až 10 min pred) · 6 € walk-up na mieste.",
      "Online registrácia a platba sa uzamknú 10 minút pred štartom.",
      "Storno: ≥24 h → refund 50 % zaplatenej sumy; <24 h → 0 % (PSP refund neskôr).",
    ],
    leagueTable: [],
    pastResults: [],
  });
}

let ensureInFlight: Promise<QuizEvent> | null = null;

/**
 * Create-if-missing only for the pay dry-run venue.
 * Never overwrites title/date/fees/etc. after the first insert — admin edits stick.
 * Prepaid tier fields (earlyFee/lateFee/walkUpFee) come from the seeded event
 * and remain editable like any other quiz.
 */
export async function ensurePayTestEvent(): Promise<QuizEvent> {
  if (ensureInFlight) return ensureInFlight;

  ensureInFlight = (async () => {
    const desired = buildPayTestEvent();
    try {
      const { events } = await readEvents();
      const existing = events.find((e) => e.slug === PAY_TEST_EVENT_SLUG);
      if (existing) return existing;

      const { events: next } = await updateEvents((list) => {
        if (list.some((e) => e.slug === PAY_TEST_EVENT_SLUG)) return list;
        return [...list, desired];
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
