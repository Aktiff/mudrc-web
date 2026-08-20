import QuizDeckShow from "@/components/QuizDeckShow";

export const dynamic = "force-dynamic";

type PageProps = { params: { slug: string } };

export default function PrezentaciaKvizuShowPage({ params }: PageProps) {
  return <QuizDeckShow eventSlug={params.slug} />;
}
