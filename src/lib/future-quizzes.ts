import { formatEventDateLabel, parseSkEventDateTime, type FutureQuiz, type QuizEvent } from "@/lib/data";
import { normalizeDateKey } from "@/lib/quiz-result-key";
import { quizTypeOrDefault } from "@/lib/quiz-type";

export const FUTURE_QUIZ_LIMIT = 8;

export type PublicQuizCard = QuizEvent & {
  listingKey: string;
  /** Dátum špeciálneho termínu. Prázdne = najbližší bežný kvíz. */
  termQuery?: string;
};

function calendarDay(date: string): number | null {
  const parsed = parseSkEventDateTime(date);
  if (!parsed) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()).getTime();
}

function canonicalSkDate(date: string): string | null {
  const parsed = parseSkEventDateTime(date);
  if (!parsed) return null;
  const day = String(parsed.getDate()).padStart(2, "0");
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${parsed.getFullYear()}`;
}

export function normalizeFutureQuizzes(raw: unknown): FutureQuiz[] {
  if (!Array.isArray(raw)) return [];
  const byId = new Map<string, FutureQuiz>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Partial<FutureQuiz>;
    const date = canonicalSkDate(typeof row.date === "string" ? row.date : "") ?? "";
    if (!date) continue;
    const id = normalizeDateKey(date);
    if (!id || byId.has(id)) continue;
    byId.set(id, {
      id,
      date,
      time: typeof row.time === "string" && row.time.trim() ? row.time.trim() : "19:00",
      quizType: quizTypeOrDefault(row.quizType),
      registrationOpen: row.registrationOpen !== false,
    });
  }
  return Array.from(byId.values())
    .sort((a, b) => (calendarDay(a.date) ?? 0) - (calendarDay(b.date) ?? 0))
    .slice(0, FUTURE_QUIZ_LIMIT);
}

export function futureQuizMatchesDate(quiz: Pick<FutureQuiz, "date" | "id">, date: string): boolean {
  const left = calendarDay(quiz.date);
  const right = calendarDay(date);
  if (left !== null && right !== null) return left === right;
  const key = normalizeDateKey(date);
  return key !== "" && (quiz.id === key || normalizeDateKey(quiz.date) === key);
}

export function findFutureQuiz(event: Pick<QuizEvent, "futureQuizzes">, date: string | undefined | null): FutureQuiz | null {
  const term = String(date ?? "").trim();
  if (!term) return null;
  return normalizeFutureQuizzes(event.futureQuizzes).find((quiz) => futureQuizMatchesDate(quiz, term)) ?? null;
}

export function futureQuizDateError(eventDate: string, date: string, existing: FutureQuiz[]): string {
  const day = calendarDay(date);
  if (day === null) return "Zadaj platný dátum.";
  const current = calendarDay(eventDate);
  if (current !== null && day <= current) {
    return "Tento termín musí byť až po najbližšom kvíze. Ten ostane bežný.";
  }
  const today = new Date();
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  if (day < todayDay) return "Termín je v minulosti.";
  if (existing.some((quiz) => futureQuizMatchesDate(quiz, date))) return "Tento termín už v podniku je.";
  if (existing.length >= FUTURE_QUIZ_LIMIT) return `Najviac ${FUTURE_QUIZ_LIMIT} ďalších termínov.`;
  return "";
}

export function upcomingFutureQuizzes(event: Pick<QuizEvent, "futureQuizzes">): FutureQuiz[] {
  const today = new Date();
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return normalizeFutureQuizzes(event.futureQuizzes).filter((quiz) => {
    const day = calendarDay(quiz.date);
    return day !== null && day >= todayDay;
  });
}

export function publicQuizCards(events: QuizEvent[]): PublicQuizCard[] {
  const cards: PublicQuizCard[] = [];
  for (const event of events) {
    cards.push({ ...event, listingKey: event.slug });
    for (const extra of upcomingFutureQuizzes(event)) {
      cards.push({
        ...event,
        listingKey: `${event.slug}:${extra.id}`,
        date: extra.date,
        time: extra.time || event.time,
        quizType: extra.quizType,
        registrationOpen: extra.registrationOpen !== false,
        termQuery: extra.date,
      });
    }
  }
  return cards.sort((a, b) => {
    const aTime = parseSkEventDateTime(a.date, a.time)?.getTime() ?? Number.POSITIVE_INFINITY;
    const bTime = parseSkEventDateTime(b.date, b.time)?.getTime() ?? Number.POSITIVE_INFINITY;
    return aTime - bTime || a.venue.localeCompare(b.venue, "sk");
  });
}

export function eventForPublicTerm(event: QuizEvent, termin: string | undefined): QuizEvent {
  const extra = findFutureQuiz(event, termin);
  if (!extra) return event;
  return {
    ...event,
    date: extra.date,
    time: extra.time || event.time,
    quizType: extra.quizType,
    registrationOpen: extra.registrationOpen !== false,
  };
}

export type RegistrationTermGroup<T> = {
  key: string;
  date: string;
  title: string;
  registrations: T[];
};

/** Prázdny dátum patrí najbližšiemu kvízu. Ostatné termíny ostanú vo vlastnej skupine. */
export function groupRegistrationsByTerm<T extends { quizDate?: string }>(
  registrations: T[],
  event: Pick<QuizEvent, "date" | "quizType" | "futureQuizzes">
): RegistrationTermGroup<T>[] {
  const extras = normalizeFutureQuizzes(event.futureQuizzes);
  const byExtra = new Map(extras.map((quiz) => [quiz.id, [] as T[]]));
  const nearest: T[] = [];
  const stray = new Map<string, { date: string; list: T[] }>();

  for (const reg of registrations) {
    const term = reg.quizDate?.trim() ?? "";
    const extra = term ? extras.find((quiz) => futureQuizMatchesDate(quiz, term)) : undefined;
    if (extra) {
      byExtra.get(extra.id)?.push(reg);
      continue;
    }
    if (term && !futureQuizMatchesDate({ id: "", date: term }, event.date)) {
      const key = normalizeDateKey(term) || term;
      const row = stray.get(key) ?? { date: term, list: [] };
      row.list.push(reg);
      stray.set(key, row);
      continue;
    }
    nearest.push(reg);
  }

  return [
    {
      key: "nearest",
      date: event.date,
      title: `${formatEventDateLabel(event.date)} · ${quizTypeOrDefault(event.quizType)}`,
      registrations: nearest,
    },
    ...extras.map((quiz) => ({
      key: quiz.id,
      date: quiz.date,
      title: `${formatEventDateLabel(quiz.date)} · ${quiz.quizType}`,
      registrations: byExtra.get(quiz.id) ?? [],
    })),
    ...Array.from(stray.entries()).map(([key, row]) => ({
      key,
      date: row.date,
      title: formatEventDateLabel(row.date),
      registrations: row.list,
    })),
  ];
}

/** Rovnaký večer. Registrácia bez dátumu patrí k najbližšiemu termínu. */
export function registrationOnTerm(
  reg: { quizDate?: string },
  termDate: string,
  nearestDate: string
): boolean {
  const stored = reg.quizDate?.trim() || nearestDate;
  return futureQuizMatchesDate({ id: "", date: stored }, termDate);
}
