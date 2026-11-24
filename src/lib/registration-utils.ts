import { registrationOnTerm } from "@/lib/future-quizzes";
import { teamKey } from "@/lib/poll";

/** Počet hráčov z registrácie (reťazec z formulára alebo admin úpravy). */
export function parseRegistrationPlayerCount(value: string | number | null | undefined): number {
  const n = parseInt(String(value ?? "").replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export type RegistrationLike = {
  eventSlug?: string;
  venue?: string;
  players?: string | number;
};

export type RegistrationSlotLike = {
  id?: string;
  teamName: string;
  venue?: string;
  eventSlug?: string;
  quizDate?: string;
  createdAt?: string;
};

/**
 * Same team + venue (+ event slug when both set) + quiz term.
 * Case/whitespace-insensitive team name via teamKey. Empty quizDate = nearest term.
 */
export function sameRegistrationSlot(
  a: RegistrationSlotLike,
  b: RegistrationSlotLike,
  nearestDate?: string
): boolean {
  if (teamKey(a.teamName) !== teamKey(b.teamName)) return false;
  if ((a.venue ?? "").trim().toLowerCase() !== (b.venue ?? "").trim().toLowerCase()) return false;
  const slugA = (a.eventSlug ?? "").trim();
  const slugB = (b.eventSlug ?? "").trim();
  if (slugA && slugB && slugA !== slugB) return false;

  const nearest = (nearestDate ?? "").trim();
  const termA = (a.quizDate ?? "").trim();
  const termB = (b.quizDate ?? "").trim();
  // Both undated → same nearest-term bucket for this venue/event.
  if (!termA && !termB) return true;
  if (!nearest) {
    // Without event nearest date, don't guess: undated ≠ a concrete future term.
    if (!termA || !termB) return false;
    return registrationOnTerm(a, termB, termB);
  }
  const probe = termB || termA || nearest;
  return registrationOnTerm(a, probe, nearest) && registrationOnTerm(b, probe, nearest);
}

/** Keep newest by createdAt (sk locale string); ties keep the later array entry. */
export function preferNewestRegistration<T extends RegistrationSlotLike>(regs: T[]): T | undefined {
  if (!regs.length) return undefined;
  return regs.reduce((best, current) => {
    const cmp = (current.createdAt ?? "").localeCompare(best.createdAt ?? "", "sk");
    return cmp >= 0 ? current : best;
  });
}

/**
 * Collapse duplicates for the same team+venue+event+term (newest wins).
 * Optional nearestDate helps match empty quizDate rows to a concrete term.
 */
export function dedupeRegistrationsPreferNewest<T extends RegistrationSlotLike>(
  regs: T[],
  nearestDate?: string
): { kept: T[]; removedIds: string[] } {
  const kept: T[] = [];
  const removedIds: string[] = [];
  const claimed = new Set<number>();

  for (let i = 0; i < regs.length; i++) {
    if (claimed.has(i)) continue;
    const groupIdx = [i];
    for (let j = i + 1; j < regs.length; j++) {
      if (claimed.has(j)) continue;
      if (sameRegistrationSlot(regs[i], regs[j], nearestDate)) groupIdx.push(j);
    }
    const group = groupIdx.map((idx) => regs[idx]);
    const winner = preferNewestRegistration(group)!;
    kept.push(winner);
    for (const idx of groupIdx) {
      claimed.add(idx);
      const id = regs[idx].id;
      if (id && id !== winner.id) removedIds.push(id);
    }
  }
  return { kept, removedIds };
}

/** Rovnaká logika ako zoznam v admine: slug alebo podnik. */
export function registrationMatchesEvent(registration: RegistrationLike, slug: string, venue: string): boolean {
  const venueLower = venue.trim().toLowerCase();
  if (slug && registration.eventSlug === slug) return true;
  if (venueLower && (registration.venue ?? "").trim().toLowerCase() === venueLower) return true;
  return false;
}

/** Rovnaká logika ako GET /api/register?slug=&venue= */
export function registrationsForEvent(
  registrations: RegistrationLike[],
  slug: string,
  venue: string
): RegistrationLike[] {
  return registrations.filter((registration) => registrationMatchesEvent(registration, slug, venue));
}

export function registrationTotalsForEvent(
  registrations: RegistrationLike[],
  slug: string,
  venue: string
): { teams: number; players: number } {
  const list = registrationsForEvent(registrations, slug, venue);
  let players = 0;
  for (const reg of list) {
    players += parseRegistrationPlayerCount(reg.players);
  }
  return { teams: list.length, players };
}

export function formatSkPlayerCountTotal(count: number): string {
  if (count === 1) return "1 hráč";
  if (count >= 2 && count <= 4) return `${count} hráči`;
  return `${count} hráčov`;
}

export function formatSkTeamCount(count: number): string {
  if (count === 1) return "1 tím";
  if (count >= 2 && count <= 4) return `${count} tímy`;
  return `${count} tímov`;
}

export function registrationShareText(input: {
  venue: string;
  city?: string;
  whenLabel?: string;
  teams: { teamName: string; players: string | number }[];
}): string {
  const teams = input.teams
    .map((team) => ({
      teamName: team.teamName.trim(),
      players: parseRegistrationPlayerCount(team.players),
    }))
    .filter((team) => team.teamName)
    .sort((a, b) => a.teamName.localeCompare(b.teamName, "sk"));
  const players = teams.reduce((sum, team) => sum + team.players, 0);
  const place = [input.venue.trim(), input.city?.trim()].filter(Boolean).join(", ");
  const lines = [place];
  if (input.whenLabel?.trim()) lines.push(input.whenLabel.trim());
  lines.push("", `${formatSkTeamCount(teams.length)} · ${formatSkPlayerCountTotal(players)}`, "");
  teams.forEach((team, index) => {
    const count = team.players > 0 ? ` — ${formatSkPlayerCountTotal(team.players)}` : "";
    lines.push(`${index + 1}. ${team.teamName}${count}`);
  });
  return lines.join("\n");
}

/** Vstupné za hráča × počet prihlásených hráčov. */
export function estimatedEntryRevenue(entryFee: number, players: number): number {
  const fee = Number(entryFee);
  if (!Number.isFinite(fee) || fee <= 0 || players <= 0) return 0;
  return Math.round(fee * players * 100) / 100;
}

export function formatEuroAmount(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(".", ",");
  return `${text} €`;
}
