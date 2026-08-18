import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { readEvents } from "@/lib/storage";
import { buildRegionMetadata } from "@/lib/seo";
import { getRegion, getVisibleEventsByRegion, isRegionSlug } from "@/lib/regions";
import QuizEventCards from "@/components/QuizEventCards";
import JsonLd from "@/components/JsonLd";
import Breadcrumbs from "@/components/Breadcrumbs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = { params: { region: string } };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  if (!isRegionSlug(params.region)) return {};
  return buildRegionMetadata(params.region);
}

export default async function RegionQuizzesPage({ params }: PageProps) {
  if (!isRegionSlug(params.region)) notFound();
  const region = getRegion(params.region)!;
  const { events } = await readEvents();
  const visibleEvents = getVisibleEventsByRegion(events, params.region);

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: region.title,
          description: region.metaDescription,
          about: {
            "@type": "Thing",
            name: `Pub kvízy ${region.name}`,
          },
        }}
      />

      <div className="min-h-screen bg-brand-bg pt-16">
        <section className="bg-brand-warm border-b border-brand-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <Breadcrumbs
              items={[
                { label: "Domov", href: "/" },
                { label: "Kvízy", href: "/kvizy" },
                { label: region.name },
              ]}
            />
            <span className="text-brand-orange-readable text-sm font-semibold uppercase tracking-wider">
              Mudrc kvíz
            </span>
            <h1 className="font-display text-6xl sm:text-7xl text-brand-text tracking-wide mt-3">{region.title}</h1>
            <p className="text-brand-muted text-lg mt-4 max-w-3xl leading-relaxed">{region.seoIntro}</p>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div>
              <h2 className="font-display text-4xl text-brand-text tracking-wide">Nadchádzajúce termíny</h2>
              <p className="text-brand-muted mt-2 max-w-xl">
                Registrácia tímu je online. Vyberte podnik, skontrolujte dátum a príďte sa zabaviť.
              </p>
            </div>
            <Link href="/#kvizy" className="text-sm font-semibold text-brand-orange-readable hover:underline">
              Všetky kvízy na homepage →
            </Link>
          </div>

          <QuizEventCards events={visibleEvents} />

          <div className="mt-16 bg-brand-card border border-brand-border rounded-2xl p-8">
            <h2 className="font-display text-3xl text-brand-text tracking-wide mb-4">
              Často hľadané: kvízy {region.name.toLowerCase()}
            </h2>
            <div className="text-brand-muted leading-relaxed space-y-3 text-sm md:text-base">
              <p>
                Ak hľadáte <strong>kvíz v {region.name.toLowerCase()}</strong>, ste na správnom mieste. Mudrc organizuje
                pravidelné vedomostné pub kvízy v partnerských podnikoch — stačí si vybrať termín, zaregistrovať tím a
                prísť včas.
              </p>
              <p>
                Vstupné, počet hráčov v tíme a pravidlá nájdete pri každom podujatí. Po skončení kvízu môžete sledovať aj
                ligovú tabuľku a porovnať výsledky s ostatnými tímami.
              </p>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
