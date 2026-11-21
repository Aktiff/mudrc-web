import Link from "next/link";
import { notFound } from "next/navigation";
import PayTeamDashboard from "@/components/pay/PayTeamDashboard";
import { formatEventDateLabel } from "@/lib/data";
import { applyHoldExpiry, currentCheckoutUnitPrice, teamPricingSnapshot } from "@/lib/pay-domain";
import { resolvePayQuiz } from "@/lib/pay-events";
import { payRequestContext } from "@/lib/pay-request";
import { getTeamByToken } from "@/lib/pay-storage";

export const dynamic = "force-dynamic";

type Props = { params: { token: string } };

export default async function PayTeamPage({ params }: Props) {
  // Retries: Vercel Blob can take a moment to list a freshly written booking.
  const raw = await getTeamByToken(params.token, { retries: 10, delayMs: 300 });
  if (!raw) notFound();
  const team = applyHoldExpiry(raw);
  const { href, basePath, origin } = payRequestContext();
  const whenLabel = `${formatEventDateLabel(team.quizDate)} · ${team.quizTime}`;
  const quiz = await resolvePayQuiz(team.eventSlug, team.quizDate);
  const maxPlayers = quiz?.maxPlayers ?? Math.max(team.players, 8);
  const feeConfig = quiz?.feeConfig ?? team.feeConfig;
  const pricing = teamPricingSnapshot({ ...team, feeConfig: feeConfig ?? team.feeConfig });

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <Link href={href("/")} className="text-sm text-brand-muted hover:text-brand-text inline-block">
        ← Všetky kvízy
      </Link>
      <PayTeamDashboard
        team={team}
        whenLabel={whenLabel}
        basePath={basePath}
        origin={origin}
        maxPlayers={maxPlayers}
        currentUnitPrice={currentCheckoutUnitPrice(team, feeConfig)}
        earlyFee={pricing.earlyFee}
        lateFee={pricing.lateFee}
        walkUpFee={pricing.walkUpFee}
        onlinePayOpen={pricing.onlinePayOpen}
      />
    </div>
  );
}
