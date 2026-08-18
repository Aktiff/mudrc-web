import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import { readEvents } from "@/lib/storage";
import { absoluteUrl } from "@/lib/site-url";
import { getEventRegionSlug, getRegionsWithVisibleEvents } from "@/lib/regions";
import { isQuizVisible } from "@/lib/data";

export const metadata: Metadata = {
  title: "Kvízy na Slovensku",
  description:
    "Prehľad vedomostných pub kvízov Mudrc podľa regiónov. Prievidza a okolie, čoskoro Bratislava a Trnava.",
  alternates: { canonical: absoluteUrl("/kvizy") },
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function KvizyIndexPage() {
  const { events } = await readEvents();
  const regions = getRegionsWithVisibleEvents(events);
  const visibleCount = events.filter(isQuizVisible).length;

  return (
    <div className="min-h-screen bg-brand-bg pt-16">
      <section className="bg-brand-warm border-b border-brand-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <span className="text-brand-orange-readable text-sm font-semibold uppercase tracking-wider">Mudrc kvíz</span>
          <h1 className="font-display text-6xl sm:text-7xl text-brand-text tracking-wide mt-3">KVÍZY</h1>
          <p className="text-brand-muted text-lg mt-4 max-w-2xl leading-relaxed">
            Vedomostné pub kvízy v partnerských podnikoch. Vyberte región, nájdite najbližší termín a zaregistrujte tím
            online.
          </p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {regions.map((region) => {
            const count = events.filter(
              (event) => isQuizVisible(event) && getEventRegionSlug(event) === region.slug
            ).length;

            return (
              <Link
                key={region.slug}
                href={`/kvizy/${region.slug}`}
                className="card p-8 group hover:border-brand-orange transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-brand-muted text-sm mb-2">
                      <MapPin className="w-4 h-4 text-brand-orange" />
                      {region.name}
                    </div>
                    <h2 className="font-display text-3xl text-brand-text tracking-wide group-hover:text-brand-orange-readable transition-colors">
                      {region.title}
                    </h2>
                    <p className="text-brand-muted text-sm mt-3 leading-relaxed">{region.metaDescription}</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-brand-orange-readable shrink-0 group-hover:translate-x-1 transition-transform" />
                </div>
                <p className="text-brand-muted text-xs mt-6 uppercase tracking-wider font-semibold">
                  {count > 0 ? `${count} aktívnych kvízov` : "Pripravujeme termíny"}
                </p>
              </Link>
            );
          })}
        </div>

        {visibleCount === 0 && (
          <p className="text-brand-muted text-center mt-10">
            Momentálne nemáme zverejnené žiadne termíny. Sleduj nás alebo nás kontaktuj na{" "}
            <a href="mailto:kontakt@mudrc.sk" className="text-brand-orange-readable hover:underline">
              kontakt@mudrc.sk
            </a>
            .
          </p>
        )}
      </section>
    </div>
  );
}
