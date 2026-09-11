/** Počet hráčov z registrácie (reťazec z formulára alebo admin úpravy). */
export function parseRegistrationPlayerCount(value: string | number | null | undefined): number {
  const n = parseInt(String(value ?? "").replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
