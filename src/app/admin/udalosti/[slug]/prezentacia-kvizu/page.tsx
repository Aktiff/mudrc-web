import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";
import QuizDeckEditor from "@/components/QuizDeckEditor";
import { readAllEventsRaw } from "@/lib/storage";

export const dynamic = "force-dynamic";

type PageProps = { params: { slug: string } };

export default async function PrezentaciaKvizuPage({ params }: PageProps) {
  const { events } = await readAllEventsRaw();
  const event = events.find((entry) => entry.slug === params.slug);
  if (!event) notFound();

  return (
    <div className="max-w-4xl">
      <Link
        href="/admin/hotove-kvizy"
        className="inline-flex items-center gap-1 text-sm text-brand-muted hover:text-brand-orange-readable mb-6"
      >
        <ChevronLeft className="w-4 h-4" />
        Späť na Hotové kvízy
      </Link>
      <h1 className="font-display text-4xl text-brand-text tracking-wide mb-1">Prezentácia kvízu</h1>
      <p className="text-brand-muted text-sm mb-8 max-w-2xl leading-relaxed">
        Slidy pre projektor — otázky, kolá, prestávky. Po večeri na odhalenie bodov použite existujúcu{" "}
        <strong>Prezentáciu výsledkov</strong> vo Výsledkoch. Tu nahradíte Canvu pri samotnom kvíze.
      </p>
      <QuizDeckEditor eventSlug={params.slug} />
    </div>
  );
}
