/** Staging / mock payment for pay.mudrc.sk — no real PSP. */

import type { QuizEvent } from "@/lib/data";
import { resolveFeeConfig, type EventFeeFields } from "@/lib/pay-pricing";

/** Real Blob-backed test venue on mudrc.sk for pay dry-runs. */
export const PAY_TEST_EVENT_SLUG = "test-platby-silvester";

/** Synthetic always-open quiz on pay.mudrc.sk (see pay-events). */
export const PAY_STAGING_DEMO_SLUG = "pay-staging-demo";

export const PAY_MOCK_MODE = true;

/**
 * @deprecated Prefer resolveFeeConfig / pricingSnapshot (tiered early/late/walk-up).
 * Kept for older call sites that only know entryFee.
 */
export function walkUpSurchargeEur(): number {
  const raw = process.env.NEXT_PUBLIC_WALK_UP_SURCHARGE_EUR?.trim();
  if (raw === undefined || raw === "") return 1;
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : 1;
}

/** @deprecated Prefer pricingSnapshot(...).onlinePriceEur */
export function prepaidPriceEur(entryFee: number): number {
  return resolveFeeConfig({ entryFee }).earlyFee;
}

/** @deprecated Prefer pricingSnapshot(...).walkUpPriceEur */
export function walkUpPriceEur(entryFee: number): number {
  return resolveFeeConfig({ entryFee }).walkUpFee;
}

export function feesFromEvent(event?: EventFeeFields | null) {
  return resolveFeeConfig(event);
}

function hostnameOnly(host: string | null | undefined): string {
  return String(host ?? "")
    .split(":")[0]
    .trim()
    .toLowerCase();
}

function isLocalHostname(host: string): boolean {
  return (
    !host ||
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "pay.localhost" ||
    host === "pay.127.0.0.1" ||
    host.endsWith(".localhost")
  );
}

export function isPayHostname(host: string | null | undefined): boolean {
  const h = hostnameOnly(host);
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

function envPublicOrigin(): string | null {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim() || process.env.NEXT_PUBLIC_PAY_URL?.trim();
  if (!site) return null;
  try {
    return new URL(site).origin;
  } catch {
    return null;
  }
}

function requestProtocol(proto?: string | null): "http" | "https" {
  const p = String(proto ?? "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  if (p === "http" || p === "https") return p;
  if (process.env.VERCEL || process.env.NODE_ENV === "production") return "https";
  return "http";
}

/**
 * Absolute origin for pay share links.
 * Prefer the real request host (never localhost in production).
 */
export function payPublicOrigin(host?: string | null, proto?: string | null): string {
  const rawHost = String(host ?? "")
    .split(",")[0]
    .trim();
  const h = hostnameOnly(rawHost);
  const protocol = requestProtocol(proto);
  const isProd = !!(process.env.VERCEL || process.env.NODE_ENV === "production");

  if (h && !(isLocalHostname(h) && isProd)) {
    return `${protocol}://${rawHost}`;
  }

  const fromEnv = envPublicOrigin();
  if (fromEnv) {
    try {
      const url = new URL(fromEnv);
      if (!(isLocalHostname(url.hostname) && isProd)) {
        return url.origin;
      }
    } catch {
      /* fall through */
    }
  }

  if (isProd || isPayHostname(host)) {
    return "https://pay.mudrc.sk";
  }

  return "http://localhost:3000";
}

/** Soft gate for check-in list (moderator night-of). */
export function payCheckInPin(): string {
  return process.env.PAY_CHECKIN_PIN?.trim() || process.env.ADMIN_PASSWORD?.trim() || "mudrc2026";
}

/**
 * Public CTAs should open the pay register flow when the venue has prepaid tiers
 * (explicit early/late/walk-up) or is a known pay staging/test slug.
 * Normal venues without those fields keep the classic registration modal.
 */
export function eventUsesPayRegistration(
  event: Pick<QuizEvent, "slug" | "earlyFee" | "lateFee" | "walkUpFee">
): boolean {
  if (event.slug === PAY_TEST_EVENT_SLUG || event.slug === PAY_STAGING_DEMO_SLUG) {
    return true;
  }
  return (
    typeof event.earlyFee === "number" &&
    Number.isFinite(event.earlyFee) &&
    typeof event.lateFee === "number" &&
    Number.isFinite(event.lateFee) &&
    typeof event.walkUpFee === "number" &&
    Number.isFinite(event.walkUpFee)
  );
}

/**
 * Path to pay registration for an event (main site: /pay/r/<slug>).
 * On pay.mudrc.sk host rewrite this becomes /r/<slug>.
 */
export function payRegisterHrefForEvent(
  event: Pick<QuizEvent, "slug" | "date"> & { termQuery?: string },
  host?: string | null
): string {
  const date = (event.termQuery?.trim() || event.date?.trim() || "");
  const path = date
    ? `/r/${encodeURIComponent(event.slug)}?date=${encodeURIComponent(date)}`
    : `/r/${encodeURIComponent(event.slug)}`;
  return payHref(getPayBasePath(host), path);
}
