import Link from "next/link";
import { ChevronLeft, ExternalLink, Trophy } from "lucide-react";
import { notFound } from "next/navigation";
import QuizLibraryEditor from "@/components/QuizLibraryEditor";
import { getQuizUsages } from "@/lib/quiz-library-usage";
import { describeQuizContent } from "@/lib/quiz-template";
import { buildPresentationSlides } from "@/lib/quiz-presentation";
import { readLibraryQuiz } from "@/lib/quiz-library-storage";
import { readAllEventsRaw, readAllStoredQuizzes } from "@/lib/storage";

export const dynamic = "force-dynamic";

type PageProps = { params: { id: string } };

export default async function HotovyKvizDetailPage({ params }: PageProps) {
  const [quiz, storedQuizzes, { events }] = await Promise.all([
    readLibraryQuiz(params.id),
    readAllStoredQuizzes(),
    readAllEventsRaw(),
  ]);
  if (!quiz) notFound();

  const usages = getQuizUsages(params.id, storedQuizzes, events);

  return (
    <div className="min-w-0 max-w-full overflow-x-hidden space-y-8">
      <Link
        href="/admin/hotove-kvizy"
        className="inline-flex items-center gap-1 text-sm text-brand-muted hover:text-brand-orange-readable"
      >
        <ChevronLeft className="w-4 h-4" />
        Späť na zoznam
      </Link>

      <div>
        <h1 className="font-display text-4xl text-brand-text tracking-wide mb-1">{quiz.title}</h1>
        <p className="text-brand-muted text-sm">
          {describeQuizContent(quiz.questions)} · {buildPresentationSlides(quiz.questions).length} slidov na projektore
          {usages.length === 0 ? " · ešte nepoužitý" : ` · ${usages.length}× hraný`}
        </p>
      </div>

      <div className="bg-brand-card rounded-2xl border border-brand-border p-6">
        <h2 className="font-display text-2xl text-brand-text tracking-wide mb-4">Kde bol kvíz použitý</h2>
        {usages.length === 0 ? (
          <p className="text-brand-muted text-sm">Tento kvíz ešte nebol priradený k žiadnym výsledkom.</p>
        ) : (
          <div className="space-y-3">
            {usages.map((usage) => (
              <div
                key={`${usage.eventSlug}-${usage.quizResultId}`}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-brand-border px-4 py-3"
              >
                <div>
                  <div className="font-semibold text-brand-text">
                    {usage.venue} <span className="text-brand-muted font-normal">· {usage.city}</span>
                  </div>
                  <div className="text-sm text-brand-muted mt-0.5">
                    {usage.date} · víťaz {usage.winnerTeam}
                  </div>
                  <div className="text-xs text-brand-muted-light mt-1">
                    Tímy: {usage.teamNames.join(", ")}
                  </div>
                </div>
                <Link
                  href={`/admin/udalosti/${usage.eventSlug}/kviz/${usage.quizResultId}`}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-brand-orange-readable hover:underline shrink-0"
                >
                  <Trophy className="w-4 h-4" />
                  Výsledky
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="font-display text-2xl text-brand-text tracking-wide mb-1">Slidy a otázky</h2>
        <p className="text-brand-muted text-sm mb-4">
          Vľavo editor kvízu, vpravo banka hotových otázok — obe polovice obrazovky.
        </p>
        <QuizLibraryEditor quizId={params.id} initialQuiz={quiz} />
      </div>
    </div>
  );
}
