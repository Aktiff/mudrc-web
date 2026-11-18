import Link from "next/link";
import { notFound } from "next/navigation";
import PayCheckoutClient from "@/components/pay/PayCheckoutClient";
import { formatEventDateLabel } from "@/lib/data";
import { applyHoldExpiry, pendingPrepaidSeats, quizHasStarted, teamSummary } from "@/lib/pay-domain";
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
  const amountEur = team.seats.find((s) => s.kind === "prepaid")?.amountEur ?? pending[0]?.amountEur ?? 0;

  let blockedMessage: string | undefined;
  if (team.status === "cancelled") {
    blockedMessage = "Táto rezervácia bola zrušená.";
  } else if (quizHasStarted(team.quizDate, team.quizTime) || team.status === "closed_at_start") {
    blockedMessage = "Kvíz už začal — online predaj nezaplatených miest skončil. Walk-up na mieste.";
  } else if (pending.length === 0) {
    blockedMessage = "Všetky miesta tohto tímu sú už zaplatené.";
  }

  const pendingLabel =
    summary.pending === 1
      ? "1 miesto ostáva"
      : summary.pending < 5
        ? `${summary.pending} miesta ostávajú`
        : `${summary.pending} miest ostáva`;

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <Link
        href={href(`/t/${team.token}`)}
        className="text-sm text-brand-muted hover:text-brand-text inline-block"
      >
        ← Stav tímu
      </Link>
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
