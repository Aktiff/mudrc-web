import { parseSkEventDateTime } from "@/lib/data";

/** Online prepaid tiers + walk-up. Price is always by payment time, not registration. */
export type FeeTierConfig = {
  /** ≥ earlyWindowHours before start (default 4 €) */
  earlyFee: number;
  /** After early window until online lock (default 5 €) */
  lateFee: number;
  /** On-site walk-up after online lock / at venue (default 6 €) */
  walkUpFee: number;
  /** Hours before start when early fee still applies (default 24) */
  earlyWindowHours: number;
  /** Minutes before start when online registration & pay lock (default 10) */
  onlineLockMinutes: number;
};

export type OnlineFeeTier = "early" | "late";

export type PricingSnapshot = {
  earlyFee: number;
  lateFee: number;
  walkUpFee: number;
  earlyWindowHours: number;
  onlineLockMinutes: number;
  /** Current online tier when online is open; otherwise walk_up messaging. */
  tier: OnlineFeeTier | "walk_up";
  /** Price charged for an online prepaid seat right now (early/late). */
  onlinePriceEur: number;
  /** Walk-up / on-site price. */
  walkUpPriceEur: number;
  /** Whether new online team registration is allowed. */
  onlineRegistrationOpen: boolean;
  /** Whether existing pending prepaid seats can still be paid online. */
  onlinePayOpen: boolean;
  /** Quiz has already started. */
  started: boolean;
  /** Milliseconds until quiz start (negative if past). Null if date invalid. */
  msUntilStart: number | null;
};

export type EventFeeFields = {
  entryFee?: number;
  earlyFee?: number;
  lateFee?: number;
  walkUpFee?: number;
  earlyWindowHours?: number;
  onlineLockMinutes?: number;
};

const DEFAULT_EARLY = 4;
const DEFAULT_LATE = 5;
const DEFAULT_WALK_UP = 6;
const DEFAULT_EARLY_HOURS = 24;
const DEFAULT_LOCK_MINUTES = 10;

function positiveMoney(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.round(n * 100) / 100;
}

