import Link from "next/link";
import { notFound } from "next/navigation";
import PayCheckoutClient from "@/components/pay/PayCheckoutClient";
import { formatEventDateLabel } from "@/lib/data";
import {
  applyHoldExpiry,
  currentCheckoutUnitPrice,
  pendingPrepaidSeats,
  quizHasStarted,
  teamPricingSnapshot,
  teamSummary,
} from "@/lib/pay-domain";
import { resolvePayQuiz } from "@/lib/pay-events";
import { payRequestContext } from "@/lib/pay-request";
import { getTeamByToken } from "@/lib/pay-storage";

export const dynamic = "force-dynamic";

type Props = { params: { token: string } };

/** Shared team pay link — one URL for the whole team; visitor chooses 1..remaining seats. */
export default async function PaySharedTeamPage({ params }: Props) {
  const raw = await getTeamByToken(params.token, { retries: 8, delayMs: 250 });
  if (!raw) notFound();

  const team = applyHoldExpiry(raw);
  const { href } = payRequestContext();
  const whenLabel = `${formatEventDateLabel(team.quizDate)} · ${team.quizTime}`;
  const summary = teamSummary(team);
  const pending = pendingPrepaidSeats(team);
  const quiz = await resolvePayQuiz(team.eventSlug, team.quizDate);
  const feeConfig = quiz?.feeConfig ?? team.feeConfig;
  const pricing = teamPricingSnapshot({ ...team, feeConfig: feeConfig ?? team.feeConfig });
  const amountEur = currentCheckoutUnitPrice(team, feeConfig);
  const walkUpFee = feeConfig?.walkUpFee ?? pricing.walkUpFee;
  const lockMinutes = feeConfig?.onlineLockMinutes ?? 10;

  let blockedMessage: string | undefined;
  if (team.status === "cancelled") {
    blockedMessage = "Táto rezervácia bola zrušená.";
  } else if (
    !pricing.onlinePayOpen ||
    quizHasStarted(team.quizDate, team.quizTime) ||
    team.status === "closed_at_start"
  ) {
    blockedMessage = `Online predaj je ukončený (menej než ${lockMinutes} min do štartu alebo po štarte). Walk-up na mieste za ${walkUpFee} €.`;
  } else if (pending.length === 0) {
    blockedMessage = "Všetky miesta tohto tímu sú už zaplatené.";
  }

  const pendingLabel =
    summary.pending === 1
      ? "1 miesto ostáva"
      : summary.pending < 5
        ? `${summary.pending} miesta ostávajú`
        : `${summary.pending} miest ostáva`;

  const tierNote =
    pricing.tier === "early"
      ? `Skoré predplatné ${amountEur} € (≥${pricing.earlyWindowHours} h pred štartom)`
      : pricing.tier === "late"
        ? `Neskoré predplatné ${amountEur} € (<${pricing.earlyWindowHours} h pred štartom)`
        : `Walk-up ${walkUpFee} €`;

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <Link
        href={href(`/t/${team.token}`)}
        className="text-sm text-brand-muted hover:text-brand-text inline-block"
      >
        ← Stav tímu
      </Link>
      {!blockedMessage ? (
        <p className="text-sm text-brand-muted text-center sm:text-left -mb-2">
          {tierNote}. Cenník: {pricing.earlyFee}&nbsp;€ / {pricing.lateFee}&nbsp;€ / {pricing.walkUpFee}
          &nbsp;€. Storno ≥{pricing.earlyWindowHours}&nbsp;h → 50&nbsp;% · inak 0&nbsp;%.
        </p>
      ) : null}
      <PayCheckoutClient
        teamToken={team.token}
        amountEur={amountEur}
        seatLabel={pendingLabel}
        teamName={team.teamName}
        venue={team.venue}
        whenLabel={whenLabel}
        teamHref={href(`/t/${team.token}`)}
        homeHref={href("/")}
        remainingPending={summary.pending}
        totalSeats={summary.total}
        blockedMessage={blockedMessage}
      />
    </div>
  );
}
