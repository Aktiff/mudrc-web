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

  if (quiz.started || !quiz.registrationOpen) {
    return (
      <div className="space-y-4 max-w-md">
        <h1 className="font-display text-4xl uppercase tracking-wide text-brand-text">Registrácia uzavretá</h1>
        <p className="text-brand-muted">
          {quiz.venue} · {quiz.whenLabel}. Online hold už nie je k dispozícii.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href={href(`/walk-up/${quiz.eventSlug}?date=${encodeURIComponent(quiz.quizDate)}`)} className="btn-primary">
            Walk-up
          </Link>
          <Link href={href("/")} className="btn-outline">
            Späť
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link href={href("/")} className="text-sm text-brand-muted hover:text-brand-text">
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
        basePath={basePath}
      />
    </div>
  );
}
