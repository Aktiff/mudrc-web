import Link from "next/link";
import { notFound } from "next/navigation";
import PayCheckInClient from "@/components/pay/PayCheckInClient";
import { applyHoldExpiry, paidSeats } from "@/lib/pay-domain";
import { resolvePayQuiz } from "@/lib/pay-events";
import { payRequestContext } from "@/lib/pay-request";
import { teamsForEvent } from "@/lib/pay-storage";

export const dynamic = "force-dynamic";

type Props = {
  params: { slug: string };
  searchParams?: { date?: string };
};

export default async function PayCheckInPage({ params, searchParams }: Props) {
  const quiz = await resolvePayQuiz(params.slug, searchParams?.date);
  if (!quiz) notFound();

  const { href } = payRequestContext();
  const teams = (await teamsForEvent(quiz.eventSlug, quiz.quizDate)).map((t) => applyHoldExpiry(t));
  const rows = teams.flatMap((team) =>
    paidSeats(team).map((seat) => ({
      teamId: team.id,
      teamName: team.teamName,
      seat,
    }))
  );

  return (
    <div className="space-y-6">
      <Link href={href("/")} className="text-sm text-brand-muted hover:text-brand-text">
        ← Všetky kvízy
      </Link>
      <PayCheckInClient
        venue={quiz.venue}
        whenLabel={quiz.whenLabel}
        rows={rows}
        walkUpHref={href(`/walk-up/${quiz.eventSlug}?date=${encodeURIComponent(quiz.quizDate)}`)}
      />
    </div>
  );
}
