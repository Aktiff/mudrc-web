import { randomBytes } from "crypto";
import { parseSkEventDateTime } from "@/lib/data";
import { formatEuroAmount } from "@/lib/registration-utils";
import { prepaidPriceEur, walkUpPriceEur } from "@/lib/pay-config";

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
};

export type PayBookingStore = {
  teams: PayTeam[];
};

export function newToken(bytes = 12): string {
  return randomBytes(bytes).toString("base64url");
}

export function quizHasStarted(quizDate: string, quizTime: string, now = new Date()): boolean {
  const start = parseSkEventDateTime(quizDate, quizTime);
  if (!start) return false;
  return now.getTime() >= start.getTime();
}

export function deriveTeamStatus(team: PayTeam, now = new Date()): TeamPayStatus {
  if (team.status === "cancelled") return "cancelled";
  const started = quizHasStarted(team.quizDate, team.quizTime, now);
  const prepaid = team.seats.filter((s) => s.kind === "prepaid");
  const paid = prepaid.filter((s) => s.status === "paid").length;
  const pending = prepaid.filter((s) => s.status === "pending_payment").length;
  if (started) return "closed_at_start";
  if (paid === 0) return "open";
  if (pending === 0 && paid === prepaid.length) return "full";
  return "partial";
}

/** Close unpaid prepaid seats after quiz start (void + release). */
export function applyHoldExpiry(team: PayTeam, now = new Date()): PayTeam {
  if (!quizHasStarted(team.quizDate, team.quizTime, now)) {
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
  entryFee: number;
}): PayTeam {
  const players = Math.max(1, Math.min(20, Math.floor(input.players)));
  const amount = prepaidPriceEur(input.entryFee);
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
  };
}

export function markSeatPaid(
  team: PayTeam,
  seatToken: string,
  payer?: { name?: string; email?: string },
  now = new Date()
): { team: PayTeam; seat: PaySeat } | { error: string } {
  const live = applyHoldExpiry(team, now);
  const idx = live.seats.findIndex((s) => s.token === seatToken);
  if (idx < 0) return { error: "Lístok neexistuje." };
  const seat = live.seats[idx];
  if (seat.status === "paid") return { team: live, seat };
  if (seat.status === "void") return { error: "Toto miesto už nie je kúpiteľné online. Skús walk-up na mieste." };
  if (seat.status !== "pending_payment") return { error: "Lístok nie je v stave na platbu." };
  if (seat.kind === "prepaid" && quizHasStarted(live.quizDate, live.quizTime, now)) {
    return { error: "Kvíz už začal — online predaj je ukončený. Walk-up na mieste." };
  }

  const nextSeat: PaySeat = {
    ...seat,
    status: "paid",
    paidAt: now.toISOString(),
    payerName: payer?.name?.trim() || seat.payerName,
    payerEmail: payer?.email?.trim().toLowerCase() || seat.payerEmail,
  };
  const seats = [...live.seats];
  seats[idx] = nextSeat;
  const next = { ...live, seats };
  return { team: { ...next, status: deriveTeamStatus(next, now) }, seat: nextSeat };
}

/** Claim the next unpaid prepaid seat via the shared team pay link. */
export function markNextPendingSeatPaid(
  team: PayTeam,
  payer?: { name?: string; email?: string },
  now = new Date()
): { team: PayTeam; seat: PaySeat } | { error: string } {
  const multi = markNextPendingSeatsPaid(team, 1, payer, now);
  if ("error" in multi) return multi;
  return { team: multi.team, seat: multi.seats[0] };
}

/**
 * Claim the next N unpaid prepaid seats in one mock checkout.
 * Quantity is clamped to 1..pending; callers should validate before charging.
 */
export function markNextPendingSeatsPaid(
  team: PayTeam,
  quantity: number,
  payer?: { name?: string; email?: string },
  now = new Date()
): { team: PayTeam; seats: PaySeat[] } | { error: string } {
  const live = applyHoldExpiry(team, now);
  if (quizHasStarted(live.quizDate, live.quizTime, now)) {
    return { error: "Kvíz už začal — online predaj je ukončený. Walk-up na mieste." };
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
    const outcome = markSeatPaid(current, token, payer, now);
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
      return "uvoľnené po štarte";
    case "refund_pending":
      return "čaká sa na refundáciu";
    case "refunded_50":
      return "refundované 50 %";
    case "forfeited":
      return "prepadnuté";
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
 */
export function addPrepaidSeat(
  team: PayTeam,
  maxPlayers: number,
  entryFee: number,
  now = new Date()
): { team: PayTeam; seat: PaySeat } | { error: string } {
  const live = applyHoldExpiry(team, now);
  if (live.status === "cancelled") {
    return { error: "Táto rezervácia bola zrušená." };
  }
  if (quizHasStarted(live.quizDate, live.quizTime, now) || live.status === "closed_at_start") {
    return { error: "Kvíz už začal — miesta sa už nedajú pridávať." };
  }
  const cap = Math.max(1, Math.floor(maxPlayers));
  const current = prepaidSeatCount(live);
  if (current >= cap) {
    return { error: `Tím môže mať najviac ${cap} hráčov na tomto kvíze.` };
  }

  const amount = prepaidPriceEur(entryFee);
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
    entryFee: number;
  },
  payer: { name: string; email?: string; phone?: string }
): { team: PayTeam; seat: PaySeat } {
  const amount = walkUpPriceEur(teamOrEvent.entryFee);
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
