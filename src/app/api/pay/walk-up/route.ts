import { NextRequest, NextResponse } from "next/server";
import { PAY_MOCK_MODE } from "@/lib/pay-config";
import { resolvePayQuiz } from "@/lib/pay-events";
import { createAndPayWalkUp } from "@/lib/pay-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** MOCK walk-up: creates a paid seat at walk-up fee (default 6 €). */
export async function POST(req: NextRequest) {
  if (!PAY_MOCK_MODE) {
    return NextResponse.json({ error: "Mock platby sú vypnuté." }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const eventSlug = String(body.eventSlug ?? "").trim();
  const quizDate = typeof body.quizDate === "string" ? body.quizDate.trim() : "";
  const name = String(body.name ?? "").trim();
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";

  if (!eventSlug || !name) {
    return NextResponse.json({ error: "Zadaj meno hosťa a kvíz." }, { status: 400 });
  }

  const quiz = await resolvePayQuiz(eventSlug, quizDate || undefined);
  if (!quiz) {
    return NextResponse.json({ error: "Kvíz sa nenašiel." }, { status: 404 });
  }

  try {
    const { team, seat } = await createAndPayWalkUp({
      eventSlug: quiz.eventSlug,
      venue: quiz.venue,
      city: quiz.city,
      quizDate: quiz.quizDate,
      quizTime: quiz.quizTime,
      entryFee: quiz.earlyFee,
      feeConfig: quiz.feeConfig,
      name,
      email: email || undefined,
      phone: phone || undefined,
    });
    return NextResponse.json({
      ok: true,
      mock: true,
      amountEur: seat.amountEur,
      seatId: seat.id,
      teamId: team.id,
      message: `Walk-up mock platba úspešná (${seat.amountEur} €).`,
    });
  } catch (error) {
    console.error("walk-up failed:", error);
    return NextResponse.json({ error: "Walk-up sa nepodaril." }, { status: 500 });
  }
}
