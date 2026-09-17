"use client";

import { useState } from "react";
import Link from "next/link";
import { Calendar, MapPin, Clock, ArrowRight, Users, Timer } from "lucide-react";
import type { QuizEvent } from "@/lib/data";
import {
  formatDuration,
  formatEventDateLabel,
  isRegistrationOpen,
  leagueTeamNameSuggestions,
  sortEventsByDate,
} from "@/lib/data";
import { eventPath } from "@/lib/regions";
import RegistrationAction from "./RegistrationAction";
import RegistrationModal from "./RegistrationModal";

function EventCoverImage({ src, alt }: { src: string; alt: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
  );
}

export default function QuizEventCards({ events }: { events: QuizEvent[] }) {
  const [modalSlug, setModalSlug] = useState<string | null>(null);
  const sortedEvents = sortEventsByDate(events);
  const activeEvent = sortedEvents.find((event) => event.slug === modalSlug);
  const activeTeamSuggestions = activeEvent ? leagueTeamNameSuggestions(activeEvent.leagueTable) : [];

  if (sortedEvents.length === 0) {
    return <p className="text-brand-muted text-center py-8">Momentálne nemáme žiadne aktívne kvízy v tomto regióne.</p>;
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sortedEvents.map((event) => (
          <Link key={event.slug} href={eventPath(event)} className="card group cursor-pointer block">
            <div className="relative w-full aspect-video bg-brand-warm overflow-hidden flex items-center justify-center">
              {event.imageUrl ? (
                <EventCoverImage src={event.imageUrl} alt={`Kvíz ${event.venue}, ${event.city}`} />
              ) : (
                <span className="text-7xl opacity-10">🎉</span>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
            </div>
            <div className="p-6">
              <div className="flex items-start justify-between gap-4 mb-1">
                <div>
                  <h3 className="font-display text-3xl text-brand-text tracking-wide group-hover:text-brand-orange transition-colors">
                    {event.venue}
                  </h3>
                  <div className="flex items-center gap-1.5 text-brand-muted text-sm mt-1">
                    <MapPin className="w-3.5 h-3.5 text-brand-orange" />
                    {event.city}
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="flex items-center gap-1.5 text-brand-text text-sm font-semibold">
                      <Calendar className="w-3.5 h-3.5 text-brand-orange" />
                      {formatEventDateLabel(event.date)}
                    </span>
                    <span className="text-brand-muted-light">·</span>
                    <span className="flex items-center gap-1.5 text-brand-muted text-sm font-medium">
                      <Clock className="w-3.5 h-3.5" />
                      {event.time}
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-display text-3xl text-brand-text">{event.entryFee}&euro;</div>
                  <div className="text-brand-muted text-xs">/ hráč</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-4 mb-5">
                <span className="badge bg-brand-surface text-brand-muted border border-brand-border">
                  <Users className="w-3 h-3" />
                  {`${event.minPlayers}–${event.maxPlayers} hráčov`}
                </span>
                <span className="badge bg-brand-surface text-brand-muted border border-brand-border flex items-center gap-1">
                  <Timer className="w-3 h-3" />
                  {formatDuration(event.durationMinutes ?? 120)}
                </span>
              </div>
              <div className="flex gap-3">
                <RegistrationAction
                  event={event}
                  compact
                  className="flex-1"
                  onRegister={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setModalSlug(event.slug);
                  }}
                />
                <div className="btn-outline text-sm py-2.5 px-4">
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {activeEvent && isRegistrationOpen(activeEvent) && (
        <RegistrationModal
          eventSlug={activeEvent.slug}
          venue={activeEvent.venue}
          minPlayers={activeEvent.minPlayers}
          maxPlayers={activeEvent.maxPlayers}
          teamSuggestions={activeTeamSuggestions}
          onClose={() => setModalSlug(null)}
        />
      )}
    </>
  );
}
