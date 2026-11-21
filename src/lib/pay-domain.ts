import { randomBytes } from "crypto";
import { formatEuroAmount } from "@/lib/registration-utils";
import {
  cancelRefundPercent,
  isOnlineWindowOpen,
  onlinePriceAt,
  pricingSnapshot,
  quizHasStarted,
  resolveFeeConfig,
  type EventFeeFields,
  type FeeTierConfig,
} from "@/lib/pay-pricing";

export type SeatStatus =
  | "pending_payment"
  | "paid"
  | "void"
  | "refund_pending"
  | "refunded_50"
  | "forfeited"
  | "transferred";

export type TeamPayStatus = "open" | "partial" | "full" | "closed_at_start" | "cancelled";

export type PaySeat = {
  id: string;
  /** Per-seat token (legacy / internal; sharing uses team pay link) */
  token: string;
  index: number;
  status: SeatStatus;
  amountEur: number;
  payerName?: string;
  payerEmail?: string;
  paidAt?: string;
  checkedInAt?: string;
  /** walk_up seats are created on site after quiz start */
  kind: "prepaid" | "walk_up";
  /** Snapshot of cancel policy at payment (UI / future PSP). */
  cancelRefundPercent?: 50 | 0;
};

export type PayTeam = {
  id: string;
  /** Captain dashboard + shared team pay-link token */
  token: string;
  eventSlug: string;
  venue: string;
  city?: string;
  quizDate: string;
  quizTime: string;
  teamName: string;
  players: number;
  captainPhone: string;
  captainEmail: string;
  status: TeamPayStatus;
  seats: PaySeat[];
  createdAt: string;
  mock: true;
  /** Fee ladder used for this booking (payment-time pricing). */
  feeConfig?: FeeTierConfig;
};

export type PayBookingStore = {
  teams: PayTeam[];
};

export { quizHasStarted } from "@/lib/pay-pricing";

export function newToken(bytes = 12): string {
  return randomBytes(bytes).toString("base64url");
}

function feeConfigForTeam(team: PayTeam, override?: FeeTierConfig | EventFeeFields): FeeTierConfig {
  if (override) return resolveFeeConfig(override);
  if (team.feeConfig) return resolveFeeConfig(team.feeConfig);
  return resolveFeeConfig({ entryFee: team.seats.find((s) => s.kind === "prepaid")?.amountEur });
}

export function deriveTeamStatus(team: PayTeam, now = new Date()): TeamPayStatus {
  if (team.status === "cancelled") return "cancelled";
  const config = feeConfigForTeam(team);
  const onlineOpen = isOnlineWindowOpen(team.quizDate, team.quizTime, config, now);
  const prepaid = team.seats.filter((s) => s.kind === "prepaid");
  const paid = prepaid.filter((s) => s.status === "paid").length;
  const pending = prepaid.filter((s) => s.status === "pending_payment").length;
  // Soft-hold ends when online window closes (T-10min) or quiz started.
  if (!onlineOpen || quizHasStarted(team.quizDate, team.quizTime, now)) {
    return "closed_at_start";
  }
  if (paid === 0) return "open";
  if (pending === 0 && paid === prepaid.length) return "full";
  return "partial";
}

/**
 * Soft-hold for unpaid seats only while the online window is still open.
 * When online locks (default T-10min) or quiz started → void pending prepaid seats.
 */
export function applyHoldExpiry(team: PayTeam, now = new Date()): PayTeam {
  const config = feeConfigForTeam(team);
  const onlineOpen = isOnlineWindowOpen(team.quizDate, team.quizTime, config, now);
  if (onlineOpen) {
    return { ...team, status: deriveTeamStatus(team, now) };
  }
  const seats = team.seats.map((seat) => {
    if (seat.kind === "prepaid" && seat.status === "pending_payment") {
      return { ...seat, status: "void" as const };
    }
    return seat;
  });
  const next = { ...team, seats };
  return { ...next, status: deriveTeamStatus(next, now) };
}

/**
 * Admin/captain cancel: mark team cancelled, void unpaid seats,
 * and apply refund policy on paid seats (data model ready; real PSP later).
 * ≥ 24 h before start → refund_pending (50 %); &lt; 24 h → forfeited (0 %).
 */
