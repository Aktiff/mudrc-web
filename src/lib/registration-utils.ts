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

/** Rovnaká logika ako GET /api/register?slug=&venue= */
export function registrationsForEvent(
  registrations: RegistrationLike[],
  slug: string,
  venue: string
): RegistrationLike[] {
  const venueLower = venue.trim().toLowerCase();
  return registrations.filter((r) => {
    if (slug && r.eventSlug === slug) return true;
    if (venueLower && (r.venue ?? "").trim().toLowerCase() === venueLower) return true;
    return false;
  });
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
