import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Breadcrumbs from "@/components/Breadcrumbs";
import PollVoting from "@/components/PollVoting";
import { collectEventTeamNames } from "@/lib/data";
import { getPollPublicData } from "@/lib/poll-storage";
import { absoluteUrl } from "@/lib/site-url";
import { getEventRegionSlug, getRegion, isRegionSlug } from "@/lib/regions";
import { getPublicEvent } from "@/lib/public-events";
import { readRegistrations } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PageProps = { params: { region: string; slug: string } };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  if (!isRegionSlug(params.region)) return {};
  const event = await getPublicEvent(params.region, params.slug);
  if (!event) return { title: "Anketa" };
  const poll = await getPollPublicData(params.slug, event.venue);
  if (!poll) return { title: "Anketa" };
  return {
    title: poll.config.title,
    description: poll.config.description,
    alternates: { canonical: absoluteUrl(`/kvizy/${params.region}/${event.slug}/hlasovanie`) },
    robots: { index: false, follow: true },
  };
}

export default async function PollPage({ params }: PageProps) {
  if (!isRegionSlug(params.region)) notFound();

  const event = await getPublicEvent(params.region, params.slug);
  if (!event) notFound();

  const poll = await getPollPublicData(params.slug, event.venue);
  if (!poll) notFound();

  const { registrations } = await readRegistrations();
  const region = getRegion(params.region)!;
  const regionSlug = getEventRegionSlug(event);
  const teamSuggestions = collectEventTeamNames(event, [
    ...poll.votes.map((vote) => vote.teamName),
    ...registrations.filter((reg) => reg.eventSlug === event.slug).map((reg) => reg.teamName),
  ]);

  return (
    <div className="min-h-screen bg-brand-bg pt-16">
      <section className="bg-brand-warm border-b border-brand-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <Breadcrumbs
            items={[
              { label: "Domov", href: "/" },
              { label: "Kvízy", href: "/kvizy" },
              { label: region.name, href: `/kvizy/${regionSlug}` },
              { label: event.venue, href: `/kvizy/${regionSlug}/${event.slug}` },
              { label: "Anketa" },
            ]}
          />
          <Link
            href={`/kvizy/${regionSlug}/${event.slug}`}
            className="inline-flex items-center gap-2 text-brand-orange-readable text-sm font-semibold hover:underline mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Späť na {event.venue}
          </Link>
          <h1 className="font-display text-5xl sm:text-6xl text-brand-text tracking-wide">{poll.config.title}</h1>
          <p className="text-brand-muted text-sm mt-3 max-w-3xl leading-relaxed">{poll.config.description}</p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <PollVoting
          eventSlug={event.slug}
          venue={event.venue}
          initialData={poll}
          teamSuggestions={teamSuggestions}
        />
      </div>
    </div>
  );
}
