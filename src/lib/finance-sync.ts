import { createHash, timingSafeEqual } from "crypto";
import {
  isQuizVisible,
  sortEventsForAdminOverview,
  type QuizEvent,
} from "@/lib/data";
import { isExternalEvent } from "@/lib/event-normalize";
import { groupRegistrationsByTerm, normalizeFutureQuizzes } from "@/lib/future-quizzes";
import {
  mergeRegistrationsWithPayBookings,
  type AdminRegistrationView,
} from "@/lib/pay-admin";
import type { PayTeam } from "@/lib/pay-domain";
import { isPayStagingEventSlug } from "@/lib/pay-storage";
import { quizStatFromResult } from "@/lib/quiz-stats";
import { quizTypeOrDefault } from "@/lib/quiz-type";
import {
  dedupeRegistrationsPreferNewest,
  estimatedEntryRevenue,
  parseRegistrationPlayerCount,
} from "@/lib/registration-utils";
import type { Registration } from "@/lib/storage";

export type FinanceBearerAuthResult =
  | { ok: true }
  | { ok: false; status: 401 | 503; error: string };

export type FinanceUpcomingIncomeItem = {
  external_key: string;
  event_slug: string;
  venue: string;
  city: string;
  quiz_type: string;
  expected_date: string;
  time: string;
  entry_fee: number;
  teams_count: number;
  players_count: number;
  estimated_amount: number;
  paid_seats: number;
  pending_seats: number;
};

export type FinanceRecentPlayedItem = {
  external_key: string;
  event_slug: string;
  venue: string;
  city: string;
  quiz_type: string;
  expected_date: string;
  entry_fee: number;
  teams_count: number;
  players_count: number;
  actual_amount: number;
};

export type FinanceExpectedIncomesResponse = {
  generated_at: string;
  currency: "EUR";
  totals: {
    upcoming_terms: number;
    teams_count: number;
    players_count: number;
    estimated_amount: number;
  };
  upcoming: FinanceUpcomingIncomeItem[];
  recent_played: FinanceRecentPlayedItem[];
};

const BRATISLAVA_TZ = "Europe/Bratislava";
const DEFAULT_RECENT_PLAYED_DAYS = 14;

export function verifyFinanceBearerToken(
  authHeader: string | null | undefined,
  expectedToken: string | undefined
): FinanceBearerAuthResult {
  const expected = expectedToken?.trim() ?? "";
  if (!expected) {
    return {
      ok: false,
      status: 503,
      error: "FINANCE_SYNC_TOKEN nie je nakonfigurovaný.",
    };
  }

  const match = (authHeader ?? "").trim().match(/^Bearer\s+(.+)$/i);
  const provided = match?.[1]?.trim() ?? "";
  if (!provided) {
    return { ok: false, status: 401, error: "Neautorizovaný prístup." };
  }

  const expectedDigest = createHash("sha256").update(expected, "utf8").digest();
  const providedDigest = createHash("sha256").update(provided, "utf8").digest();
  if (!timingSafeEqual(expectedDigest, providedDigest)) {
    return { ok: false, status: 401, error: "Neautorizovaný prístup." };
  }

  return { ok: true };
}

function bratislavaDateParts(now: Date): Record<string, string> {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: BRATISLAVA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZoneName: "longOffset",
  }).formatToParts(now);

  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  return map;
}

