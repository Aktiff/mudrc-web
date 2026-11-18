/** Staging / mock payment for pay.mudrc.sk — no real PSP. */

export const PAY_MOCK_MODE = true;

/** Walk-up usually +1 € over prepaid entryFee (from terms/settings). */
export function walkUpSurchargeEur(): number {
  const raw = process.env.NEXT_PUBLIC_WALK_UP_SURCHARGE_EUR?.trim();
  if (raw === undefined || raw === "") return 1;
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : 1;
}

export function prepaidPriceEur(entryFee: number): number {
  const fee = Number(entryFee);
  return Number.isFinite(fee) && fee > 0 ? fee : 4;
}

export function walkUpPriceEur(entryFee: number): number {
  return Math.round((prepaidPriceEur(entryFee) + walkUpSurchargeEur()) * 100) / 100;
}

export function isPayHostname(host: string | null | undefined): boolean {
  const h = String(host ?? "")
    .split(":")[0]
    .trim()
    .toLowerCase();
  if (!h) return false;
  if (h === "pay.mudrc.sk") return true;
  if (h === "pay.localhost" || h === "pay.127.0.0.1") return true;
  if (process.env.PAY_FORCE_HOST === "1") return true;
  return false;
}

/** On pay.mudrc.sk URLs are root-relative; on main site use /pay prefix. */
export function getPayBasePath(host?: string | null): "" | "/pay" {
  return isPayHostname(host) ? "" : "/pay";
}

export function payHref(basePath: "" | "/pay", path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  if (!basePath) return clean === "/pay" ? "/" : clean.replace(/^\/pay(?=\/|$)/, "") || "/";
  if (clean === "/" || clean === "") return basePath || "/";
  if (clean.startsWith("/pay")) return clean;
  return `${basePath}${clean}`;
}

export function payPublicOrigin(host?: string | null): string {
  if (isPayHostname(host)) {
    const proto = process.env.VERCEL ? "https" : "http";
    const h = String(host ?? "pay.mudrc.sk").split(":")[0];
    return `${proto}://${h}`;
  }
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim() || process.env.NEXT_PUBLIC_PAY_URL?.trim();
  if (site) {
    try {
      return new URL(site).origin;
    } catch {
      /* fall through */
    }
  }
  return "http://localhost:3000";
}

/** Soft gate for check-in list (moderator night-of). */
export function payCheckInPin(): string {
  return process.env.PAY_CHECKIN_PIN?.trim() || process.env.ADMIN_PASSWORD?.trim() || "mudrc2026";
}
