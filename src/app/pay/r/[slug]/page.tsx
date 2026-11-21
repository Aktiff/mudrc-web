import Link from "next/link";
import { notFound } from "next/navigation";
import PayRegisterForm from "@/components/pay/PayRegisterForm";
import { resolvePayQuiz } from "@/lib/pay-events";
import { payRequestContext } from "@/lib/pay-request";

export const dynamic = "force-dynamic";

type Props = {
  params: { slug: string };
  searchParams?: { date?: string };
};

export default async function PayRegisterPage({ params, searchParams }: Props) {
  const quiz = await resolvePayQuiz(params.slug, searchParams?.date);
  if (!quiz) notFound();

  const { href, basePath } = payRequestContext();

  if (quiz.started || quiz.onlineLocked || !quiz.registrationOpen) {
    const lockedEarly = quiz.onlineLocked && !quiz.started;
    return (
      <div className="mx-auto max-w-md space-y-4 text-center">
        <h1 className="font-display text-4xl uppercase tracking-wide text-brand-text">
          {lockedEarly ? "Online registrácia uzamknutá" : "Registrácia uzavretá"}
        </h1>
        <p className="text-brand-muted">
          {quiz.venue} · {quiz.whenLabel}.
          {lockedEarly
            ? ` Menej než ${quiz.feeConfig.onlineLockMinutes} minút do štartu — nové online rezervácie už nie sú. Walk-up na mieste za ${quiz.walkUpFee} €.`
            : " Online hold už nie je k dispozícii."}
        </p>
        <p className="text-sm text-brand-muted">
          Cenník: {quiz.earlyFee}&nbsp;€ / {quiz.lateFee}&nbsp;€ / {quiz.walkUpFee}&nbsp;€ (skôr = lacnejšie).
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link href={href(`/walk-up/${quiz.eventSlug}?date=${encodeURIComponent(quiz.quizDate)}`)} className="btn-primary">
            Walk-up {quiz.walkUpFee}&nbsp;€
          </Link>
          <Link href={href("/")} className="btn-outline">
            Späť
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <Link href={href("/")} className="text-sm text-brand-muted hover:text-brand-text inline-block">
        ← Všetky kvízy
      </Link>
      <PayRegisterForm
        eventSlug={quiz.eventSlug}
        quizDate={quiz.quizDate}
        venue={quiz.venue}
        whenLabel={quiz.whenLabel}
        minPlayers={quiz.minPlayers}
        maxPlayers={quiz.maxPlayers}
        prepaidPrice={quiz.prepaidPrice}
        earlyFee={quiz.earlyFee}
        lateFee={quiz.lateFee}
        walkUpFee={quiz.walkUpFee}
        tierLadderCopy={quiz.tierLadderCopy}
        pricingTier={quiz.pricing.tier}
        basePath={basePath}
      />
    </div>
  );
}
