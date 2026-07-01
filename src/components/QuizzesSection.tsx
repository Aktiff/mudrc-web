import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { isQuizVisible } from "@/lib/data";
import { readPublicEvents } from "@/lib/public-events";
import { getRegionsWithVisibleEvents } from "@/lib/regions";
import QuizEventCards from "./QuizEventCards";

export default async function QuizzesSection() {
  const events = await readPublicEvents();
  const visibleEvents = events.filter(isQuizVisible);
  const regions = getRegionsWithVisibleEvents(events);

  return (
    <section id="kvizy" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <span className="text-brand-orange-readable text-sm font-semibold uppercase tracking-wider">
            Nadchádzajúce termíny
          </span>
          <h2 className="section-title mt-2">
            Najbližšie kvízy
            <br />
            <span className="text-gradient">vo vašom okolí</span>
          </h2>
          {regions.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {regions.map((region) => (
                <Link
                  key={region.slug}
                  href={`/kvizy/${region.slug}`}
                  className="inline-flex items-center gap-1 text-sm font-semibold text-brand-orange-readable hover:underline"
                >
                  Kvízy {region.name}
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              ))}
            </div>
          )}
        </div>
        <p className="text-brand-muted text-lg md:text-right md:max-w-sm">
          Vyberte si svoj podnik, zaregistrujte tím a príďte sa zabaviť. Miesta sa rýchlo míňajú, preto registráciu
          neodkladajte!
        </p>
      </div>
      <QuizEventCards events={visibleEvents} />
    </section>
  );
}
