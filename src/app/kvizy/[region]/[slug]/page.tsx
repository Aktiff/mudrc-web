import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { buildBreadcrumbJsonLd, buildEventJsonLd, buildEventMetadata } from "@/lib/seo";
import { isPollActive } from "@/lib/poll-storage";
import { eventPath, getEventRegionSlug, getRegion, isRegionSlug } from "@/lib/regions";
import { eventForPublicTerm, findFutureQuiz, visiblePublicNights } from "@/lib/future-quizzes";
import { getPublicEventBySlug } from "@/lib/public-events";
import { formatEventDateLabel } from "@/lib/data";
import { leagueMergeGroups } from "@/lib/team-links";
import { readTeamLinkRecords } from "@/lib/venue-teams";
import EventDetailPage from "@/components/EventDetailPage";
import JsonLd from "@/components/JsonLd";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PageProps = {
  params: { region: string; slug: string };
  searchParams?: { termin?: string | string[] };
};

function termParam(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

function nearerSpecialDate(event: NonNullable<Awaited<ReturnType<typeof getPublicEventBySlug>>>, termin: string): string | null {
  if (findFutureQuiz(event, termin)) return null;
  const visible = visiblePublicNights(event);
  if (visible.some((night) => !night.extraId)) return null;
  return visible[0]?.extraId ? visible[0].date : null;
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  if (!isRegionSlug(params.region)) return {};
  const event = await getPublicEventBySlug(params.slug);
  if (!event) return {};
  const term = nearerSpecialDate(event, termParam(searchParams?.termin)) ?? termParam(searchParams?.termin);
  const extra = findFutureQuiz(event, term);
  return buildEventMetadata(eventForPublicTerm(event, term), getEventRegionSlug(event), extra ? { term: extra.date } : undefined);
}

export default async function QuizEventPage({ params, searchParams }: PageProps) {
  if (!isRegionSlug(params.region)) notFound();

  const event = await getPublicEventBySlug(params.slug);
  if (!event) notFound();

  const regionSlug = getEventRegionSlug(event);
  if (params.region !== regionSlug) {
    redirect(`/kvizy/${regionSlug}/${params.slug}`);
  }

  const requestedTerm = termParam(searchParams?.termin);
  const nearerSpecial = nearerSpecialDate(event, requestedTerm);
  const basePath = eventPath(event);
  if (nearerSpecial) {
    redirect(`${basePath}?termin=${encodeURIComponent(nearerSpecial)}`);
  }
  const termin = requestedTerm;
  const viewingExtra = findFutureQuiz(event, termin);
  const view = eventForPublicTerm(event, termin);
  const otherTerms = visiblePublicNights(event)
    .filter((night) => (viewingExtra ? night.extraId !== viewingExtra.id : Boolean(night.extraId)))
    .map((night) => ({
      href: night.extraId ? `${basePath}?termin=${encodeURIComponent(night.date)}` : basePath,
      label: night.extraId
        ? `${formatEventDateLabel(night.date)} · ${night.quizType}`
        : `Bežný kvíz: ${formatEventDateLabel(night.date)}`,
    }));

  const region = getRegion(regionSlug)!;
  const pollActive = await isPollActive(event.slug, event.venue);
  const pollHref = pollActive ? `/kvizy/${regionSlug}/${event.slug}/hlasovanie` : undefined;

  return (
    <>
      <JsonLd
        data={[
          buildEventJsonLd(view, regionSlug, viewingExtra ? { term: viewingExtra.date } : undefined),
          buildBreadcrumbJsonLd([
            { name: "Domov", path: "/" },
            { name: "Kvízy", path: "/kvizy" },
            { name: region.name, path: `/kvizy/${regionSlug}` },
            { name: event.venue, path: `/kvizy/${regionSlug}/${event.slug}` },
          ]),
        ]}
      />
      <EventDetailPage
        event={view}
        region={regionSlug}
        pollHref={pollHref}
        leagueMerges={leagueMergeGroups(await readTeamLinkRecords())}
        otherTerms={otherTerms}
      />
    </>
  );
}
