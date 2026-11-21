import type { QuizEvent } from "@/lib/data";
import {
  addDaysToSkDate,
  formatEventDateLabel,
  isQuizVisible,
  isRegistrationOpen,
  parseSkEventDateTime,
} from "@/lib/data";
import { isExternalEvent } from "@/lib/event-normalize";
import { findFutureQuiz, futureQuizMatchesDate, publicQuizCards } from "@/lib/future-quizzes";
import { getEventRegionSlug } from "@/lib/regions";
import { readEvents } from "@/lib/storage";
import {
  formatTierLadderCopy,
  pricingSnapshot,
  resolveFeeConfig,
  type FeeTierConfig,
  type PricingSnapshot,
} from "@/lib/pay-pricing";
import { PAY_STAGING_DEMO_SLUG, PAY_TEST_EVENT_SLUG } from "@/lib/pay-config";
import { ensurePayTestEvent } from "@/lib/pay-test-event";

export { PAY_STAGING_DEMO_SLUG, PAY_TEST_EVENT_SLUG };

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
  /** Current online prepaid price at request time (early or late). */
  prepaidPrice: number;
  walkUpPrice: number;
  earlyFee: number;
  lateFee: number;
  walkUpFee: number;
  feeConfig: FeeTierConfig;
  pricing: PricingSnapshot;
  tierLadderCopy: string;
  minPlayers: number;
  maxPlayers: number;
  registrationOpen: boolean;
  /** Online pay/register locked (T-10min or started). */
  onlineLocked: boolean;
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

function feeFieldsFromEvent(event: Pick<QuizEvent, "entryFee" | "earlyFee" | "lateFee" | "walkUpFee" | "earlyWindowHours" | "onlineLockMinutes">) {
  return {
    entryFee: event.entryFee,
    earlyFee: event.earlyFee,
    lateFee: event.lateFee,
    walkUpFee: event.walkUpFee,
    earlyWindowHours: event.earlyWindowHours,
    onlineLockMinutes: event.onlineLockMinutes,
  };
}

function attachPricing(base: {
  listingKey: string;
  eventSlug: string;
  venue: string;
  city: string;
  regionSlug: string;
  quizDate: string;
  quizTime: string;
  whenLabel: string;
  minPlayers: number;
  maxPlayers: number;
  registrationOpen: boolean;
  started: boolean;
  stagingDemo?: boolean;
  eventFees: ReturnType<typeof feeFieldsFromEvent>;
}): PayQuizOption {
  const feeConfig = resolveFeeConfig(base.eventFees);
  const pricing = pricingSnapshot(base.quizDate, base.quizTime, feeConfig);
  const onlineLocked = !pricing.onlineRegistrationOpen;
  return {
    listingKey: base.listingKey,
    eventSlug: base.eventSlug,
    venue: base.venue,
    city: base.city,
    regionSlug: base.regionSlug,
    quizDate: base.quizDate,
    quizTime: base.quizTime,
    whenLabel: base.whenLabel,
    entryFee: feeConfig.earlyFee,
    prepaidPrice: pricing.onlinePriceEur,
    walkUpPrice: pricing.walkUpPriceEur,
    earlyFee: feeConfig.earlyFee,
    lateFee: feeConfig.lateFee,
    walkUpFee: feeConfig.walkUpFee,
    feeConfig,
    pricing,
    tierLadderCopy: formatTierLadderCopy(feeConfig),
    minPlayers: base.minPlayers,
    maxPlayers: base.maxPlayers,
    registrationOpen: base.registrationOpen && pricing.onlineRegistrationOpen,
    onlineLocked,
    started: base.started || pricing.started,
    ...(base.stagingDemo ? { stagingDemo: true } : {}),
  };
}

/** Always-open demo quiz so pay.mudrc.sk stays end-to-end testable. */
export function getPayStagingDemoQuiz(): PayQuizOption & { event: QuizEvent } {
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
    entryFee: 4,
    earlyFee: 4,
    lateFee: 5,
    walkUpFee: 6,
    earlyWindowHours: 24,
    onlineLockMinutes: 10,
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
      "Ceny: 4 € (≥24 h) · 5 € (<24 h) · 6 € walk-up (od 10 min pred štartom).",
    ],
    leagueTable: [],
    pastResults: [],
  };
  const option = attachPricing({
    listingKey: `${PAY_STAGING_DEMO_SLUG}:${quizDate}`,
    eventSlug: PAY_STAGING_DEMO_SLUG,
    venue: event.venue,
    city: event.city,
    regionSlug: "prievidza",
    quizDate,
    quizTime,
    whenLabel: formatEventDateLabel(quizDate) + ` · ${quizTime}`,
    minPlayers: 2,
    maxPlayers: 8,
    registrationOpen: true,
    started: false,
    stagingDemo: true,
    eventFees: feeFieldsFromEvent(event),
  });
  return { ...option, event };
}

