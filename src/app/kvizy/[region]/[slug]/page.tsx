import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { buildBreadcrumbJsonLd, buildEventJsonLd, buildEventMetadata } from "@/lib/seo";
import { isPollActive } from "@/lib/poll-storage";
import { getEventRegionSlug, getRegion, isRegionSlug } from "@/lib/regions";
import { getPublicEventBySlug } from "@/lib/public-events";
import EventDetailPage from "@/components/EventDetailPage";
import JsonLd from "@/components/JsonLd";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PageProps = { params: { region: string; slug: string } };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  if (!isRegionSlug(params.region)) return {};
  const event = await getPublicEventBySlug(params.slug);
  if (!event) return {};
  return buildEventMetadata(event, getEventRegionSlug(event));
}

export default async function QuizEventPage({ params }: PageProps) {
  if (!isRegionSlug(params.region)) notFound();

  const event = await getPublicEventBySlug(params.slug);
  if (!event) notFound();

  const regionSlug = getEventRegionSlug(event);
  if (params.region !== regionSlug) {
    redirect(`/kvizy/${regionSlug}/${params.slug}`);
  }

  const region = getRegion(regionSlug)!;
  const pollActive = await isPollActive(event.slug, event.venue);
  const pollHref = pollActive ? `/kvizy/${regionSlug}/${event.slug}/hlasovanie` : undefined;

  return (
    <>
      <JsonLd
        data={[
          buildEventJsonLd(event, regionSlug),
          buildBreadcrumbJsonLd([
            { name: "Domov", path: "/" },
            { name: "Kvízy", path: "/kvizy" },
            { name: region.name, path: `/kvizy/${regionSlug}` },
            { name: event.venue, path: `/kvizy/${regionSlug}/${event.slug}` },
          ]),
        ]}
      />
      <EventDetailPage event={event} region={regionSlug} pollHref={pollHref} />
    </>
  );
}
