import Link from "next/link";
import { notFound } from "next/navigation";
import PayWalkUpForm from "@/components/pay/PayWalkUpForm";
import { resolvePayQuiz } from "@/lib/pay-events";
import { payRequestContext } from "@/lib/pay-request";

export const dynamic = "force-dynamic";

type Props = {
  params: { slug: string };
  searchParams?: { date?: string };
};

export default async function PayWalkUpPage({ params, searchParams }: Props) {
  const quiz = await resolvePayQuiz(params.slug, searchParams?.date);
  if (!quiz) notFound();
  const { href } = payRequestContext();

  return (
    <div className="space-y-6">
      <Link href={href(`/check-in/${quiz.eventSlug}?date=${encodeURIComponent(quiz.quizDate)}`)} className="text-sm text-brand-muted hover:text-brand-text">
        ← Check-in
      </Link>
      <PayWalkUpForm
        eventSlug={quiz.eventSlug}
        quizDate={quiz.quizDate}
        venue={quiz.venue}
        whenLabel={quiz.whenLabel}
        walkUpPrice={quiz.walkUpPrice}
        prepaidPrice={quiz.prepaidPrice}
        checkInHref={href(`/check-in/${quiz.eventSlug}?date=${encodeURIComponent(quiz.quizDate)}`)}
      />
    </div>
  );
}