function toOption(card: QuizEvent & { listingKey: string; termQuery?: string }): PayQuizOption {
  const quizDate = card.termQuery?.trim() || card.date;
  const quizTime = card.time;
  return attachPricing({
    listingKey: card.listingKey,
    eventSlug: card.slug,
    venue: card.venue,
    city: card.city,
    regionSlug: getEventRegionSlug(card),
    quizDate,
    quizTime,
    whenLabel: formatEventDateLabel(quizDate) + (quizTime ? ` · ${quizTime}` : ""),
    minPlayers: card.minPlayers || 2,
    maxPlayers: card.maxPlayers || 8,
    registrationOpen: isRegistrationOpen(card) && !started(quizDate, quizTime),
    started: started(quizDate, quizTime),
    eventFees: feeFieldsFromEvent(card),
  });
}

export async function listPayQuizzes(): Promise<PayQuizOption[]> {
  await ensurePayTestEvent();
  const { events } = await readEvents();
  const visible = events.filter((e) => isQuizVisible(e) && !isExternalEvent(e));
  const cards = publicQuizCards(visible).map(toOption);
  const demo = getPayStagingDemoQuiz();
  const { event: _event, ...demoOption } = demo;
  const withoutSynthetic = cards.filter((q) => q.eventSlug !== PAY_STAGING_DEMO_SLUG);
  const testEvent = withoutSynthetic.filter((q) => q.eventSlug === PAY_TEST_EVENT_SLUG);
  const rest = withoutSynthetic.filter((q) => q.eventSlug !== PAY_TEST_EVENT_SLUG);
  // Real Silvester TEST event first, then other venues, synthetic fallback last.
  return [...testEvent, ...rest, demoOption];
}

export async function resolvePayQuiz(
  eventSlug: string,
  quizDate?: string
): Promise<(PayQuizOption & { event: QuizEvent }) | null> {
  if (eventSlug === PAY_TEST_EVENT_SLUG) {
    await ensurePayTestEvent();
  }
  if (eventSlug === PAY_STAGING_DEMO_SLUG) {
    const demo = getPayStagingDemoQuiz();
    if (quizDate?.trim() && quizDate.trim() !== demo.quizDate) {
      const date = quizDate.trim();
      const time = demo.quizTime;
      if (started(date, time)) return null;
      const option = attachPricing({
        listingKey: `${PAY_STAGING_DEMO_SLUG}:${date}`,
        eventSlug: PAY_STAGING_DEMO_SLUG,
        venue: demo.venue,
        city: demo.city,
        regionSlug: demo.regionSlug,
        quizDate: date,
        quizTime: time,
        whenLabel: formatEventDateLabel(date) + ` · ${time}`,
        minPlayers: demo.minPlayers,
        maxPlayers: demo.maxPlayers,
        registrationOpen: true,
        started: false,
        stagingDemo: true,
        eventFees: feeFieldsFromEvent(demo.event),
      });
      return { ...option, event: { ...demo.event, date } };
    }
    return demo;
  }

  const { events } = await readEvents();
  const event = events.find((e) => e.slug === eventSlug);
  if (!event || !isQuizVisible(event) || isExternalEvent(event)) return null;

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

  const option = attachPricing({
    listingKey: `${event.slug}:${date}`,
    eventSlug: event.slug,
    venue: event.venue,
    city: event.city,
    regionSlug: getEventRegionSlug(event),
    quizDate: date,
    quizTime: time,
    whenLabel: formatEventDateLabel(date) + (time ? ` · ${time}` : ""),
    minPlayers: event.minPlayers || 2,
    maxPlayers: event.maxPlayers || 8,
    registrationOpen: registrationOpen && !started(date, time),
    started: started(date, time),
    eventFees: feeFieldsFromEvent(event),
  });
  return { ...option, event };
}