export function cancelTeamBooking(team: PayTeam, now = new Date()): PayTeam {
  if (team.status === "cancelled") return team;
  const config = feeConfigForTeam(team);
  const refundPct = cancelRefundPercent(team.quizDate, team.quizTime, config, now);
  const seats = team.seats.map((seat) => {
    if (seat.kind === "prepaid" && seat.status === "pending_payment") {
      return { ...seat, status: "void" as const };
    }
    if (seat.status === "paid") {
      if (refundPct === 50) {
        return {
          ...seat,
          status: "refund_pending" as const,
          cancelRefundPercent: 50 as const,
        };
      }
      return {
        ...seat,
        status: "forfeited" as const,
        cancelRefundPercent: 0 as const,
      };
    }
    return seat;
  });
  return { ...team, seats, status: "cancelled" };
}

export function pendingPrepaidSeats(team: PayTeam): PaySeat[] {
  return team.seats.filter((s) => s.kind === "prepaid" && s.status === "pending_payment");
}

export function paidSeats(team: PayTeam): PaySeat[] {
  return team.seats.filter((s) => s.status === "paid");
}

export function createTeamBooking(input: {
  eventSlug: string;
  venue: string;
  city?: string;
  quizDate: string;
  quizTime: string;
  teamName: string;
  players: number;
  captainPhone: string;
  captainEmail: string;
  /** @deprecated Prefer feeConfig / event fee fields. Used as earlyFee fallback. */
  entryFee?: number;
  feeConfig?: FeeTierConfig | EventFeeFields;
}): PayTeam {
  const players = Math.max(1, Math.min(20, Math.floor(input.players)));
  const config = resolveFeeConfig(
    input.feeConfig
      ? { ...resolveFeeConfig(input.feeConfig), entryFee: input.entryFee }
      : { entryFee: input.entryFee }
  );

  // Placeholder list price = current online tier; actual charge is set again at pay time.
  const quote = onlinePriceAt(input.quizDate, input.quizTime, config) ?? {
    tier: "late" as const,
    priceEur: config.lateFee,
  };
  const amount = quote.priceEur;

  const seats: PaySeat[] = Array.from({ length: players }, (_, i) => ({
    id: newToken(8),
    token: newToken(16),
    index: i + 1,
    status: "pending_payment",
    amountEur: amount,
    kind: "prepaid",
  }));

  return {
    id: newToken(10),
    token: newToken(16),
    eventSlug: input.eventSlug,
    venue: input.venue,
    city: input.city,
    quizDate: input.quizDate,
    quizTime: input.quizTime,
    teamName: input.teamName.trim(),
    players,
    captainPhone: input.captainPhone.trim(),
    captainEmail: input.captainEmail.trim().toLowerCase(),
    status: "open",
    seats,
    createdAt: new Date().toISOString(),
    mock: true,
    feeConfig: config,
  };
}

export function markSeatPaid(
  team: PayTeam,
  seatToken: string,
  payer?: { name?: string; email?: string },
  now = new Date(),
  feeOverride?: FeeTierConfig | EventFeeFields
): { team: PayTeam; seat: PaySeat } | { error: string } {
  const live = applyHoldExpiry(team, now);
  const config = feeConfigForTeam(live, feeOverride);
  const idx = live.seats.findIndex((s) => s.token === seatToken);
  if (idx < 0) return { error: "Lístok neexistuje." };
  const seat = live.seats[idx];
  if (seat.status === "paid") return { team: live, seat };
  if (seat.status === "void") {
    return {
      error: `Toto miesto už nie je kúpiteľné online. Walk-up na mieste za ${config.walkUpFee} €.`,
    };
  }
  if (seat.status !== "pending_payment") return { error: "Lístok nie je v stave na platbu." };

  if (seat.kind === "prepaid") {
    const quote = onlinePriceAt(live.quizDate, live.quizTime, config, now);
    if (!quote) {
      return {
        error: `Online predaj je ukončený (menej než ${config.onlineLockMinutes} min do štartu). Walk-up na mieste za ${config.walkUpFee} €.`,
      };
    }
    const nextSeat: PaySeat = {
      ...seat,
      status: "paid",
      amountEur: quote.priceEur,
      paidAt: now.toISOString(),
      payerName: payer?.name?.trim() || seat.payerName,
      payerEmail: payer?.email?.trim().toLowerCase() || seat.payerEmail,
      cancelRefundPercent: cancelRefundPercent(live.quizDate, live.quizTime, config, now),
    };
    const seats = [...live.seats];
    seats[idx] = nextSeat;
    const next = { ...live, seats, feeConfig: config };
    return { team: { ...next, status: deriveTeamStatus(next, now) }, seat: nextSeat };
  }

  // Walk-up: charge walk-up fee at pay time.
  const nextSeat: PaySeat = {
    ...seat,
    status: "paid",
    amountEur: config.walkUpFee,
    paidAt: now.toISOString(),
    payerName: payer?.name?.trim() || seat.payerName,
    payerEmail: payer?.email?.trim().toLowerCase() || seat.payerEmail,
  };
  const seats = [...live.seats];
  seats[idx] = nextSeat;
  const next = { ...live, seats, feeConfig: config };
  return { team: { ...next, status: deriveTeamStatus(next, now) }, seat: nextSeat };
}

