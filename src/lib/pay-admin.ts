import type { PayTeam } from "@/lib/pay-domain";
import { prepaidSeatCount, teamSummary } from "@/lib/pay-domain";
import { registrationMatchesEvent } from "@/lib/registration-utils";
import type { Registration } from "@/lib/storage";

/** Admin registration row that may come from classic web signup or prepaid pay flow. */
export type AdminRegistrationView = Registration & {
  source?: "web" | "pay";
  /** Prepaid seats reserved (pending + paid). */
  reservedSeats?: number;
  paidSeats?: number;
  pendingSeats?: number;
  payStatus?: PayTeam["status"];
};

function formatCreatedAt(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString("sk-SK", { timeZone: "Europe/Bratislava" });
}

/** Map a pay booking team into the shape admin registration lists already use. */
export function payTeamToAdminRegistration(team: PayTeam): AdminRegistrationView {
  const summary = teamSummary(team);
  const reserved = prepaidSeatCount(team) || team.players || summary.total;
  return {
    id: `pay:${team.id}`,
    eventSlug: team.eventSlug,
    venue: team.venue,
    teamName: team.teamName,
    players: String(reserved),
    phone: team.captainPhone || "—",
    createdAt: formatCreatedAt(team.createdAt),
    quizDate: team.quizDate,
    source: "pay",
    reservedSeats: reserved,
    paidSeats: summary.paid,
    pendingSeats: summary.pending,
    payStatus: team.status,
  };
}

export function isPayRegistrationId(id: string): boolean {
  return id.startsWith("pay:");
}

export function payTeamIdFromRegistrationId(id: string): string | null {
  if (!isPayRegistrationId(id)) return null;
  const teamId = id.slice("pay:".length).trim();
  return teamId || null;
}

export function isPayRegistration(reg: Pick<AdminRegistrationView, "id" | "source">): boolean {
  return reg.source === "pay" || isPayRegistrationId(reg.id);
}

/**
 * Pay bookings bind to a concrete eventSlug (+ quizDate on the team).
 * Never fall back to venue-only matching — that mixed staging/test teams into real venues.
 */
export function payTeamMatchesAdminEvent(
  team: Pick<PayTeam, "eventSlug" | "venue" | "quizDate">,
  filter: { slug?: string; venue?: string; quizDate?: string }
): boolean {
  const slug = filter.slug?.trim() ?? "";
  const venue = filter.venue?.trim().toLowerCase() ?? "";
  const quizDate = filter.quizDate?.trim() ?? "";

  if (slug) {
    if (team.eventSlug !== slug) return false;
  } else if (venue) {
    if (team.venue.trim().toLowerCase() !== venue) return false;
  } else {
    return false;
  }

  if (quizDate && team.quizDate.trim() !== quizDate) return false;
  return true;
}

/**
 * Merge classic registrations with pay bookings.
 * Skips cancelled pay teams. Dedupes by venue + team name + term when a classic row already exists.
 */
export function mergeRegistrationsWithPayBookings(
  registrations: Registration[],
  payTeams: PayTeam[],
  filter?: { slug?: string; venue?: string; quizDate?: string }
): AdminRegistrationView[] {
  const slug = filter?.slug?.trim() ?? "";
  const venue = filter?.venue?.trim() ?? "";
  const quizDate = filter?.quizDate?.trim() ?? "";
  const filtered = Boolean(slug || venue);

  const classic: AdminRegistrationView[] = (filtered
    ? registrations.filter((reg) => {
        if (!registrationMatchesEvent(reg, slug, venue)) return false;
        if (quizDate) {
          const term = (reg.quizDate ?? "").trim();
          if (term && term !== quizDate) return false;
        }
        return true;
      })
    : registrations
  ).map((reg) => ({ ...reg, source: "web" as const }));

  const classicKeys = new Set(
    classic.map((reg) => {
      const term = (reg.quizDate ?? "").trim().toLowerCase();
      return `${(reg.venue ?? "").trim().toLowerCase()}|${reg.teamName.trim().toLowerCase()}|${term}`;
    })
  );

  const fromPay: AdminRegistrationView[] = [];
  for (const team of payTeams) {
    if (team.status === "cancelled") continue;
    if (filtered && !payTeamMatchesAdminEvent(team, { slug, venue, quizDate })) continue;

    const term = team.quizDate.trim().toLowerCase();
    const key = `${team.venue.trim().toLowerCase()}|${team.teamName.trim().toLowerCase()}|${term}`;
    if (classicKeys.has(key)) continue;

    fromPay.push(payTeamToAdminRegistration(team));
  }

  return [...classic, ...fromPay].sort((a, b) => a.createdAt.localeCompare(b.createdAt, "sk"));
}
