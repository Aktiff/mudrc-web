"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Calendar, ChevronRight, MapPin, Trash2 } from "lucide-react";
import type { QuizEvent } from "@/lib/data";
import { formatEventDateLabel, parseSkEventDateTime, sortEventsForAdminOverview } from "@/lib/data";
import {
  estimatedEntryRevenue,
  formatEuroAmount,
  formatSkPlayerCountTotal,
  parseRegistrationPlayerCount,
  registrationTotalsForEvent,
  registrationsForEvent,
} from "@/lib/registration-utils";
import AdminRegistrationRow, { type AdminRegistration } from "@/components/admin/AdminRegistrationRow";
import RegistrationShareList from "@/components/admin/RegistrationShareList";

function matchesFilter(reg: AdminRegistration, filter: string): boolean {
  const q = filter.trim().toLowerCase();
  if (!q) return true;
  return reg.venue.toLowerCase().includes(q) || reg.teamName.toLowerCase().includes(q);
}

function sortRegsNewestFirst(list: AdminRegistration[]): AdminRegistration[] {
  return list.slice().reverse();
}

function teamCountLabel(count: number): string {
  if (count === 1) return "1 tím";
  if (count >= 2 && count <= 4) return `${count} tímy`;
  return `${count} tímov`;
}

function isUpcomingEvent(event: QuizEvent): boolean {
  const at = parseSkEventDateTime(event.date, event.time)?.getTime();
  if (at == null) return false;
  return at >= Date.now();
}

