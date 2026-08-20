import QuizLibraryShowPageClient from "@/components/QuizLibraryShowPageClient";

export const dynamic = "force-dynamic";

type PageProps = { params: { id: string } };

export default function HotovyKvizPrehratPage({ params }: PageProps) {
  return <QuizLibraryShowPageClient quizId={params.id} />;
}
