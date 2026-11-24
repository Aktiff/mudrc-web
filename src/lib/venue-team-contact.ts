import { toSmsNumber } from "@/lib/sms-number";

export type VenueTeam = {
  id: string;
  eventSlug: string;
  venue: string;
  teamName: string;
  phones: string[];
  updatedAt: string;
  /** Rovnaké id = tí istí ľudia, aj keď majú v inom podniku iný názov. */
  linkId?: string;
  /** Body oboch názvov sa v lige počítajú ako jeden tím. */
  leagueMerge?: boolean;
  /** Názov, pod ktorým sa zlúčený tím ukáže v lige. */
  leagueName?: string;
};

function digitRun(raw: string): string {
  return raw.replace(/\D/g, "");
}

/** Nechá číslo tak, ako ho napísali. Preskočí prázdne a samé nuly. */
export function normalizeTeamPhone(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const digits = digitRun(trimmed);
  if (!digits || /^0+$/.test(digits)) return null;
  return trimmed;
}

/**
 * Rovnaké SK číslo v rôznych zápisoch (0948… / +421948…) má rovnaký kľúč.
 * Používa BulkGate/SMS normalizáciu (421… bez +).
 */
export function phoneIdentityKey(raw: string): string | null {
  const sms = toSmsNumber(raw);
  if (sms) return sms;
  const digits = digitRun(raw);
  if (!digits || /^0+$/.test(digits)) return null;
  return digits;
}

/** Preferovaný zápis E.164 (`+421…`). Neparsovateľné číslo ostane null. */
export function toCanonicalE164(raw: string): string | null {
  const sms = toSmsNumber(raw);
  return sms ? `+${sms}` : null;
}

/** True, keď sú v zozname duplicity toho istého čísla v rôznych formátoch. */
export function hasUnifiablePhones(phones: string[]): boolean {
  const keys: string[] = [];
  for (const phone of phones) {
    const key = phoneIdentityKey(phone);
    if (key) keys.push(key);
  }
  return new Set(keys).size < keys.length;
}

/**
 * Zlúči rovnaké čísla (rôzne formáty) do jedného kanonického E.164.
 * Odlišné reálne čísla ostávajú; neparsovateľný text ostáva ako bol.
 */
export function unifyDuplicatePhones(phones: string[]): string[] {
  const byKey = new Map<string, string>();
  const order: string[] = [];
  const unparsed: string[] = [];

  for (const raw of phones) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const key = phoneIdentityKey(trimmed);
    if (!key) {
      unparsed.push(trimmed);
      continue;
    }
    if (byKey.has(key)) continue;
    byKey.set(key, toCanonicalE164(trimmed) ?? trimmed);
    order.push(key);
  }

  return [...order.map((key) => byKey.get(key)!), ...unparsed];
}

/** Lomítko rozdelí kontakt len keď sú na oboch stranách celé čísla. Inak ostane text vcelku. */
function splitSlashSeparatedNumbers(part: string): string[] {
  const bits = part
    .split(/\s*\/\s*/)
    .map((bit) => bit.trim())
    .filter(Boolean);
  if (bits.length < 2) return [part.trim()].filter(Boolean);
  const eachIsNumber = bits.every((bit) => digitRun(bit).length >= 9);
  return eachIsNumber ? bits : [part.trim()];
}

export function extractTeamPhones(raw: string): string[] {
  const chunks = raw.split(/[,;|]|\s+a\s+|\n+/);
  const phones: string[] = [];
  const seen = new Set<string>();
  for (const piece of chunks.flatMap((chunk) => splitSlashSeparatedNumbers(chunk))) {
    const phone = normalizeTeamPhone(piece);
    if (!phone) continue;
    const key = phoneIdentityKey(phone) ?? digitRun(phone);
    if (seen.has(key)) continue;
    seen.add(key);
    phones.push(phone);
  }
  return phones;
}

export function formatTeamPhone(value: string): string {
  const trimmed = value.trim();
  const e164 = toCanonicalE164(trimmed);
  if (e164) {
    const digits = e164.slice(1);
    if (digits.startsWith("421") && digits.length === 12) {
      return `+421 ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
    }
    return e164;
  }
  const compact = trimmed.replace(/\s/g, "");
  if (!/^\d+$/.test(compact)) return trimmed;
  if (compact.length === 10 && compact.startsWith("0")) {
    return `${compact.slice(0, 4)} ${compact.slice(4, 7)} ${compact.slice(7)}`;
  }
  if (compact.length === 12 && compact.startsWith("421")) {
    return `+421 ${compact.slice(3, 6)} ${compact.slice(6, 9)} ${compact.slice(9)}`;
  }
  return compact.replace(/(\d{3})(?=\d)/g, "$1 ").trim();
}