export default function RegistraciaPage() {
  const [regs, setRegs] = useState<AdminRegistration[]>([]);
  const [events, setEvents] = useState<QuizEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [clearingVenueSlug, setClearingVenueSlug] = useState<string | null>(null);
  const [updatingPlayersId, setUpdatingPlayersId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const opts = { cache: "no-store" as const, credentials: "same-origin" as const, signal: AbortSignal.timeout(12000) };
    Promise.all([
      fetch(`/api/admin/registrations?_=${Date.now()}`, opts).then((r) => (r.ok ? r.json() : Promise.reject())),
      fetch(`/api/admin/events?_=${Date.now()}`, opts).then((r) => (r.ok ? r.json() : Promise.reject())),
    ])
      .then(([regData, eventData]) => {
        setRegs(regData.registrations ?? []);
        setEvents(eventData.events ?? []);
        setMsg(null);
      })
      .catch(() => {
        setMsg({ text: "Registrácie sa nepodarilo načítať. Klikni Obnoviť.", ok: false });
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sortedEvents = useMemo(() => sortEventsForAdminOverview(events), [events]);
  const eventBySlug = useMemo(() => new Map(events.map((event) => [event.slug, event])), [events]);

  const limitsFor = (reg: AdminRegistration) => {
    const event = eventBySlug.get(reg.eventSlug);
    const min = Math.max(1, event?.minPlayers ?? 2);
    const max = Math.max(min, event?.maxPlayers ?? 8, 20);
    return { min, max };
  };

  const filteredRegs = useMemo(
    () => regs.filter((r) => matchesFilter(r, filter)),
    [regs, filter]
  );

  const grouped = useMemo(() => {
    const assignedIds = new Set<string>();
    const sections: { event: QuizEvent; list: AdminRegistration[] }[] = [];

    for (const event of sortedEvents) {
      const list = sortRegsNewestFirst(
        registrationsForEvent(filteredRegs, event.slug, event.venue) as AdminRegistration[]
      ).filter((r) => {
        assignedIds.add(r.id);
        return true;
      });
      if (!filter.trim() || list.length > 0) {
        sections.push({ event, list });
      }
    }

    const orphans = sortRegsNewestFirst(filteredRegs.filter((r) => !assignedIds.has(r.id)));
    return { sections, orphans };
  }, [sortedEvents, filteredRegs, filter]);

  const upcomingTotals = useMemo(() => {
    const counted = new Set<string>();
    let teams = 0;
    let players = 0;
    let earned = 0;
    for (const event of sortedEvents) {
      if (!isUpcomingEvent(event)) continue;
      for (const reg of registrationsForEvent(regs, event.slug, event.venue) as AdminRegistration[]) {
        if (counted.has(reg.id)) continue;
        counted.add(reg.id);
        teams += 1;
        const count = parseRegistrationPlayerCount(reg.players);
        players += count;
        earned += estimatedEntryRevenue(event.entryFee, count);
      }
    }
    return { teams, players, earned };
  }, [sortedEvents, regs]);

  const selectedEvent = selectedSlug ? sortedEvents.find((event) => event.slug === selectedSlug) ?? null : null;
  const selectedList = selectedEvent
    ? sortRegsNewestFirst(registrationsForEvent(regs, selectedEvent.slug, selectedEvent.venue) as AdminRegistration[])
    : [];

  const adjustPlayers = async (reg: AdminRegistration, delta: number) => {
    const { min, max } = limitsFor(reg);
    const current = parseRegistrationPlayerCount(reg.players) || min;
    const next = Math.min(max, Math.max(min, current + delta));
    if (next === current) return;

    setUpdatingPlayersId(reg.id);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/registrations", {
        method: "PATCH",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: reg.id, players: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ text: data.error ?? "Nepodarilo sa upraviť počet hráčov.", ok: false });
        return;
      }
      setRegs((prev) => prev.map((entry) => (entry.id === reg.id ? { ...entry, players: String(next) } : entry)));
    } finally {
      setUpdatingPlayersId(null);
    }
  };

  const deleteOne = async (id: string, teamName: string) => {
    if (!confirm(`Naozaj zmazať registráciu tímu „${teamName}"?`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/registrations?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (res.ok) load();
    } finally {
      setDeletingId(null);
    }
  };

  const clearVenue = async (event: QuizEvent, count: number) => {
    if (
      !confirm(
        `Naozaj vymazať všetkých ${count} ${count === 1 ? "registráciu" : "registrácií"} pre ${event.venue}?`
      )
    ) {
      return;
    }
    setClearingVenueSlug(event.slug);
    try {
      const res = await fetch(
        `/api/admin/registrations?slug=${encodeURIComponent(event.slug)}&venue=${encodeURIComponent(event.venue)}`,
        { method: "DELETE", credentials: "same-origin" }
      );
      if (res.ok) load();
    } finally {
      setClearingVenueSlug(null);
    }
  };

  const listEvents = grouped.sections.filter(({ event, list }) => isUpcomingEvent(event) || list.length > 0);

  if (selectedEvent) {
    const event = selectedEvent;
    const list = selectedList;
    const totals = registrationTotalsForEvent(regs, event.slug, event.venue);
    const min = Math.max(1, event.minPlayers ?? 2);
    const max = Math.max(min, event.maxPlayers ?? 8, 20);

    return (
      <div className="w-full min-w-0">
        <button
          type="button"
          onClick={() => setSelectedSlug(null)}
          className="inline-flex items-center gap-2 text-sm font-semibold text-brand-muted hover:text-brand-text mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Všetky podniky
        </button>
        <h1 className="font-display text-4xl text-brand-text tracking-wide mb-1">{event.venue}</h1>
        <p className="text-brand-muted text-sm mb-2 flex flex-wrap items-center gap-x-2">
          <span className="inline-flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-brand-orange" />
            {event.city}
          </span>
          <span>
            {formatEventDateLabel(event.date)} o {event.time}
          </span>
        </p>
        <p className="text-brand-text text-sm font-semibold mb-6">
          {teamCountLabel(totals.teams)} · {formatSkPlayerCountTotal(totals.players)}
          {" · "}
          príjem {formatEuroAmount(estimatedEntryRevenue(event.entryFee, totals.players))}
        </p>
        {msg && <p className={`text-sm mb-4 ${msg.ok ? "text-green-600" : "text-red-500"}`}>{msg.text}</p>}
        <RegistrationShareList
          venue={event.venue}
          city={event.city}
          whenLabel={`${formatEventDateLabel(event.date)} o ${event.time}`}
          teams={list}
        />
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <Link href={`/admin/udalosti/${event.slug}?tab=registracie`} className="text-sm font-semibold text-brand-orange-readable hover:underline">
            Otvoriť v udalosti
          </Link>
          {list.length > 0 && (
            <button
              type="button"
              onClick={() => clearVenue(event, list.length)}
              disabled={clearingVenueSlug === event.slug}
              className="ml-auto flex items-center gap-2 text-sm font-semibold px-3 py-2 rounded-xl border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              {clearingVenueSlug === event.slug ? "Mažem…" : "Vymazať všetky"}
            </button>
          )}
        </div>
        {list.length === 0 ? (
          <div className="bg-brand-card rounded-2xl border border-brand-border p-12 text-center">
            <p className="text-brand-muted">Zatiaľ žiadne registrácie pre tento podnik.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {list.map((r) => (
              <AdminRegistrationRow
                key={r.id}
                reg={r}
                minPlayers={min}
                maxPlayers={max}
                busy={updatingPlayersId === r.id}
                deleting={deletingId === r.id}
                onAdjust={(delta) => adjustPlayers(r, delta)}
                onDelete={() => deleteOne(r.id, r.teamName)}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full min-w-0">
      <h1 className="font-display text-4xl text-brand-text tracking-wide mb-1">Registrácie</h1>
      <p className="text-brand-text text-lg font-semibold mb-1">
        {loading
          ? "Načítavam registrácie…"
          : msg && !msg.ok && regs.length === 0
            ? "Registrácie sa nenačítali"
            : `Nadchádzajúce: ${teamCountLabel(upcomingTotals.teams)} · ${formatSkPlayerCountTotal(upcomingTotals.players)} · ${formatEuroAmount(upcomingTotals.earned)}`}
      </p>
      <p className="text-brand-muted text-xs mb-6">Súčet tímov, ľudí a vstupného vo všetkých budúcich kvízoch, ktoré majú prihlášky.</p>
      {msg && <p className={`text-sm mb-4 ${msg.ok ? "text-green-600" : "text-red-500"}`}>{msg.text}</p>}
      <div className="flex flex-wrap items-center gap-3 mb-8">
        <input
          className="input text-sm max-w-xs"
          placeholder="Hľadať podnik..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <button
          type="button"
          onClick={() => load()}
          className="text-sm font-semibold text-brand-orange-readable hover:underline"
        >
          Obnoviť
        </button>
      </div>

      {loading && <p className="text-brand-muted text-sm">Načítavam...</p>}

      {!loading && listEvents.length === 0 && (
        <div className="bg-brand-card rounded-2xl border border-brand-border p-12 text-center">
          <p className="text-brand-muted">Žiadne podniky{filter.trim() ? " pre tento filter" : ""}.</p>
        </div>
      )}

      <div className="space-y-3">
        {listEvents.map(({ event, list }) => {
          const totals = registrationTotalsForEvent(regs, event.slug, event.venue);
          return (
            <button
              key={event.slug}
              type="button"
              onClick={() => {
                setFilter("");
                setSelectedSlug(event.slug);
              }}
              className="w-full text-left bg-brand-card rounded-2xl border border-brand-border px-6 sm:px-8 py-5 hover:border-brand-orange hover:bg-brand-warm transition-colors group"
            >
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-brand-tint flex items-center justify-center shrink-0">
                  <Calendar className="w-5 h-5 text-brand-orange" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-lg text-brand-text group-hover:text-brand-orange-readable flex items-center gap-2">
                    {event.venue}
                    <ChevronRight className="w-4 h-4 opacity-40 group-hover:opacity-100" />
                  </div>
                  <div className="text-brand-muted text-sm mt-1 flex flex-wrap items-center gap-x-2">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-brand-orange" />
                      {event.city}
                    </span>
                    <span>
                      {formatEventDateLabel(event.date)} o {event.time}
                    </span>
                  </div>
                </div>
                <div className="text-sm text-brand-muted text-right shrink-0">
                  <div className="font-semibold text-brand-text">{teamCountLabel(totals.teams)}</div>
                  <div>{formatSkPlayerCountTotal(totals.players)}</div>
                  <div className="font-semibold text-brand-text">
                    {formatEuroAmount(estimatedEntryRevenue(event.entryFee, totals.players))}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {grouped.orphans.length > 0 && (
        <section className="mt-8 bg-brand-card rounded-2xl border border-amber-300/50 overflow-hidden">
          <div className="px-6 py-4 border-b border-brand-border bg-amber-50/80 dark:bg-amber-950/20">
            <h2 className="font-semibold text-brand-text">Iné / nepriradené</h2>
            <p className="text-brand-muted text-xs mt-1">Registrácie bez zodpovedajúcej udalosti</p>
          </div>
          <div className="p-4 sm:p-6 space-y-3">
            {grouped.orphans.map((r) => {
              const { min, max } = limitsFor(r);
              return (
                <AdminRegistrationRow
                  key={r.id}
                  reg={r}
                  minPlayers={min}
                  maxPlayers={max}
                  busy={updatingPlayersId === r.id}
                  deleting={deletingId === r.id}
                  onAdjust={(delta) => adjustPlayers(r, delta)}
                  onDelete={() => deleteOne(r.id, r.teamName)}
                />
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
