export type VenueTeam = {
  id: string;
  eventSlug: string;
  venue: string;
  teamName: string;
  phones: string[];
  updatedAt: string;
};

/** Telefón ako celé číslo (číslice), nie text a nie samé nuly. */
export function normalizeTeamPhone(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/[a-zA-Z\u00C0-\u024F]/.test(trimmed)) return null;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 9 || digits.length > 15) return null;
  if (/^0+$/.test(digits)) return null;
  return digits;
}

export function extractTeamPhones(raw: string): string[] {
  const parts = raw.split(/[,;|]|\s+a\s+|\n+/);
  const phones: string[] = [];
  for (const part of parts) {
    const phone = normalizeTeamPhone(part);
    if (phone && !phones.includes(phone)) phones.push(phone);
  }
  if (phones.length === 0) {
    const single = normalizeTeamPhone(raw);
    if (single) phones.push(single);
  }
  return phones;
}

export function formatTeamPhone(digits: string): string {
  if (digits.length === 10 && digits.startsWith("0")) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  if (digits.length === 12 && digits.startsWith("421")) {
    return `+421 ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
  }
  return digits.replace(/(\d{3})(?=\d)/g, "$1 ").trim();
}