/** Claim the next unpaid prepaid seat via the shared team pay link. */
export function markNextPendingSeatPaid(
  team: PayTeam,
  payer?: { name?: string; email?: string },
  now = new Date(),
  feeOverride?: FeeTierConfig | EventFeeFields
): { team: PayTeam; seat: PaySeat } | { error: string } {
  const multi = markNextPendingSeatsPaid(team, 1, payer, now, feeOverride);
  if ("error" in multi) return multi;
  return { team: multi.team, seat: multi.seats[0] };
}

/**
 * Claim the next N unpaid prepaid seats in one mock checkout.
 * Quantity is clamped to 1..pending; each seat charged at **current** tier price.
 */
export function markNextPendingSeatsPaid(
  team: PayTeam,
  quantity: number,
  payer?: { name?: string; email?: string },
  now = new Date(),
  feeOverride?: FeeTierConfig | EventFeeFields
): { team: PayTeam; seats: PaySeat[] } | { error: string } {
  const live = applyHoldExpiry(team, now);
  const config = feeConfigForTeam(live, feeOverride);
  const quote = onlinePriceAt(live.quizDate, live.quizTime, config, now);
  if (!quote) {
    return {
      error: `Online predaj je ukončený (menej než ${config.onlineLockMinutes} min do štartu). Walk-up na mieste za ${config.walkUpFee} €.`,
    };
  }
  const pending = pendingPrepaidSeats(live);
  if (pending.length === 0) {
    const prepaid = live.seats.filter((s) => s.kind === "prepaid");
    const paid = prepaid.filter((s) => s.status === "paid").length;
    if (paid === prepaid.length && prepaid.length > 0) {
      return { error: "Všetky miesta tímu sú už zaplatené." };
    }
    return { error: "Žiadne voľné miesto na zaplatenie." };
  }

  const qty = Math.floor(Number(quantity));
  if (!Number.isFinite(qty) || qty < 1) {
    return { error: "Počet miest musí byť aspoň 1." };
  }
  if (qty > pending.length) {
    return {
      error:
        pending.length === 1
          ? "Dá sa zaplatiť už len 1 miesto."
          : `Dá sa zaplatiť najviac ${pending.length} miest.`,
    };
  }

  const tokens = pending.slice(0, qty).map((s) => s.token);
  let current = live;
  const seats: PaySeat[] = [];
  for (const token of tokens) {
    const outcome = markSeatPaid(current, token, payer, now, config);
    if ("error" in outcome) return outcome;
    current = outcome.team;
    seats.push(outcome.seat);
  }
  return { team: current, seats };
}

/** Customer-facing Slovak label for seat payment status (never show raw enums). */
export function formatSeatStatusLabel(status: SeatStatus): string {
  switch (status) {
    case "paid":
      return "zaplatené";
    case "pending_payment":
      return "čaká sa na zaplatenie";
    case "void":
      return "uvoľnené (online uzamknuté)";
    case "refund_pending":
      return "čaká sa na refundáciu 50 %";
    case "refunded_50":
      return "refundované 50 %";
    case "forfeited":
      return "prepadnuté (0 % refund)";
    case "transferred":
      return "presunuté";
    default:
      return status;
  }
}

/** Count active prepaid seats (pending + paid; voids do not count toward team size). */
export function prepaidSeatCount(team: PayTeam): number {
  return team.seats.filter(
    (s) => s.kind === "prepaid" && (s.status === "pending_payment" || s.status === "paid")
  ).length;
}

/**
 * Add one prepaid pending seat up to the quiz max team size.
 * Cap comes from event rules (`maxPlayers`), not from the original registration N.
 * Only while online window is open.
 */
