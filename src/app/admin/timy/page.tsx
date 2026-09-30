"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Calendar, ChevronRight, MapPin, Phone, Trash2 } from "lucide-react";
import type { QuizEvent } from "@/lib/data";
import { formatEventDateLabel, sortEventsForAdminOverview } from "@/lib/data";
import { formatTeamPhone, type VenueTeam } from "@/lib/venue-team-contact";

export default function VenueTeamsPage() {
  const [teams, setTeams] = useState<VenueTeam[]>([]);
  const [events, setEvents] = useState<QuizEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
    return teams.filter(
      (team) =>
        team.teamName.toLowerCase().includes(q) ||
        team.venue.toLowerCase().includes(q) ||
        team.phones.some((phone) => phone.includes(q.replace(/\D/g, "")) && q.replace(/\D/g, "").length > 0)
    );
  }, [teams, filter]);

  const grouped = useMemo(() => {
    const assigned = new Set<string>();
    const sections: { event: QuizEvent; list: VenueTeam[] }[] = [];
    for (const event of sortedEvents) {
      const list = filtered.filter((team) => {
        const match =
          (team.eventSlug && team.eventSlug === event.slug) ||
          team.venue.trim().toLowerCase() === event.venue.trim().toLowerCase();
        if (!match) return false;
        assigned.add(team.id);
        return true;
      });
      if (!filter.trim() || list.length > 0) sections.push({ event, list });
    }
    const orphans = filtered.filter((team) => !assigned.has(team.id));
    return { sections, orphans };
  }, [sortedEvents, filtered, filter]);

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
          placeholder="Hľadať tím, podnik alebo číslo..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <span className="text-brand-muted text-sm">{filtered.length} tímov</span>
      </div>
      {loading && <p className="text-brand-muted text-sm">Načítavam...</p>}
      {!loading && filtered.length === 0 && (
        <div className="bg-brand-card rounded-2xl border border-brand-border p-12 text-center">
          <p className="text-brand-muted">Zatiaľ žiadne uložené tímy.</p>
        </div>
      )}
      <div className="space-y-8">
        {grouped.sections.map(({ event, list }) => (
          <section key={event.slug} className="bg-brand-card rounded-2xl border border-brand-border overflow-hidden">
            <div className="px-6 sm:px-8 py-5 border-b border-brand-border bg-brand-warm/40">
              <Link
                href={`/admin/udalosti/${event.slug}?tab=registracie`}
                className="flex items-start gap-4 group"
              >
                <div className="w-11 h-11 rounded-xl bg-brand-tint flex items-center justify-center shrink-0">
                  <Calendar className="w-5 h-5 text-brand-orange" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-lg text-brand-text group-hover:text-brand-orange-readable flex items-center gap-2">
                    {event.venue}
                    <ChevronRight className="w-4 h-4 opacity-40 group-hover:opacity-100" />
                  </div>
                  <div className="text-brand-muted text-sm mt-1 flex flex-wrap gap-x-2">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-brand-orange" />
                      {event.city}
                    </span>
                    <span>
                      {formatEventDateLabel(event.date)} o {event.time}
                    </span>
                    <span className="text-brand-text font-semibold">
                      {list.length} {list.length === 1 ? "tím" : list.length >= 2 && list.length <= 4 ? "tímy" : "tímov"}
                    </span>
                  </div>
                </div>
              </Link>
            </div>
            <div className="p-4 sm:p-6 space-y-3">
              {list.length === 0 ? (
                <p className="text-brand-muted text-sm py-4 text-center">Pre tento podnik zatiaľ nemáme uložený tím.</p>
              ) : (
                list.map((team) => (
                  <TeamRow
                    key={team.id}
                    team={team}
                    deleting={deletingId === team.id}
                    onDelete={() => removeTeam(team)}
                  />
                ))
              )}
            </div>
          </section>
        ))}
        {grouped.orphans.length > 0 && (
          <section className="bg-brand-card rounded-2xl border border-amber-300/50 overflow-hidden">
            <div className="px-6 py-4 border-b border-brand-border">
              <h2 className="font-semibold text-brand-text">Iné / nepriradené</h2>
            </div>
            <div className="p-4 sm:p-6 space-y-3">
              {grouped.orphans.map((team) => (
                <TeamRow
                  key={team.id}
                  team={team}
                  deleting={deletingId === team.id}
                  onDelete={() => removeTeam(team)}
                  showVenue
                />
              ))}
            </div>
          </section>
        )}
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
    <div className="rounded-xl border border-brand-border p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="font-display text-xl text-brand-text">{team.teamName}</div>
        {showVenue && <p className="text-brand-muted text-sm mt-1">{team.venue}</p>}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-brand-muted">
          {team.phones.length === 0 ? (
            <span>Bez platného telefónu</span>
          ) : (
            team.phones.map((phone) => (
              <a key={phone} href={`tel:+${phone.startsWith("421") ? phone : phone.replace(/^0/, "421")}`} className="inline-flex items-center gap-1.5 hover:text-brand-text">
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
