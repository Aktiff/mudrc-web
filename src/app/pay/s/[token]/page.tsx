import Link from "next/link";
import { notFound } from "next/navigation";
import PayCheckoutClient from "@/components/pay/PayCheckoutClient";
import { formatEventDateLabel } from "@/lib/data";
import { applyHoldExpiry, pendingPrepaidSeats, quizHasStarted, teamSummary } from "@/lib/pay-domain";
import { payRequestContext } from "@/lib/pay-request";
import { getTeamByToken } from "@/lib/pay-storage";

export const dynamic = "force-dynamic";

type Props = { params: { token: string } };

/** Shared team pay link — one URL for the whole team; each visitor pays one seat. */
export default async function PaySharedTeamPage({ params }: Props) {
  const raw = await getTeamByToken(params.token);
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
    blockedMessage = "Kvíz už začal — online predaj pending slotov skončil. Walk-up na mieste.";
  } else if (pending.length === 0) {
    blockedMessage = "Všetky miesta tohto tímu sú už zaplatené.";
  }

  return (
    <div className="space-y-6">
      <Link href={href(`/t/${team.token}`)} className="text-sm text-brand-muted hover:text-brand-text">
        ← Stav tímu
      </Link>
      <PayCheckoutClient
        teamToken={team.token}
        amountEur={amountEur}
        seatLabel={`1 miesto (${summary.pending} ostáva)`}
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
