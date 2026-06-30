"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Calendar, MapPin, Clock, ArrowRight, Users, Timer, Trophy } from "lucide-react";
import type { QuizEvent } from "@/lib/data";
import { isQuizVisible } from "@/lib/data";
import { formatDuration } from "@/lib/data";
import RegistrationModal from "./RegistrationModal";
import Image from "next/image";

export default function QuizzesSection() {
  const [events, setEvents] = useState<QuizEvent[]>([]);
  const [modalSlug, setModalSlug] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/events")
      .then((r) => r.json())
      .then((d) => setEvents(d.events ?? []))
      .catch(() => setEvents([]));
  }, []);

  const activeEvent = events.find((e) => e.slug === modalSlug);
  const visibleEvents = events.filter(isQuizVisible);

  return (
    <>
      <section id="kvizy" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <span className="text-brand-orange-readable text-sm font-semibold uppercase tracking-wider">Nadchádzajúce termíny</span>
            <h2 className="section-title mt-2">Najbližšie kvízy<br /><span className="text-gradient">vo vašom okolí</span></h2>
          </div>
          <p className="text-brand-muted text-lg md:text-right md:max-w-sm">Vyberte si svoj podnik, zaregistrujte tím a príďte sa zabaviť. Miesta sa rýchlo míňajú, preto registráciu neodkladajte!</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {visibleEvents.map((event) => (
            <Link key={event.slug} href={`/udalosti/${event.slug}`} className="card group cursor-pointer block">
              <div className="relative h-44 bg-brand-warm overflow-hidden flex items-center justify-center">
                {event.imageUrl ? (
                  <Image src={event.imageUrl} alt={event.venue} fill className="object-cover" />
                ) : (
                  <span className="text-7xl opacity-10">🎉</span>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              </div>
              <div className="p-6">
                <div className="flex items-start justify-between gap-4 mb-1">
                  <div>
                    <h3 className="font-display text-3xl text-brand-text tracking-wide group-hover:text-brand-orange transition-colors">{event.venue}</h3>
                    <div className="flex items-center gap-1.5 text-brand-muted text-sm mt-1">
                      <MapPin className="w-3.5 h-3.5 text-brand-orange" />{event.city}
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="flex items-center gap-1.5 text-brand-text text-sm font-semibold">
                        <Calendar className="w-3.5 h-3.5 text-brand-orange" />{event.date}
                      </span>
                      <span className="text-brand-muted-light">·</span>
                      <span className="flex items-center gap-1.5 text-brand-muted text-sm font-medium">
                        <Clock className="w-3.5 h-3.5" />{event.time}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-display text-3xl text-brand-text">{event.entryFee}&euro;</div>
                    <div className="text-brand-muted text-xs">/ hráč</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-4 mb-5">
                  <span className="badge bg-brand-surface text-brand-muted border border-brand-border"><Users className="w-3 h-3" />{`${event.minPlayers}–${event.maxPlayers} hráčov`}</span>
                  <span className="badge bg-brand-surface text-brand-muted border border-brand-border flex items-center gap-1"><Timer className="w-3 h-3" />{formatDuration(event.durationMinutes ?? 120)}</span>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={(e) => { e.preventDefault(); setModalSlug(event.slug); }}
                    className="btn-primary flex-1 justify-center text-sm py-2.5"
                  >
                    Registrácia tímu
                  </button>
                  <div className="btn-outline text-sm py-2.5 px-4">
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
      {activeEvent && (
        <RegistrationModal
          eventSlug={activeEvent.slug}
          venue={activeEvent.venue}
          minPlayers={activeEvent.minPlayers}
          maxPlayers={activeEvent.maxPlayers}
          onClose={() => setModalSlug(null)}
        />
      )}
    </>
  );
}

export function LigaList() {
  const [events, setEvents] = useState<QuizEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/events?view=liga&_=${Date.now()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setEvents(d.events ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-brand-muted text-center">Načítavam ligy...</p>;
  }

  if (events.length === 0) {
    return <p className="text-brand-muted text-center">Zatiaľ žiadne aktívne ligy.</p>;
  }

  return (
    <div className="space-y-4">
      {events.map((event) => {
        const leader = event.leagueTable[0];
        return (
          <Link
            key={event.slug}
            href={`/liga/${event.slug}`}
            className="block bg-brand-card rounded-2xl border border-brand-border px-6 py-5 hover:border-brand-orange-readable hover:shadow-lg transition-[border-color,box-shadow] duration-200 group"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-brand-tint flex items-center justify-center shrink-0">
                  <Trophy className="w-5 h-5 text-brand-orange-readable" />
                </div>
                <div>
                  <div className="font-display text-2xl text-brand-text tracking-wide group-hover:text-brand-orange-readable transition-colors">
                    {event.venue}
                  </div>
                  <div className="text-brand-muted text-sm">{event.city}</div>
                </div>
              </div>
              <div className="flex items-center gap-6 text-sm text-brand-muted shrink-0">
                <div className="text-center w-12 hidden sm:block">
                  <div className="font-bold text-brand-text text-lg leading-tight">{event.leagueTable.length}</div>
                  <div className="text-xs">tímov</div>
                </div>
                <div className="text-center w-12 hidden sm:block">
                  <div className="font-bold text-brand-text text-lg leading-tight">{event.pastResults.length}</div>
                  <div className="text-xs">kvízov</div>
                </div>
                {leader && (
                  <div className="text-right w-28 hidden md:block">
                    <div className="text-xs text-brand-muted mb-0.5">Líder</div>
                    <div className="font-semibold text-brand-orange-readable truncate">{leader.teamName}</div>
                  </div>
                )}
                <div className="text-brand-orange-readable group-hover:translate-x-1 transition-transform text-lg">→</div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
