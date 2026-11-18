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

export function isPayRegistration(reg: Pick<AdminRegistrationView, "id" | "source">): boolean {
  return reg.source === "pay" || isPayRegistrationId(reg.id);
}

/**
 * Merge classic registrations with pay bookings.
 * Skips cancelled pay teams. Dedupes by venue + team name + term when a classic row already exists.
 */
export function mergeRegistrationsWithPayBookings(
  registrations: Registration[],
  payTeams: PayTeam[],
  filter?: { slug?: string; venue?: string }
): AdminRegistrationView[] {
  const slug = filter?.slug?.trim() ?? "";
  const venue = filter?.venue?.trim() ?? "";
  const filtered = Boolean(slug || venue);

  const classic: AdminRegistrationView[] = (filtered
    ? registrations.filter((reg) => registrationMatchesEvent(reg, slug, venue))
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
    if (filtered && !registrationMatchesEvent(team, slug, venue)) continue;

    const term = team.quizDate.trim().toLowerCase();
    const key = `${team.venue.trim().toLowerCase()}|${team.teamName.trim().toLowerCase()}|${term}`;
    if (classicKeys.has(key)) continue;

    fromPay.push(payTeamToAdminRegistration(team));
  }

  return [...classic, ...fromPay].sort((a, b) => a.createdAt.localeCompare(b.createdAt, "sk"));
}
