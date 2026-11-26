import { NextRequest, NextResponse } from "next/server";
import { absoluteCaptainTeamUrl, sendCaptainTeamAccessEmail } from "@/lib/pay-email";
import { getPayBasePath, payHref, payPublicOrigin } from "@/lib/pay-config";
import { resolvePayQuiz } from "@/lib/pay-events";
import { triggerFinanceSyncWebhook } from "@/lib/finance-webhook";
import { registerPayTeam } from "@/lib/pay-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const eventSlug = String(body.eventSlug ?? "").trim();
  const teamName = String(body.teamName ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const playersRaw = Number(body.players);
  const quizDate = typeof body.quizDate === "string" ? body.quizDate.trim() : "";

  if (!eventSlug || !teamName || !phone || !email) {
    return NextResponse.json({ error: "Vyplň názov tímu, telefón a e-mail." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Zadaj platný e-mail kapitána." }, { status: 400 });
  }
  const phoneDigits = phone.replace(/\D/g, "");
  if (phoneDigits.length < 9) {
    return NextResponse.json({ error: "Telefónne číslo kapitána je povinné (aspoň 9 číslic)." }, { status: 400 });
  }

  const quiz = await resolvePayQuiz(eventSlug, quizDate || undefined);
  if (!quiz) {
    return NextResponse.json({ error: "Kvíz sa nenašiel." }, { status: 404 });
  }
  if (quiz.started) {
    return NextResponse.json(
      {
        error: `Kvíz už začal. Online rezervácia je uzavretá — walk-up na mieste za ${quiz.walkUpFee} €.`,
      },
      { status: 403 }
    );
  }
  if (quiz.onlineLocked || !quiz.pricing.onlineRegistrationOpen) {
    return NextResponse.json(
      {
        error: `Online registrácia je uzamknutá (menej než ${quiz.feeConfig.onlineLockMinutes} min do štartu). Walk-up na mieste za ${quiz.walkUpFee} €.`,
      },
      { status: 403 }
    );
  }
  if (!quiz.registrationOpen) {
    return NextResponse.json({ error: "Registrácie na tento termín sú uzavreté." }, { status: 403 });
  }

  const playerMin = Math.max(2, quiz.minPlayers);
  const players = Math.floor(playersRaw);
  if (!Number.isFinite(players) || players < playerMin || players > quiz.maxPlayers) {
    return NextResponse.json(
      { error: `Počet hráčov musí byť ${playerMin}–${quiz.maxPlayers}.` },
      { status: 400 }
    );
  }

  try {
    const team = await registerPayTeam({
      eventSlug: quiz.eventSlug,
      venue: quiz.venue,
      city: quiz.city,
      quizDate: quiz.quizDate,
      quizTime: quiz.quizTime,
      teamName,
      players,
      captainPhone: phone,
      captainEmail: email,
      entryFee: quiz.earlyFee,
      feeConfig: quiz.feeConfig,
    });

    if (!team.mock) {
      triggerFinanceSyncWebhook("registration.create", { eventSlug: team.eventSlug });
    }

    const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
    const proto = req.headers.get("x-forwarded-proto");
    const teamUrl = absoluteCaptainTeamUrl(team.token, { host, proto });
    const basePath = getPayBasePath(host);
    const origin = payPublicOrigin(host, proto);
    // Captain goes straight to the shared pay-link checkout (not just the team dashboard).
    const payPath = payHref(basePath, `/s/${team.token}`);
    const payUrl = `${origin}${payPath}`;

    let captainEmailSent = false;
    let captainEmailSkipped = false;
    let captainEmailWarning: string | undefined;
    let captainEmailId: string | undefined;
    const mail = await sendCaptainTeamAccessEmail({ team, teamUrl });
    captainEmailSent = mail.ok && !mail.skipped;
    captainEmailSkipped = !!mail.skipped;
    captainEmailId = mail.id;
    if (!mail.ok) {
      captainEmailWarning = mail.error;
      console.warn("Pay register succeeded but captain access email failed:", mail.error);
    }

    return NextResponse.json({
      ok: true,
      mock: true,
      teamToken: team.token,
      teamId: team.id,
      teamUrl,
      payUrl,
      payPath,
      prepaidPrice: quiz.prepaidPrice,
      tier: quiz.pricing.tier,
      tierLadderCopy: quiz.tierLadderCopy,
      captainEmailSent,
      captainEmailSkipped,
      captainEmailId,
      ...(captainEmailWarning ? { captainEmailWarning } : {}),
      seats: team.seats.map((s) => ({
        index: s.index,
        token: s.token,
        amountEur: s.amountEur,
        status: s.status,
      })),
    });
  } catch (error) {
    console.error("pay register failed:", error);
    const message = error instanceof Error ? error.message : "Neznáma chyba";
    return NextResponse.json({ error: "Registráciu sa nepodarilo uložiť.", detail: message }, { status: 500 });
  }
}
