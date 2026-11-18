import type { QuizEvent } from "@/lib/data";
import { formatEventDateLabel, isQuizVisible, isRegistrationOpen, parseSkEventDateTime } from "@/lib/data";
import { findFutureQuiz, futureQuizMatchesDate, publicQuizCards } from "@/lib/future-quizzes";
import { getEventRegionSlug } from "@/lib/regions";
import { readEvents } from "@/lib/storage";
import { prepaidPriceEur, walkUpPriceEur } from "@/lib/pay-config";

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
};

function started(date: string, time: string): boolean {
  const at = parseSkEventDateTime(date, time);
  return at ? Date.now() >= at.getTime() : false;
}

export async function listPayQuizzes(): Promise<PayQuizOption[]> {
  const { events } = await readEvents();
  const visible = events.filter((e) => isQuizVisible(e));
  const cards = publicQuizCards(visible);
  return cards.map((card) => {
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
  });
}

export async function resolvePayQuiz(
  eventSlug: string,
  quizDate?: string
): Promise<(PayQuizOption & { event: QuizEvent }) | null> {
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
