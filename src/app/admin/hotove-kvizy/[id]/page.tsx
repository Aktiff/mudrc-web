import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";
import QuizLibraryEditor from "@/components/QuizLibraryEditor";
import { describeQuizContent } from "@/lib/quiz-template";
import { buildPresentationSlides } from "@/lib/quiz-presentation";
import { readLibraryQuiz } from "@/lib/quiz-library-storage";

export const dynamic = "force-dynamic";

type PageProps = { params: { id: string } };

export default async function HotovyKvizDetailPage({ params }: PageProps) {
  let quiz: Awaited<ReturnType<typeof readLibraryQuiz>> = null;
  try {
    quiz = await readLibraryQuiz(params.id);
  } catch {
    return (
      <div className="space-y-4">
        <p className="text-red-500 text-sm">Kvíz sa nepodarilo načítať.</p>
        <a href={`/admin/hotove-kvizy/${params.id}`} className="btn-primary text-sm py-2.5 px-5 inline-flex">
          Načítať znova
        </a>
      </div>
    );
  }
  if (!quiz) notFound();

  return (
    <div className="min-w-0 max-w-full space-y-8">
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
        </p>
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
