import Link from "next/link";
import { notFound } from "next/navigation";
import PayTeamDashboard from "@/components/pay/PayTeamDashboard";
import { formatEventDateLabel } from "@/lib/data";
import { applyHoldExpiry } from "@/lib/pay-domain";
import { payRequestContext } from "@/lib/pay-request";
import { getTeamByToken } from "@/lib/pay-storage";

export const dynamic = "force-dynamic";

type Props = { params: { token: string } };

export default async function PayTeamPage({ params }: Props) {
  const raw = await getTeamByToken(params.token);
  if (!raw) notFound();
  const team = applyHoldExpiry(raw);
  const { href, basePath, origin } = payRequestContext();
  const whenLabel = `${formatEventDateLabel(team.quizDate)} · ${team.quizTime}`;

  return (
    <div className="space-y-6">
      <Link href={href("/")} className="text-sm text-brand-muted hover:text-brand-text">
        ← Všetky kvízy
      </Link>
      <PayTeamDashboard team={team} whenLabel={whenLabel} basePath={basePath} origin={origin} />
      <p className="text-xs text-brand-muted">
        Check-in večer:{" "}
        <Link
          className="underline hover:text-brand-text"
          href={href(`/check-in/${team.eventSlug}?date=${encodeURIComponent(team.quizDate)}`)}
        >
          zoznam paid
        </Link>
      </p>
    </div>
  );
}
