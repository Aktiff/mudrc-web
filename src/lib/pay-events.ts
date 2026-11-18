import type { QuizEvent } from "@/lib/data";
import {
  addDaysToSkDate,
  formatEventDateLabel,
  isQuizVisible,
  isRegistrationOpen,
  parseSkEventDateTime,
} from "@/lib/data";
import { findFutureQuiz, futureQuizMatchesDate, publicQuizCards } from "@/lib/future-quizzes";
import { getEventRegionSlug } from "@/lib/regions";
import { readEvents } from "@/lib/storage";
import { prepaidPriceEur, walkUpPriceEur } from "@/lib/pay-config";

export const PAY_STAGING_DEMO_SLUG = "pay-staging-demo";

export type PayQuizOption = {
  listingKey: string;
  eventSlug: string;
  venue: string;
  city: string;
  regionSlug: string;
  quizDate: string;
  quizTime: string;
  whenLabel: string;
  entryFee: number;
  prepaidPrice: number;
  walkUpPrice: number;
  minPlayers: number;
  maxPlayers: number;
  registrationOpen: boolean;
  started: boolean;
  /** Synthetic quiz for end-to-end pay.mudrc.sk testing */
  stagingDemo?: boolean;
};

function started(date: string, time: string): boolean {
  const at = parseSkEventDateTime(date, time);
  return at ? Date.now() >= at.getTime() : false;
}

function todaySkDate(): string {
  const now = new Date();
  return `${String(now.getDate()).padStart(2, "0")}.${String(now.getMonth() + 1).padStart(2, "0")}.${now.getFullYear()}`;
}

/** Always-open demo quiz so pay.mudrc.sk stays end-to-end testable. */
export function getPayStagingDemoQuiz(): PayQuizOption & { event: QuizEvent } {
  const fee = 4;
  const quizDate = addDaysToSkDate(todaySkDate(), 45) || "15.01.2027";
  const quizTime = "19:00";
  const event: QuizEvent = {
    slug: PAY_STAGING_DEMO_SLUG,
    venue: "Staging demo kvíz",
    city: "pay.mudrc.sk",
    address: "Mock staging — nie je reálny podnik",
    regionSlug: "prievidza",
    date: quizDate,
    time: quizTime,
    entryFee: fee,
    maxPlayers: 8,
    minPlayers: 2,
    rounds: 4,
    questions: 55,
    durationMinutes: 120,
    active: true,
    registrationOpen: true,
    rules: [
      "Každý tím môže mať od 2 do 8 hráčov.",
      "Toto je testovací termín pre mock platby na pay.mudrc.sk.",
    ],
    leagueTable: [],
    pastResults: [],
  };
  return {
    listingKey: `${PAY_STAGING_DEMO_SLUG}:${quizDate}`,
    eventSlug: PAY_STAGING_DEMO_SLUG,
    venue: event.venue,
    city: event.city,
    regionSlug: "prievidza",
    quizDate,
    quizTime,
    whenLabel: formatEventDateLabel(quizDate) + ` · ${quizTime}`,
    entryFee: fee,
    prepaidPrice: prepaidPriceEur(fee),
    walkUpPrice: walkUpPriceEur(fee),
    minPlayers: 2,
    maxPlayers: 8,
    registrationOpen: true,
    started: false,
    stagingDemo: true,
    event,
  };
}

function toOption(card: QuizEvent & { listingKey: string; termQuery?: string }): PayQuizOption {
  const quizDate = card.termQuery?.trim() || card.date;
  const quizTime = card.time;
  const fee = Number(card.entryFee) || 4;
  return {
    listingKey: card.listingKey,
    eventSlug: card.slug,
    venue: card.venue,
    city: card.city,
    regionSlug: getEventRegionSlug(card),
    quizDate,
    quizTime,
    whenLabel: formatEventDateLabel(quizDate) + (quizTime ? ` · ${quizTime}` : ""),
    entryFee: fee,
    prepaidPrice: prepaidPriceEur(fee),
    walkUpPrice: walkUpPriceEur(fee),
    minPlayers: card.minPlayers || 2,
    maxPlayers: card.maxPlayers || 8,
    registrationOpen: isRegistrationOpen(card) && !started(quizDate, quizTime),
    started: started(quizDate, quizTime),
  };
}

export async function listPayQuizzes(): Promise<PayQuizOption[]> {
  const { events } = await readEvents();
  const visible = events.filter((e) => isQuizVisible(e));
  const cards = publicQuizCards(visible).map(toOption);
  const demo = getPayStagingDemoQuiz();
  const { event: _event, ...demoOption } = demo;
  // Pin demo at top so E2E testing is obvious.
  return [demoOption, ...cards.filter((q) => q.eventSlug !== PAY_STAGING_DEMO_SLUG)];
}

export async function resolvePayQuiz(
  eventSlug: string,
  quizDate?: string
): Promise<(PayQuizOption & { event: QuizEvent }) | null> {
  if (eventSlug === PAY_STAGING_DEMO_SLUG) {
    const demo = getPayStagingDemoQuiz();
    if (quizDate?.trim() && quizDate.trim() !== demo.quizDate) {
      // Accept any future date query for the rolling demo (register form passes quizDate).
      const fee = demo.entryFee;
      const date = quizDate.trim();
      const time = demo.quizTime;
      if (started(date, time)) return null;
      return {
        ...demo,
        listingKey: `${PAY_STAGING_DEMO_SLUG}:${date}`,
        quizDate: date,
        whenLabel: formatEventDateLabel(date) + ` · ${time}`,
        registrationOpen: true,
        started: false,
        event: { ...demo.event, date },
        prepaidPrice: prepaidPriceEur(fee),
        walkUpPrice: walkUpPriceEur(fee),
      };
    }
    return demo;
  }

  const { events } = await readEvents();
  const event = events.find((e) => e.slug === eventSlug);
  if (!event || !isQuizVisible(event)) return null;

  const term = quizDate?.trim() || "";
  const future = term ? findFutureQuiz(event, term) : null;
  const isNearest = !term || futureQuizMatchesDate({ id: "", date: event.date }, term);

  let date = event.date;
  let time = event.time;
  let registrationOpen = isRegistrationOpen(event);

  if (future) {
    date = future.date;
    time = future.time || event.time;
    registrationOpen = future.registrationOpen !== false;
  } else if (!isNearest) {
    return null;
  }

  const fee = Number(event.entryFee) || 4;
  return {
    listingKey: `${event.slug}:${date}`,
    eventSlug: event.slug,
    venue: event.venue,
    city: event.city,
    regionSlug: getEventRegionSlug(event),
    quizDate: date,
    quizTime: time,
    whenLabel: formatEventDateLabel(date) + (time ? ` · ${time}` : ""),
    entryFee: fee,
    prepaidPrice: prepaidPriceEur(fee),
    walkUpPrice: walkUpPriceEur(fee),
    minPlayers: event.minPlayers || 2,
    maxPlayers: event.maxPlayers || 8,
    registrationOpen: registrationOpen && !started(date, time),
    started: started(date, time),
    event,
  };
}
