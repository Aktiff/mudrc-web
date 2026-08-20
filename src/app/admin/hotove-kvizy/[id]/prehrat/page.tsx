import QuizLibraryShow from "@/components/QuizLibraryShow";

export const dynamic = "force-dynamic";

type PageProps = { params: { id: string } };

export default function HotovyKvizPrehratPage({ params }: PageProps) {
  return <QuizLibraryShow quizId={params.id} />;
}
