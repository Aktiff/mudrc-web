"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  MapPin,
  Clock,
  Calendar,
  Users,
  ChevronLeft,
  Trophy,
  BookOpen,
  Timer,
} from "lucide-react";
import type { QuizEvent } from "@/lib/data";
import { isQuizVisible, formatDuration } from "@/lib/data";
import RegistrationModal from "@/components/RegistrationModal";

export default function EventPage({ params }: { params: { slug: string } }) {
  const [event, setEvent] = useState<QuizEvent | null | undefined>(undefined);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetch(`/api/events/${params.slug}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(setEvent)
      .catch(() => setEvent(null));
  }, [params.slug]);

  if (event === undefined) {
    return (
      <div className="min-h-screen bg-brand-bg pt-16 flex items-center justify-center text-brand-muted">
        Načítavam...
      </div>
    );
  }
  if (!event || !isQuizVisible(event)) notFound();

  const rules = event.rules ?? [];

  return (
    <>
      <div className="min-h-screen bg-brand-bg pt-16">
        <section className="bg-brand-warm border-b border-brand-border">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <Link
              href="/#kvizy"
              className="inline-flex items-center gap-1.5 text-brand-muted hover:text-brand-orange-readable transition-colors text-sm mb-6"
            >
              <ChevronLeft className="w-4 h-4" /> Späť na kvízy
            </Link>
            <h1 className="font-display text-5xl sm:text-6xl text-brand-text tracking-wide">{event.venue}</h1>
            <p className="text-brand-muted text-sm mt-2 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 shrink-0" />
              {event.city} &mdash; {event.address}
            </p>
          </div>
        </section>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
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
              <div className="font-display text-3xl text-brand-orange-readable">{event.minPlayers}–{event.maxPlayers}</div>
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
                <p className="text-brand-text font-semibold text-lg">{event.date}</p>
                <p className="text-brand-muted flex items-center gap-1.5 mt-1">
                  <Clock className="w-4 h-4" /> {event.time}
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
                <h3 className="font-display text-xl text-brand-text tracking-wide mb-4">Pridaj sa zahrať!</h3>
                <p className="text-brand-muted text-sm mb-5">
                  Zaregistruj svoj tím vopred — miesta sa rýchlo míňajú.
                </p>
                <button onClick={() => setShowModal(true)} className="btn-primary w-full text-sm py-3 mb-3">
                  <Trophy className="w-4 h-4" /> Zaregistrovať tím
                </button>
                {(event.leagueTable.length > 0 || event.pastResults.length > 0) && (
                  <Link
                    href={`/liga/${event.slug}`}
                    className="block text-center text-brand-orange-readable text-sm font-semibold hover:underline"
                  >
                    Pozrieť ligovú tabuľku →
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showModal && (
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
