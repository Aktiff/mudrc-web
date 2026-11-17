import { NextRequest, NextResponse } from "next/server";
import { PAY_MOCK_MODE } from "@/lib/pay-config";
import { paySeatMock } from "@/lib/pay-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * MOCK ONLY: clicking card payment instantly marks the seat as paid.
 * No Stripe / PSP — staging for pay.mudrc.sk UX and capacity rules.
 */
export async function POST(req: NextRequest) {
  if (!PAY_MOCK_MODE) {
    return NextResponse.json({ error: "Mock platby sú vypnuté." }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const seatToken = String(body.seatToken ?? "").trim();
  const payerName = typeof body.payerName === "string" ? body.payerName.trim() : undefined;
  const payerEmail = typeof body.payerEmail === "string" ? body.payerEmail.trim() : undefined;

  if (!seatToken) {
    return NextResponse.json({ error: "Chýba token lístka." }, { status: 400 });
  }

  const result = await paySeatMock(seatToken, { name: payerName, email: payerEmail });
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    mock: true,
    message: "Testovacia platba úspešná (mock — bez skutočnej karty).",
    seat: {
      id: result.seat.id,
      index: result.seat.index,
      status: result.seat.status,
      amountEur: result.seat.amountEur,
      paidAt: result.seat.paidAt,
    },
    teamToken: result.team.token,
    teamStatus: result.team.status,
  });
}
