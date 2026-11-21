import { NextRequest, NextResponse } from "next/server";
import { PAY_MOCK_MODE } from "@/lib/pay-config";
import type { PaySeat, PayTeam } from "@/lib/pay-domain";
import { sendPaymentConfirmationEmail } from "@/lib/pay-email";
import { resolvePayQuiz } from "@/lib/pay-events";
import { findSeatByToken, getTeamByToken, paySeatMock, payTeamSeatsMock } from "@/lib/pay-storage";
import type { FeeTierConfig } from "@/lib/pay-pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * MOCK ONLY: clicking card payment instantly marks seat(s) as paid.
 * Prefer teamToken (shared team pay link → next N pending seats; quantity default 1).
 * seatToken kept for legacy per-seat URLs (always 1 seat).
 * Charge = current tier price at payment time (early 4 € / late 5 €).
 * No Stripe / PSP — staging for pay.mudrc.sk UX and capacity rules.
 * When payerEmail is provided, sends one payment confirmation covering all paid seats.
 */
export async function POST(req: NextRequest) {
  if (!PAY_MOCK_MODE) {
    return NextResponse.json({ error: "Mock platby sú vypnuté." }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const teamToken = String(body.teamToken ?? "").trim();
  const seatToken = String(body.seatToken ?? "").trim();
  const payerName = typeof body.payerName === "string" ? body.payerName.trim() : undefined;
  const payerEmail = typeof body.payerEmail === "string" ? body.payerEmail.trim() : undefined;
  const rawQuantity = body.quantity;
  const quantity =
    rawQuantity === undefined || rawQuantity === null || rawQuantity === ""
      ? 1
      : Math.floor(Number(rawQuantity));

  if (!teamToken && !seatToken) {
    return NextResponse.json({ error: "Chýba token tímu alebo lístka." }, { status: 400 });
  }

  if (seatToken && quantity !== 1) {
    return NextResponse.json(
      { error: "Jednotlivý lístok sa platí vždy po jednom mieste." },
      { status: 400 }
    );
  }

  if (!Number.isFinite(quantity) || quantity < 1) {
    return NextResponse.json({ error: "Počet miest musí byť aspoň 1." }, { status: 400 });
  }

  let feeOverride: FeeTierConfig | undefined;
  const lookup = teamToken
    ? await getTeamByToken(teamToken, { retries: 2, delayMs: 100 })
    : (await findSeatByToken(seatToken))?.team;
  if (lookup) {
    const quiz = await resolvePayQuiz(lookup.eventSlug, lookup.quizDate);
    feeOverride = quiz?.feeConfig ?? lookup.feeConfig;
  }

  let seats: PaySeat[];
  let team: PayTeam;

  if (teamToken) {
    const result = await payTeamSeatsMock(
      teamToken,
      quantity,
      {
        name: payerName,
        email: payerEmail,
      },
      feeOverride
    );
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    seats = result.seats;
    team = result.team;
  } else {
    const result = await paySeatMock(seatToken, { name: payerName, email: payerEmail }, feeOverride);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    seats = [result.seat];
    team = result.team;
  }

  const primary = seats[0];
  const totalEur = Math.round(seats.reduce((sum, s) => sum + s.amountEur, 0) * 100) / 100;

  let emailSent = false;
  let emailSkipped = false;
  let emailWarning: string | undefined;
  let emailId: string | undefined;
  // Always prefer the address the payer typed at checkout — confirmation is for the customer.
  const toEmail = (payerEmail || primary.payerEmail || "").trim().toLowerCase() || undefined;
  if (toEmail) {
    const mail = await sendPaymentConfirmationEmail({
      team,
      seats,
      toEmail,
    });
    emailSent = mail.ok && !mail.skipped;
    emailSkipped = !!mail.skipped;
    emailId = mail.id;
    if (!mail.ok) {
      emailWarning = mail.error;
      console.warn("Pay mock succeeded but confirmation email failed:", mail.error);
    }
  } else {
    emailSkipped = true;
  }

  const unitEur = primary.amountEur;

  return NextResponse.json({
    ok: true,
    mock: true,
    message: "Testovacia platba úspešná (mock — bez skutočnej karty).",
    quantity: seats.length,
    unitEur,
    totalEur,
    seat: {
      id: primary.id,
      index: primary.index,
      status: primary.status,
      amountEur: primary.amountEur,
      paidAt: primary.paidAt,
    },
    seats: seats.map((s) => ({
      id: s.id,
      index: s.index,
      status: s.status,
      amountEur: s.amountEur,
      paidAt: s.paidAt,
    })),
    teamToken: team.token,
    teamStatus: team.status,
    remainingPending: team.seats.filter(
      (s) => s.kind === "prepaid" && s.status === "pending_payment"
    ).length,
    emailTo: toEmail ?? null,
    emailSent,
    emailSkipped,
    emailWarning,
    emailId: emailId ?? null,
  });
}