function positiveNumber(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

function isCompleteFeeConfig(value: unknown): value is FeeTierConfig {
  if (!value || typeof value !== "object") return false;
  const v = value as FeeTierConfig;
  return (
    typeof v.earlyFee === "number" &&
    typeof v.lateFee === "number" &&
    typeof v.walkUpFee === "number" &&
    typeof v.earlyWindowHours === "number" &&
    typeof v.onlineLockMinutes === "number"
  );
}

/**
 * Resolve fee tiers from event fields or an already-complete FeeTierConfig.
 * Prefer explicit early/late/walkUp; else derive from entryFee (early = entryFee, late +1, walk-up +2).
 */
export function resolveFeeConfig(event?: EventFeeFields | FeeTierConfig | null): FeeTierConfig {
  if (isCompleteFeeConfig(event)) {
    return {
      earlyFee: positiveMoney(event.earlyFee, DEFAULT_EARLY),
      lateFee: positiveMoney(event.lateFee, DEFAULT_LATE),
      walkUpFee: positiveMoney(event.walkUpFee, DEFAULT_WALK_UP),
      earlyWindowHours: positiveNumber(event.earlyWindowHours, DEFAULT_EARLY_HOURS),
      onlineLockMinutes: positiveNumber(event.onlineLockMinutes, DEFAULT_LOCK_MINUTES),
    };
  }
  const entry = positiveMoney(event?.entryFee, DEFAULT_EARLY);
  const earlyFee = positiveMoney(event?.earlyFee, entry || DEFAULT_EARLY);
  const lateFee = positiveMoney(
    event?.lateFee,
    Math.round((earlyFee + 1) * 100) / 100 || DEFAULT_LATE
  );
  const walkUpFee = positiveMoney(
    event?.walkUpFee,
    Math.round((earlyFee + 2) * 100) / 100 || DEFAULT_WALK_UP
  );
  return {
    earlyFee,
    lateFee,
    walkUpFee,
    earlyWindowHours: positiveNumber(event?.earlyWindowHours, DEFAULT_EARLY_HOURS),
    onlineLockMinutes: positiveNumber(event?.onlineLockMinutes, DEFAULT_LOCK_MINUTES),
  };
}

export function msUntilQuizStart(
  quizDate: string,
  quizTime: string,
  now = new Date()
): number | null {
  const start = parseSkEventDateTime(quizDate, quizTime);
  if (!start) return null;
  return start.getTime() - now.getTime();
}

export function quizHasStarted(quizDate: string, quizTime: string, now = new Date()): boolean {
  const ms = msUntilQuizStart(quizDate, quizTime, now);
  if (ms === null) return false;
  return ms <= 0;
}

/** Online pay/register allowed until T - onlineLockMinutes. */
export function isOnlineWindowOpen(
  quizDate: string,
  quizTime: string,
  config: FeeTierConfig,
  now = new Date()
): boolean {
  const ms = msUntilQuizStart(quizDate, quizTime, now);
  if (ms === null) return false;
  const lockMs = config.onlineLockMinutes * 60 * 1000;
  return ms > lockMs;
}

/** Current online prepaid price at `now` (payment time). Null when online is locked. */
export function onlinePriceAt(
  quizDate: string,
  quizTime: string,
  config: FeeTierConfig,
  now = new Date()
): { tier: OnlineFeeTier; priceEur: number } | null {
  if (!isOnlineWindowOpen(quizDate, quizTime, config, now)) return null;
  const ms = msUntilQuizStart(quizDate, quizTime, now);
  if (ms === null) return null;
  const earlyMs = config.earlyWindowHours * 60 * 60 * 1000;
  if (ms >= earlyMs) {
    return { tier: "early", priceEur: config.earlyFee };
  }
  return { tier: "late", priceEur: config.lateFee };
}

export function pricingSnapshot(
  quizDate: string,
  quizTime: string,
  eventOrConfig?: EventFeeFields | FeeTierConfig | null,
  now = new Date()
): PricingSnapshot {
  const config = resolveFeeConfig(eventOrConfig);

  const ms = msUntilQuizStart(quizDate, quizTime, now);
  const started = ms !== null && ms <= 0;
  const online = onlinePriceAt(quizDate, quizTime, config, now);
  const onlineOpen = !!online && !started;

  return {
    earlyFee: config.earlyFee,
    lateFee: config.lateFee,
    walkUpFee: config.walkUpFee,
    earlyWindowHours: config.earlyWindowHours,
    onlineLockMinutes: config.onlineLockMinutes,
    tier: online ? online.tier : "walk_up",
    onlinePriceEur: online?.priceEur ?? config.lateFee,
    walkUpPriceEur: config.walkUpFee,
    onlineRegistrationOpen: onlineOpen,
    onlinePayOpen: onlineOpen,
    started,
    msUntilStart: ms,
  };
}

/**
 * Cancel / storno refund of paid amount:
 * ≥ earlyWindowHours before start → 50 %; otherwise 0 %.
 * Real PSP refund later — this is the policy helper for UI + data model.
 */
export function cancelRefundPercent(
  quizDate: string,
  quizTime: string,
  config: FeeTierConfig = resolveFeeConfig(),
  now = new Date()
): 50 | 0 {
  const ms = msUntilQuizStart(quizDate, quizTime, now);
  if (ms === null) return 0;
  const earlyMs = config.earlyWindowHours * 60 * 60 * 1000;
  return ms >= earlyMs ? 50 : 0;
}

export function formatTierLabel(tier: PricingSnapshot["tier"]): string {
  switch (tier) {
    case "early":
      return "skoré predplatné";
    case "late":
      return "neskoré predplatné";
    case "walk_up":
      return "walk-up na mieste";
    default:
      return tier;
  }
}

/** Short public copy of the 4 / 5 / 6 ladder. */
export function formatTierLadderCopy(config: FeeTierConfig): string {
  return `${config.earlyFee} € (≥${config.earlyWindowHours} h) · ${config.lateFee} € (<${config.earlyWindowHours} h) · ${config.walkUpFee} € na mieste (od ${config.onlineLockMinutes} min pred štartom)`;
}
