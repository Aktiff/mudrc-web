export type VenueTeam = {
  id: string;
  eventSlug: string;
  venue: string;
  teamName: string;
  phones: string[];
  updatedAt: string;
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
    const key = digitRun(phone);
    if (seen.has(key)) continue;
    seen.add(key);
    phones.push(phone);
  }
  return phones;
}

export function formatTeamPhone(value: string): string {
  const trimmed = value.trim();
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
