"use client";

import { useState } from "react";
import Link from "next/link";
import {
  MapPin,
  Clock,
  Calendar,
  Users,
  Trophy,
  BookOpen,
  Timer,
  Vote,
  Medal,
} from "lucide-react";
import type { QuizEvent } from "@/lib/data";
import { formatDuration, formatEventDateLabel, isRegistrationOpen } from "@/lib/data";
import type { RegionSlug } from "@/lib/regions";
import { getRegion } from "@/lib/regions";
import Breadcrumbs from "@/components/Breadcrumbs";
import RegistrationAction from "@/components/RegistrationAction";
import RegistrationModal from "./RegistrationModal";
import QuizViewTracker from "@/components/QuizViewTracker";

const medalStyles = [
  { bg: "#FFD700", color: "#5a3e00", border: "#c9a800" },
  { bg: "#C0C0C0", color: "#333333", border: "#909090" },
  { bg: "#CD7F32", color: "#ffffff", border: "#a05a1a" },
];

type EventDetailPageProps = {
  event: QuizEvent;
  region: RegionSlug;
  pollHref?: string;
};

export default function EventDetailPage({ event, region, pollHref }: EventDetailPageProps) {
  const [showModal, setShowModal] = useState(false);
  const rules = event.rules ?? [];
  const regionConfig = getRegion(region)!;
  const topThree = event.leagueTable.slice(0, 3);

  return (
    <>
      <QuizViewTracker eventSlug={event.slug} venue={event.venue} />
      <div className="min-h-screen bg-brand-bg pt-16">
        <section className="bg-brand-warm border-b border-brand-border">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <Breadcrumbs
              items={[
                { label: "Domov", href: "/" },
                { label: "Kvízy", href: "/kvizy" },
                { label: regionConfig.name, href: `/kvizy/${region}` },
                { label: event.venue },
              ]}
            />
            <h1 className="font-display text-5xl sm:text-6xl text-brand-text tracking-wide">
              Kvíz v {event.venue}, {event.city}
            </h1>
            <p className="text-brand-muted text-sm mt-2 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 shrink-0" />
              {event.city} &mdash; {event.address}
            </p>
            <p className="text-brand-muted text-sm mt-3 max-w-3xl leading-relaxed">
              Vedomostný pub kvíz Mudrc v regióne {regionConfig.name}. Registruj tím vopred a príď si užiť večer plný
              otázok, súťaže a dobrej atmosféry.
            </p>
          </div>
        </section>

        {event.imageUrl && (
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
            <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-brand-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={event.imageUrl} alt={`Kvíz ${event.venue}, ${event.city}`} className="absolute inset-0 w-full h-full object-cover" />
            </div>
          </div>
        )}

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
            <div className="bg-brand-card rounded-2xl border border-brand-border p-5 text-center">
              <div className="font-display text-3xl text-brand-orange-readable">{event.questions}</div>
              <div className="text-brand-muted text-xs mt-1 uppercase tracking-wider">Otázok</div>
            </div>
            <div className="bg-brand-card rounded-2xl border border-brand-border p-5 text-center">
              <div className="font-display text-3xl text-brand-orange-readable flex items-center justify-center gap-1">
                <Timer className="w-6 h-6" />
              </div>
              <div className="font-display text-xl text-brand-text mt-1">{formatDuration(event.durationMinutes)}</div>
            </div>
            <div className="bg-brand-card rounded-2xl border border-brand-border p-5 text-center">
              <div className="font-display text-3xl text-brand-orange-readable">{event.entryFee} €</div>
              <div className="text-brand-muted text-xs mt-1 uppercase tracking-wider">Vstupné / hráč</div>
            </div>
            <div className="bg-brand-card rounded-2xl border border-brand-border p-5 text-center">
              <div className="font-display text-3xl text-brand-orange-readable">
                {event.minPlayers}–{event.maxPlayers}
              </div>
              <div className="text-brand-muted text-xs mt-1 uppercase tracking-wider flex items-center justify-center gap-1">
                <Users className="w-3 h-3" /> Hráčov
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-8">
              <div className="bg-brand-card rounded-2xl border border-brand-border p-6 md:p-8">
                <h2 className="font-display text-2xl text-brand-text tracking-wide mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-brand-orange-readable" />
                  Termín
                </h2>
                <p className="text-brand-text font-semibold text-lg">
                  {formatEventDateLabel(event.date)}
                </p>
                <p className="text-brand-text font-semibold flex items-center gap-1.5 mt-1">
                  <Clock className="w-4 h-4 text-brand-orange-readable shrink-0" /> {event.time}
                </p>
                <p className="text-brand-muted text-sm mt-2 leading-relaxed">
                  Príďte aspoň 10 minút pred začiatkom kvízu, aby ste stihli objednať konzum.
                </p>
              </div>

              {rules.length > 0 && (
                <div className="bg-brand-card rounded-2xl border border-brand-border p-6 md:p-8">
                  <h2 className="font-display text-2xl text-brand-text tracking-wide mb-4 flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-brand-orange-readable" />
                    Pravidlá
                  </h2>
                  <ul className="space-y-2">
                    {rules.map((rule, i) => (
                      <li key={i} className="text-brand-muted text-sm flex gap-2">
                        <span className="text-brand-orange-readable shrink-0">•</span>
                        {rule}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="bg-brand-card rounded-2xl border border-brand-border p-6 sticky top-24">
                <h3 className="font-display text-xl text-brand-text tracking-wide mb-4">Príď si zasúťažiť</h3>
                <p className="text-brand-muted text-sm mb-5">
                  {event.registrationOpen === false
                    ? "Kapacita podniku je naplnená. Registrácia je uzavretá."
                    : "Zaregistruj svoj tím vopred — miesta sa rýchlo míňajú."}
                </p>
                <RegistrationAction event={event} onRegister={() => setShowModal(true)} className="mb-3 flex items-center gap-2" />
                {pollHref && (
                  <Link href={pollHref} className="btn-outline w-full text-sm py-3 mb-3 flex items-center justify-center gap-2">
                    <Vote className="w-4 h-4" /> Hlasovať o letnom termíne
                  </Link>
                )}
              </div>

              {topThree.length > 0 && (
                <div className="bg-brand-card rounded-2xl border border-brand-border p-6">
                  <h3 className="font-display text-xl text-brand-text tracking-wide mb-1 flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-brand-orange-readable" />
                    Liga — top 3
                  </h3>
                  <p className="text-brand-muted text-xs mb-4">Aktuálne poradie v {event.venue}</p>
                  <div className="space-y-2">
                    {topThree.map((entry) => (
                      <div
                        key={entry.rank}
                        className="flex items-center gap-3 rounded-xl border border-brand-border bg-brand-surface/50 px-3 py-2.5"
                      >
                        <span
                          className="inline-flex w-8 h-8 shrink-0 rounded-full border items-center justify-center"
                          style={{
                            background: medalStyles[entry.rank - 1].bg,
                            color: medalStyles[entry.rank - 1].color,
                            borderColor: medalStyles[entry.rank - 1].border,
                          }}
                        >
                          <Medal className="w-4 h-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div
                            className={`font-semibold text-sm truncate ${
                              entry.rank === 1 ? "text-brand-orange-readable" : "text-brand-text"
                            }`}
                          >
                            {entry.teamName}
                          </div>
                          <div className="text-brand-muted text-xs">{entry.quizzesPlayed} kvízov</div>
                        </div>
                        <div className="shrink-0 text-right">
                          <span
                            className={`font-display text-xl font-bold ${
                              entry.rank === 1 ? "text-brand-orange-readable" : "text-brand-text"
                            }`}
                          >
                            {entry.points}
                          </span>
                          <span className="text-brand-muted text-xs ml-0.5">b</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Link
                    href={`/liga/${event.slug}`}
                    className="block text-center text-brand-orange-readable text-sm font-semibold hover:underline mt-4"
                  >
                    Celá ligová tabuľka →
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showModal && isRegistrationOpen(event) && (
        <RegistrationModal
          eventSlug={event.slug}
          venue={event.venue}
          minPlayers={event.minPlayers}
          maxPlayers={event.maxPlayers}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
