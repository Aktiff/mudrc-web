"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Calendar, ChevronRight, MapPin, Phone, Trash2 } from "lucide-react";
import type { QuizEvent } from "@/lib/data";
import { formatEventDateLabel, sortEventsForAdminOverview } from "@/lib/data";
import { formatTeamPhone, type VenueTeam } from "@/lib/venue-team-contact";

function teamCountLabel(count: number): string {
  if (count === 1) return "1 tím";
  if (count >= 2 && count <= 4) return `${count} tímy`;
  return `${count} tímov`;
}

function venueCountLabel(count: number): string {
  if (count === 1) return "1 podnik";
  if (count >= 2 && count <= 4) return `${count} podniky`;
  return `${count} podnikov`;
}

type VenueGroup = {
  key: string;
  venue: string;
  city: string;
  date: string;
  time: string;
  eventSlug: string;
  list: VenueTeam[];
};

type CitySection = {
  key: string;
  city: string;
  venues: VenueGroup[];
};

export default function VenueTeamsPage() {
  const [teams, setTeams] = useState<VenueTeam[]>([]);
  const [events, setEvents] = useState<QuizEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [selectedVenue, setSelectedVenue] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/admin/venue-teams?_=${Date.now()}`, { cache: "no-store", credentials: "same-origin" }).then((r) =>
        r.ok ? r.json() : { teams: [] }
      ),
      fetch(`/api/admin/events?_=${Date.now()}`, { cache: "no-store", credentials: "same-origin" }).then((r) =>
        r.ok ? r.json() : { events: [] }
      ),
    ])
      .then(([teamData, eventData]) => {
        setTeams(teamData.teams ?? []);
        setEvents(eventData.events ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sortedEvents = useMemo(() => sortEventsForAdminOverview(events), [events]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return teams;
    const digits = q.replace(/\D/g, "");
    const cityByVenue = new Map<string, string>();
    for (const event of events) {
      cityByVenue.set(event.venue.trim().toLowerCase(), event.city);
    }
    return teams.filter((team) => {
      const city = cityByVenue.get(team.venue.trim().toLowerCase()) ?? "";
      return (
        city.toLowerCase().includes(q) ||
        team.teamName.toLowerCase().includes(q) ||
        team.venue.toLowerCase().includes(q) ||
        (digits.length > 0 && team.phones.some((phone) => phone.toLowerCase().includes(q) || phone.replace(/\D/g, "").includes(digits)))
      );
    });
  }, [teams, filter, events]);

  const grouped = useMemo(() => {
    const eventsByVenue = new Map<string, QuizEvent[]>();
    for (const event of sortedEvents) {
      const key = event.venue.trim().toLowerCase();
      const bucket = eventsByVenue.get(key);
      if (bucket) bucket.push(event);
      else eventsByVenue.set(key, [event]);
    }

    const assigned = new Set<string>();
    const sections: VenueGroup[] = [];
    const seen = new Set<string>();

    for (const event of sortedEvents) {
      const key = event.venue.trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const eventsHere = eventsByVenue.get(key) ?? [event];
      const slugs = new Set(eventsHere.map((entry) => entry.slug));
      const list = filtered.filter((team) => {
        if (assigned.has(team.id)) return false;
        const match =
          (team.eventSlug && slugs.has(team.eventSlug)) || team.venue.trim().toLowerCase() === key;
        if (!match) return false;
        assigned.add(team.id);
        return true;
      });
      if (list.length === 0) continue;
      const primary = eventsHere[0];
      sections.push({
        key,
        venue: primary.venue,
        city: primary.city,
        date: primary.date,
        time: primary.time,
        eventSlug: primary.slug,
        list,
      });
    }

    const orphans = filtered.filter((team) => !assigned.has(team.id));
    return { sections, orphans };
  }, [sortedEvents, filtered]);

  const citySections = useMemo(() => {
    const byCity = new Map<string, VenueGroup[]>();
    for (const section of grouped.sections) {
      const key = section.city.trim().toLowerCase() || "bez-mesta";
      const bucket = byCity.get(key);
      if (bucket) bucket.push(section);
      else byCity.set(key, [section]);
    }
    const sections: CitySection[] = Array.from(byCity.entries()).map(([key, venues]) => ({
      key,
      city: venues[0]?.city || "Bez mesta",
      venues: venues.slice().sort((a, b) => a.venue.localeCompare(b.venue, "sk")),
    }));
    sections.sort((a, b) => a.city.localeCompare(b.city, "sk"));
    if (grouped.orphans.length > 0) {
      const byVenue = new Map<string, VenueTeam[]>();
      for (const team of grouped.orphans) {
        const key = team.venue.trim().toLowerCase() || "bez-podniku";
        const bucket = byVenue.get(key);
        if (bucket) bucket.push(team);
        else byVenue.set(key, [team]);
      }
      const venues: VenueGroup[] = Array.from(byVenue.entries()).map(([key, list]) => ({
        key: `orphan:${key}`,
        venue: list[0]?.venue.trim() || "Bez podniku",
        city: "Iné / nepriradené",
        date: "",
        time: "",
        eventSlug: "",
        list,
      }));
      venues.sort((a, b) => a.venue.localeCompare(b.venue, "sk"));
      sections.push({ key: "orphans", city: "Iné / nepriradené", venues });
    }
    return sections;
  }, [grouped]);

  const removeTeam = async (team: VenueTeam) => {
    if (!confirm(`Odstrániť tím „${team.teamName}" z databázy kontaktov? Registrácie to nezmaže.`)) return;
    setDeletingId(team.id);
    try {
      const res = await fetch(`/api/admin/venue-teams?id=${encodeURIComponent(team.id)}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (res.ok) setTeams((prev) => prev.filter((entry) => entry.id !== team.id));
    } finally {
      setDeletingId(null);
    }
  };

  const citySection = citySections.find((section) => section.key === selectedCity) ?? null;
  const venueSection = citySection?.venues.find((venue) => venue.key === selectedVenue) ?? null;

  if (venueSection && citySection) {
    return (
      <div className="w-full min-w-0">
        <button
          type="button"
          onClick={() => setSelectedVenue(null)}
          className="inline-flex items-center gap-2 text-sm font-semibold text-brand-muted hover:text-brand-text mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          {citySection.city}
        </button>
        <h1 className="font-display text-4xl text-brand-text tracking-wide mb-1">{venueSection.venue}</h1>
        <p className="text-brand-muted text-sm mb-2 flex flex-wrap items-center gap-x-2">
          <span className="inline-flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-brand-orange" />
            {venueSection.city}
          </span>
          {venueSection.date ? (
            <span>
              {formatEventDateLabel(venueSection.date)}
              {venueSection.time ? ` o ${venueSection.time}` : ""}
            </span>
          ) : null}
        </p>
        <p className="text-brand-text text-sm font-semibold mb-6">{teamCountLabel(venueSection.list.length)}</p>
        {venueSection.eventSlug ? (
          <div className="mb-6">
            <Link
              href={`/admin/udalosti/${venueSection.eventSlug}?tab=registracie`}
              className="text-sm font-semibold text-brand-orange-readable hover:underline"
            >
              Otvoriť v udalosti
            </Link>
          </div>
        ) : null}
        {venueSection.list.length === 0 ? (
          <div className="bg-brand-card rounded-2xl border border-brand-border p-12 text-center">
            <p className="text-brand-muted">Pre tento podnik zatiaľ nemáme uložený tím.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {venueSection.list.map((team) => (
              <TeamRow
                key={team.id}
                team={team}
                deleting={deletingId === team.id}
                onDelete={() => removeTeam(team)}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (citySection) {
    return (
      <div className="w-full min-w-0">
        <button
          type="button"
          onClick={() => {
            setSelectedCity(null);
            setSelectedVenue(null);
          }}
          className="inline-flex items-center gap-2 text-sm font-semibold text-brand-muted hover:text-brand-text mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Všetky mestá
        </button>
        <h1 className="font-display text-4xl text-brand-text tracking-wide mb-1">{citySection.city}</h1>
        <p className="text-brand-text text-sm font-semibold mb-6">
          {venueCountLabel(citySection.venues.length)} · {teamCountLabel(citySection.venues.reduce((sum, venue) => sum + venue.list.length, 0))}
        </p>
        <div className="space-y-3">
          {citySection.venues.map((venue) => (
            <button
              key={venue.key}
              type="button"
              onClick={() => setSelectedVenue(venue.key)}
              className="w-full text-left bg-brand-card rounded-2xl border border-brand-border px-6 sm:px-8 py-5 hover:border-brand-orange hover:bg-brand-warm transition-colors group"
            >
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-brand-tint flex items-center justify-center shrink-0">
                  <Calendar className="w-5 h-5 text-brand-orange" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-lg text-brand-text group-hover:text-brand-orange-readable flex items-center gap-2">
                    {venue.venue}
                    <ChevronRight className="w-4 h-4 opacity-40 group-hover:opacity-100" />
                  </div>
                  {venue.date ? (
                    <p className="text-brand-muted text-sm mt-1">
                      {formatEventDateLabel(venue.date)}
                      {venue.time ? ` o ${venue.time}` : ""}
                    </p>
                  ) : null}
                </div>
                <div className="text-sm font-semibold text-brand-text text-right shrink-0">
                  {teamCountLabel(venue.list.length)}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0">
      <h1 className="font-display text-4xl text-brand-text tracking-wide mb-1">Tímy</h1>
      <p className="text-brand-muted text-sm mb-2">Kontakty podľa miest a podnikov — ostanú aj po vymazaní registrácií</p>
      <p className="text-brand-muted text-xs mb-6">
        Uloží sa názov tímu a telefón tak, ako ho napísali. Prázdne pole a samé nuly sa nepridajú. Ďalšie číslo pri
        novej registrácii sa k tímu pridá.
      </p>
      <div className="flex flex-wrap items-center gap-3 mb-8">
        <input
          className="input text-sm max-w-xs"
          placeholder="Hľadať mesto, podnik, tím alebo číslo..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <span className="text-brand-muted text-sm">{teamCountLabel(filtered.length)}</span>
      </div>
      {loading && <p className="text-brand-muted text-sm">Načítavam...</p>}
      {!loading && citySections.length === 0 && (
        <div className="bg-brand-card rounded-2xl border border-brand-border p-12 text-center">
          <p className="text-brand-muted">Zatiaľ žiadne uložené tímy.</p>
        </div>
      )}
      <div className="space-y-3">
        {citySections.map((section) => {
          const teamCount = section.venues.reduce((sum, venue) => sum + venue.list.length, 0);
          return (
            <button
              key={section.key}
              type="button"
              onClick={() => {
                setSelectedCity(section.key);
                setSelectedVenue(null);
              }}
              className="w-full text-left bg-brand-card rounded-2xl border border-brand-border px-6 sm:px-8 py-5 hover:border-brand-orange hover:bg-brand-warm transition-colors group"
            >
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-brand-tint flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5 text-brand-orange" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-lg text-brand-text group-hover:text-brand-orange-readable flex items-center gap-2">
                    {section.city}
                    <ChevronRight className="w-4 h-4 opacity-40 group-hover:opacity-100" />
                  </div>
                  <p className="text-brand-muted text-sm mt-1">{venueCountLabel(section.venues.length)}</p>
                </div>
                <div className="text-sm font-semibold text-brand-text text-right shrink-0">{teamCountLabel(teamCount)}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TeamRow({
  team,
  deleting,
  onDelete,
  showVenue = false,
}: {
  team: VenueTeam;
  deleting: boolean;
  onDelete: () => void;
  showVenue?: boolean;
}) {
  return (
    <div className="rounded-xl border border-brand-border bg-brand-card p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="font-display text-xl text-brand-text">{team.teamName}</div>
        {showVenue && <p className="text-brand-muted text-sm mt-1">{team.venue}</p>}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-brand-muted">
          {team.phones.length === 0 ? (
            <span>Bez telefónu</span>
          ) : (
            team.phones.map((phone) => {
              const digits = phone.replace(/\D/g, "");
              const dial = digits.startsWith("421") ? digits : digits.replace(/^0/, "421");
              return (
              <a
                key={phone}
                href={`tel:+${dial}`}
                className="inline-flex items-center gap-1.5 hover:text-brand-text"
              >
                <Phone className="w-3.5 h-3.5" />
                {formatTeamPhone(phone)}
              </a>
              );
            })
          )}
        </div>
        <p className="text-brand-muted text-xs mt-2">Naposledy {team.updatedAt}</p>
      </div>
      <button
        type="button"
        onClick={onDelete}
        disabled={deleting}
        className="shrink-0 flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-50"
      >
        <Trash2 className="w-4 h-4" />
        {deleting ? "..." : "Zmazať"}
      </button>
    </div>
  );
}
