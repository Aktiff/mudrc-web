import { NextRequest, NextResponse } from "next/server";
import { resolvePayQuiz } from "@/lib/pay-events";
import { triggerFinanceSyncWebhook } from "@/lib/finance-webhook";
import { getTeamByToken, addTeamSeat } from "@/lib/pay-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Add one prepaid pending seat to a team, up to the quiz maxPlayers.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const teamToken = String(body.teamToken ?? "").trim();
  if (!teamToken) {
    return NextResponse.json({ error: "Chýba token tímu." }, { status: 400 });
  }

  const team = await getTeamByToken(teamToken);
  if (!team) {
    return NextResponse.json({ error: "Tím neexistuje." }, { status: 404 });
  }

  const quiz = await resolvePayQuiz(team.eventSlug, team.quizDate);
  if (!quiz) {
    return NextResponse.json({ error: "Kvíz sa nenašiel." }, { status: 404 });
  }

  if (quiz.onlineLocked || !quiz.pricing.onlinePayOpen) {
    return NextResponse.json(
      {
        error: `Online rezervácia je uzamknutá (menej než ${quiz.feeConfig.onlineLockMinutes} min do štartu). Walk-up na mieste za ${quiz.walkUpFee} €.`,
      },
      { status: 403 }
    );
  }

  const result = await addTeamSeat(teamToken, quiz.maxPlayers, quiz.feeConfig);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  if (!result.team.mock) {
    triggerFinanceSyncWebhook("registration.update", { eventSlug: result.team.eventSlug });
  }

  return NextResponse.json({
    ok: true,
    seat: {
      id: result.seat.id,
      index: result.seat.index,
      status: result.seat.status,
      amountEur: result.seat.amountEur,
    },
    players: result.team.players,
    maxPlayers: quiz.maxPlayers,
    teamStatus: result.team.status,
  });
}