export function bratislavaTodayIso(now: Date = new Date()): string {
  const parts = bratislavaDateParts(now);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function formatBratislavaIsoTimestamp(now: Date = new Date()): string {
  const parts = bratislavaDateParts(now);
  const rawOffset = parts.timeZoneName ?? "GMT";
  const offset = rawOffset === "GMT" ? "+00:00" : rawOffset.replace(/^GMT/, "");
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${offset}`;
}

export function skDateToIso(date: string | undefined | null): string | null {
  const match = String(date ?? "")
    .trim()
    .match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function subtractIsoDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d - days));
  return `${String(dt.getUTCFullYear()).padStart(4, "0")}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

function roundEur(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/**
 * Only active, non-external, non-test/staging events with a positive entry fee
 * contribute to expected quiz incomes.
 */
export function isFinanceEligibleEvent(event: QuizEvent): boolean {
  if (!event.slug?.trim()) return false;
  if (!isQuizVisible(event)) return false;
  if (isExternalEvent(event)) return false;
  if (isPayStagingEventSlug(event.slug)) return false;
  const fee = Number(event.entryFee);
  return Number.isFinite(fee) && fee > 0;
}

export function buildFinanceExpectedIncomes(input: {
  events: QuizEvent[];
  registrations: Registration[];
  payTeams: PayTeam[];
  now?: Date;
  recentDays?: number;
}): FinanceExpectedIncomesResponse {
  const now = input.now ?? new Date();
  const recentDays = Math.max(0, input.recentDays ?? DEFAULT_RECENT_PLAYED_DAYS);
  const todayIso = bratislavaTodayIso(now);
  const recentCutoffIso = subtractIsoDays(todayIso, recentDays);

  // Pure in-memory equivalent of admin/registrations sanitization (zero writes).
  const { kept: dedupedRegistrations } = dedupeRegistrationsPreferNewest(input.registrations);
  const cleanPayTeams = input.payTeams.filter(
    (team) => team.status !== "cancelled" && !team.mock && !isPayStagingEventSlug(team.eventSlug)
  );
  const mergedRegs = mergeRegistrationsWithPayBookings(dedupedRegistrations, cleanPayTeams);

  const sortedEvents = sortEventsForAdminOverview(input.events);
  const knownSlugs = new Set(sortedEvents.map((event) => event.slug));
  const regsBySlug = new Map<string, AdminRegistrationView[]>();
  const assignedIds = new Set<string>();

  // Pass 1: exact eventSlug match across all events so inactive/external/test
  // registrations never fall back onto another venue by name.
  for (const reg of mergedRegs) {
    const slug = (reg.eventSlug ?? "").trim();
    if (!slug || !knownSlugs.has(slug)) continue;
    const bucket = regsBySlug.get(slug) ?? [];
    bucket.push(reg);
    regsBySlug.set(slug, bucket);
    assignedIds.add(reg.id);
  }

  // Pass 2: legacy classic registrations without a known eventSlug match by venue.
  for (const event of sortedEvents) {
    if (!isFinanceEligibleEvent(event)) continue;
    const venueLower = event.venue.trim().toLowerCase();
    if (!venueLower) continue;
    for (const reg of mergedRegs) {
      if (assignedIds.has(reg.id)) continue;
      if (reg.source === "pay") continue;
      if ((reg.venue ?? "").trim().toLowerCase() !== venueLower) continue;
      const bucket = regsBySlug.get(event.slug) ?? [];
      bucket.push(reg);
      regsBySlug.set(event.slug, bucket);
      assignedIds.add(reg.id);
    }
  }

  const upcomingByKey = new Map<string, FinanceUpcomingIncomeItem>();
  const recentByKey = new Map<string, FinanceRecentPlayedItem>();

  for (const event of sortedEvents) {
    if (!isFinanceEligibleEvent(event)) continue;

    const entryFee = roundEur(Number(event.entryFee));
    const eventRegs = regsBySlug.get(event.slug) ?? [];
    const groups = groupRegistrationsByTerm(eventRegs, event);
    const extrasById = new Map(
      normalizeFutureQuizzes(event.futureQuizzes).map((quiz) => [quiz.id, quiz])
    );

    for (const group of groups) {
      if (group.registrations.length === 0) continue;
      const expectedDate = skDateToIso(group.date);
      if (!expectedDate || expectedDate < todayIso) continue;

      const playersCount = group.registrations.reduce(
        (sum, reg) => sum + parseRegistrationPlayerCount(reg.players),
        0
      );
      const estimatedAmount = estimatedEntryRevenue(entryFee, playersCount);
      if (estimatedAmount <= 0) continue;

      const extra = group.key !== "nearest" ? extrasById.get(group.key) : undefined;
      const time = (extra?.time || event.time || "19:00").trim();
      const quizType = quizTypeOrDefault(extra ? extra.quizType : event.quizType);
      const paidSeats = group.registrations.reduce((sum, reg) => sum + (reg.paidSeats ?? 0), 0);
      const pendingSeats = group.registrations.reduce(
        (sum, reg) => sum + (reg.pendingSeats ?? 0),
        0
      );
      const externalKey = `mudrc:${event.slug}:${expectedDate}`;

      const existing = upcomingByKey.get(externalKey);
      if (existing) {
        const mergedPlayers = existing.players_count + playersCount;
        existing.teams_count += group.registrations.length;
        existing.players_count = mergedPlayers;
        existing.estimated_amount = estimatedEntryRevenue(entryFee, mergedPlayers);
        existing.paid_seats += paidSeats;
        existing.pending_seats += pendingSeats;
      } else {
        upcomingByKey.set(externalKey, {
          external_key: externalKey,
          event_slug: event.slug,
          venue: event.venue,
          city: event.city,
          quiz_type: quizType,
          expected_date: expectedDate,
          time,
          entry_fee: entryFee,
          teams_count: group.registrations.length,
          players_count: playersCount,
          estimated_amount: estimatedAmount,
          paid_seats: paidSeats,
          pending_seats: pendingSeats,
        });
      }
    }

    if (recentDays > 0) {
      for (const result of event.pastResults ?? []) {
        const expectedDate = skDateToIso(result.date);
        if (!expectedDate || expectedDate < recentCutoffIso || expectedDate > todayIso) continue;

        const stat = quizStatFromResult(event, result);
        if (stat.estimated || stat.earned <= 0) continue;

        const externalKey = `mudrc:${event.slug}:${expectedDate}`;
        const teamsCount = Array.isArray(result.teams) ? result.teams.length : 0;
        const existing = recentByKey.get(externalKey);
        if (existing) {
          const mergedPlayers = existing.players_count + stat.players;
          existing.teams_count += teamsCount;
          existing.players_count = mergedPlayers;
          existing.actual_amount = estimatedEntryRevenue(entryFee, mergedPlayers);
        } else {
          recentByKey.set(externalKey, {
            external_key: externalKey,
            event_slug: event.slug,
            venue: event.venue,
            city: event.city,
            quiz_type: stat.quizType,
            expected_date: expectedDate,
            entry_fee: entryFee,
            teams_count: teamsCount,
            players_count: stat.players,
            actual_amount: stat.earned,
          });
        }
      }
    }
  }

  const upcoming = Array.from(upcomingByKey.values()).sort(
    (a, b) =>
      a.expected_date.localeCompare(b.expected_date) ||
      a.time.localeCompare(b.time) ||
      a.venue.localeCompare(b.venue, "sk") ||
      a.external_key.localeCompare(b.external_key)
  );

  const recent_played = Array.from(recentByKey.values()).sort(
    (a, b) =>
      b.expected_date.localeCompare(a.expected_date) ||
      a.venue.localeCompare(b.venue, "sk") ||
      a.external_key.localeCompare(b.external_key)
  );

  const totals = {
    upcoming_terms: upcoming.length,
    teams_count: upcoming.reduce((sum, item) => sum + item.teams_count, 0),
    players_count: upcoming.reduce((sum, item) => sum + item.players_count, 0),
    estimated_amount: roundEur(
      upcoming.reduce((sum, item) => sum + item.estimated_amount, 0)
    ),
  };

  return {
    generated_at: formatBratislavaIsoTimestamp(now),
    currency: "EUR",
    totals,
    upcoming,
    recent_played,
  };
}