export function addPrepaidSeat(
  team: PayTeam,
  maxPlayers: number,
  feeOrEntry: number | FeeTierConfig | EventFeeFields,
  now = new Date()
): { team: PayTeam; seat: PaySeat } | { error: string } {
  const live = applyHoldExpiry(team, now);
  const config =
    typeof feeOrEntry === "number"
      ? resolveFeeConfig({ entryFee: feeOrEntry })
      : resolveFeeConfig(feeOrEntry);

  if (live.status === "cancelled") {
    return { error: "Táto rezervácia bola zrušená." };
  }
  if (!isOnlineWindowOpen(live.quizDate, live.quizTime, config, now) || live.status === "closed_at_start") {
    return {
      error: `Online rezervácia je uzamknutá (menej než ${config.onlineLockMinutes} min do štartu). Walk-up na mieste za ${config.walkUpFee} €.`,
    };
  }
  const cap = Math.max(1, Math.floor(maxPlayers));
  const current = prepaidSeatCount(live);
  if (current >= cap) {
    return { error: `Tím môže mať najviac ${cap} hráčov na tomto kvíze.` };
  }

  const quote = onlinePriceAt(live.quizDate, live.quizTime, config, now);
  const amount = quote?.priceEur ?? config.lateFee;
  const nextIndex =
    live.seats.filter((s) => s.kind === "prepaid").reduce((max, s) => Math.max(max, s.index), 0) + 1;
  const seat: PaySeat = {
    id: newToken(8),
    token: newToken(16),
    index: nextIndex,
    status: "pending_payment",
    amountEur: amount,
    kind: "prepaid",
  };
  const seats = [...live.seats, seat];
  const next: PayTeam = {
    ...live,
    players: current + 1,
    seats,
    feeConfig: config,
  };
  return { team: { ...next, status: deriveTeamStatus(next, now) }, seat };
}

export function createWalkUpSeat(
  teamOrEvent: {
    eventSlug: string;
    venue: string;
    city?: string;
    quizDate: string;
    quizTime: string;
    entryFee?: number;
    feeConfig?: FeeTierConfig | EventFeeFields;
  },
  payer: { name: string; email?: string; phone?: string }
): { team: PayTeam; seat: PaySeat } {
  const config = resolveFeeConfig(
    teamOrEvent.feeConfig
      ? { ...resolveFeeConfig(teamOrEvent.feeConfig), entryFee: teamOrEvent.entryFee }
      : { entryFee: teamOrEvent.entryFee }
  );
  const amount = config.walkUpFee;
  const seat: PaySeat = {
    id: newToken(8),
    token: newToken(16),
    index: 1,
    status: "pending_payment",
    amountEur: amount,
    kind: "walk_up",
    payerName: payer.name.trim(),
    payerEmail: payer.email?.trim().toLowerCase(),
  };
  const team: PayTeam = {
    id: newToken(10),
    token: newToken(16),
    eventSlug: teamOrEvent.eventSlug,
    venue: teamOrEvent.venue,
    city: teamOrEvent.city,
    quizDate: teamOrEvent.quizDate,
    quizTime: teamOrEvent.quizTime,
    teamName: `Walk-up · ${payer.name.trim()}`,
    players: 1,
    captainPhone: payer.phone?.trim() || "—",
    captainEmail: payer.email?.trim().toLowerCase() || "walkup@mock.local",
    status: "open",
    seats: [seat],
    createdAt: new Date().toISOString(),
    mock: true,
    feeConfig: config,
  };
  return { team, seat };
}

export function toggleSeatCheckIn(team: PayTeam, seatId: string, now = new Date()): PayTeam | null {
  const idx = team.seats.findIndex((s) => s.id === seatId);
  if (idx < 0) return null;
  const seat = team.seats[idx];
  if (seat.status !== "paid") return null;
  const seats = [...team.seats];
  seats[idx] = {
    ...seat,
    checkedInAt: seat.checkedInAt ? undefined : now.toISOString(),
  };
  return { ...team, seats };
}

export function formatSeatLabel(seat: PaySeat): string {
  return seat.kind === "walk_up" ? `Walk-up #${seat.index}` : `Miesto ${seat.index}`;
}

export function formatPriceLabel(amount: number): string {
  return formatEuroAmount(amount);
}

export function teamSummary(team: PayTeam): { paid: number; pending: number; voided: number; total: number } {
  const prepaid = team.seats.filter((s) => s.kind === "prepaid");
  return {
    paid: prepaid.filter((s) => s.status === "paid").length,
    pending: prepaid.filter((s) => s.status === "pending_payment").length,
    voided: prepaid.filter((s) => s.status === "void").length,
    total: prepaid.length,
  };
}

/** Current checkout unit price for a team's pending seats (payment-time tier). */
export function currentCheckoutUnitPrice(
  team: PayTeam,
  feeOverride?: FeeTierConfig | EventFeeFields,
  now = new Date()
): number {
  const config = feeConfigForTeam(team, feeOverride);
  const quote = onlinePriceAt(team.quizDate, team.quizTime, config, now);
  return quote?.priceEur ?? config.walkUpFee;
}

export function teamPricingSnapshot(team: PayTeam, now = new Date()) {
  return pricingSnapshot(team.quizDate, team.quizTime, feeConfigForTeam(team), now);
}
