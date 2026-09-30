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

type VenueGroup = {
  key: string;
  venue: string;
  city: string;
  date: string;
  time: string;
  eventSlug: string;
  list: VenueTeam[];
};

export default function VenueTeamsPage() {
  const [teams, setTeams] = useState<VenueTeam[]>([]);
  const [events, setEvents] = useState<QuizEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

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
    return teams.filter(
      (team) =>
        team.teamName.toLowerCase().includes(q) ||
        team.venue.toLowerCase().includes(q) ||
        (digits.length > 0 && team.phones.some((phone) => phone.includes(digits)))
    );
  }, [teams, filter]);

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

  const selectedSection = grouped.sections.find((section) => section.key === selectedKey) ?? null;
  const openOrphans = selectedKey === "orphans";

  if (selectedSection || openOrphans) {
    const list = selectedSection?.list ?? grouped.orphans;
    return (
      <div className="w-full min-w-0">
        <button
          type="button"
          onClick={() => setSelectedKey(null)}
          className="inline-flex items-center gap-2 text-sm font-semibold text-brand-muted hover:text-brand-text mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Všetky podniky
        </button>
        <h1 className="font-display text-4xl text-brand-text tracking-wide mb-1">
          {selectedSection ? selectedSection.venue : "Iné / nepriradené"}
        </h1>
        {selectedSection ? (
          <p className="text-brand-muted text-sm mb-2 flex flex-wrap items-center gap-x-2">
            <span className="inline-flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-brand-orange" />
              {selectedSection.city}
            </span>
            <span>
              {formatEventDateLabel(selectedSection.date)} o {selectedSection.time}
            </span>
          </p>
        ) : (
          <p className="text-brand-muted text-sm mb-2">Tímy bez zodpovedajúceho podniku</p>
        )}
        <p className="text-brand-text text-sm font-semibold mb-6">{teamCountLabel(list.length)}</p>
        {selectedSection && (
          <div className="mb-6">
            <Link
              href={`/admin/udalosti/${selectedSection.eventSlug}?tab=registracie`}
              className="text-sm font-semibold text-brand-orange-readable hover:underline"
            >
              Otvoriť v udalosti
            </Link>
          </div>
        )}
        {list.length === 0 ? (
          <div className="bg-brand-card rounded-2xl border border-brand-border p-12 text-center">
            <p className="text-brand-muted">Pre tento podnik zatiaľ nemáme uložený tím.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {list.map((team) => (
              <TeamRow
                key={team.id}
                team={team}
                deleting={deletingId === team.id}
                onDelete={() => removeTeam(team)}
                showVenue={openOrphans}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full min-w-0">
      <h1 className="font-display text-4xl text-brand-text tracking-wide mb-1">Tímy</h1>
      <p className="text-brand-muted text-sm mb-2">Kontakty podľa podnikov — ostanú aj po vymazaní registrácií</p>
      <p className="text-brand-muted text-xs mb-6">
        Uloží sa názov tímu a telefón, ak je to celé číslo (aspoň 9 číslic, nie samé nuly). Nové číslo pri ďalšej
        registrácii sa k tímu pridá.
      </p>
      <div className="flex flex-wrap items-center gap-3 mb-8">
        <input
          className="input text-sm max-w-xs"
          placeholder="Hľadať podnik, tím alebo číslo..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <span className="text-brand-muted text-sm">{teamCountLabel(filtered.length)}</span>
      </div>
      {loading && <p className="text-brand-muted text-sm">Načítavam...</p>}
      {!loading && grouped.sections.length === 0 && grouped.orphans.length === 0 && (
        <div className="bg-brand-card rounded-2xl border border-brand-border p-12 text-center">
          <p className="text-brand-muted">Zatiaľ žiadne uložené tímy.</p>
        </div>
      )}
      <div className="space-y-3">
        {grouped.sections.map((section) => (
          <button
            key={section.key}
            type="button"
            onClick={() => {
              setFilter("");
              setSelectedKey(section.key);
            }}
            className="w-full text-left bg-brand-card rounded-2xl border border-brand-border px-6 sm:px-8 py-5 hover:border-brand-orange hover:bg-brand-warm transition-colors group"
          >
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-brand-tint flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5 text-brand-orange" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-lg text-brand-text group-hover:text-brand-orange-readable flex items-center gap-2">
                  {section.venue}
                  <ChevronRight className="w-4 h-4 opacity-40 group-hover:opacity-100" />
                </div>
                <div className="text-brand-muted text-sm mt-1 flex flex-wrap items-center gap-x-2">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-brand-orange" />
                    {section.city}
                  </span>
                  <span>
                    {formatEventDateLabel(section.date)} o {section.time}
                  </span>
                </div>
              </div>
              <div className="text-sm font-semibold text-brand-text text-right shrink-0">
                {teamCountLabel(section.list.length)}
              </div>
            </div>
          </button>
        ))}
      </div>
      {grouped.orphans.length > 0 && (
        <button
          type="button"
          onClick={() => {
            setFilter("");
            setSelectedKey("orphans");
          }}
          className="mt-3 w-full text-left bg-brand-card rounded-2xl border border-amber-300/50 px-6 sm:px-8 py-5 hover:border-brand-orange hover:bg-brand-warm transition-colors group"
        >
          <div className="flex items-center gap-4">
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-lg text-brand-text group-hover:text-brand-orange-readable flex items-center gap-2">
                Iné / nepriradené
                <ChevronRight className="w-4 h-4 opacity-40 group-hover:opacity-100" />
              </div>
              <p className="text-brand-muted text-sm mt-1">Tímy bez zodpovedajúceho podniku</p>
            </div>
            <div className="text-sm font-semibold text-brand-text shrink-0">{teamCountLabel(grouped.orphans.length)}</div>
          </div>
        </button>
      )}
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
            <span>Bez platného telefónu</span>
          ) : (
            team.phones.map((phone) => (
              <a
                key={phone}
                href={`tel:+${phone.startsWith("421") ? phone : phone.replace(/^0/, "421")}`}
                className="inline-flex items-center gap-1.5 hover:text-brand-text"
              >
                <Phone className="w-3.5 h-3.5" />
                {formatTeamPhone(phone)}
              </a>
            ))
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
