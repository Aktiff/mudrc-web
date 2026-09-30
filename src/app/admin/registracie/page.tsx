"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Calendar, ChevronRight, MapPin, Trash2 } from "lucide-react";
import type { QuizEvent } from "@/lib/data";
import { formatEventDateLabel, sortEventsForAdminOverview } from "@/lib/data";
import {
  formatSkPlayerCountTotal,
  parseRegistrationPlayerCount,
  registrationTotalsForEvent,
  registrationsForEvent,
} from "@/lib/registration-utils";
import AdminRegistrationRow, { type AdminRegistration } from "@/components/admin/AdminRegistrationRow";

function matchesFilter(reg: AdminRegistration, filter: string): boolean {
  const q = filter.trim().toLowerCase();
  if (!q) return true;
  return reg.venue.toLowerCase().includes(q) || reg.teamName.toLowerCase().includes(q);
}

function sortRegsNewestFirst(list: AdminRegistration[]): AdminRegistration[] {
  return list.slice().reverse();
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

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/admin/registrations?_=${Date.now()}`, { cache: "no-store", credentials: "same-origin" }).then((r) =>
        r.ok ? r.json() : { registrations: [] }
      ),
      fetch(`/api/admin/events?_=${Date.now()}`, { cache: "no-store", credentials: "same-origin" }).then((r) =>
        r.ok ? r.json() : { events: [] }
      ),
    ])
      .then(([regData, eventData]) => {
        setRegs(regData.registrations ?? []);
        setEvents(eventData.events ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
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

  const totalShown = filteredRegs.length;

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

  return (
    <div className="w-full min-w-0">
      <h1 className="font-display text-4xl text-brand-text tracking-wide mb-1">Registrácie</h1>
      <p className="text-brand-muted text-sm mb-2">Podľa podnikov v rovnakom poradí ako v Udalostiach</p>
      <p className="text-brand-muted text-xs mb-6">
        Počet hráčov upravíš tlačidlami <strong className="text-brand-text">− / +</strong> (uloží sa hneď). Pri
        prepnutí späť do adminu sa zoznam obnoví.
      </p>
      {msg && <p className={`text-sm mb-4 ${msg.ok ? "text-green-600" : "text-red-500"}`}>{msg.text}</p>}
      <div className="flex flex-wrap items-center gap-3 mb-8">
        <input
          className="input text-sm max-w-xs"
          placeholder="Hľadať podnik alebo tím..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <span className="text-brand-muted text-sm">{totalShown} záznamov</span>
        <button
          type="button"
          onClick={() => load()}
          className="text-sm font-semibold text-brand-orange-readable hover:underline"
        >
          Obnoviť
        </button>
      </div>

      {loading && <p className="text-brand-muted text-sm">Načítavam...</p>}

      {!loading && totalShown === 0 && (
        <div className="bg-brand-card rounded-2xl border border-brand-border p-12 text-center">
          <p className="text-brand-muted">Zatiaľ žiadne registrácie{filter.trim() ? " pre tento filter" : ""}.</p>
        </div>
      )}

      <div className="space-y-8">
        {grouped.sections.map(({ event, list }) => {
          const totals = registrationTotalsForEvent(regs, event.slug, event.venue);
          const { min, max } = {
            min: Math.max(1, event.minPlayers ?? 2),
            max: Math.max(Math.max(1, event.minPlayers ?? 2), event.maxPlayers ?? 8, 20),
          };

          return (
            <section
              key={event.slug}
              className="bg-brand-card rounded-2xl border border-brand-border overflow-hidden"
            >
              <div className="px-6 sm:px-8 py-5 sm:py-6 border-b border-brand-border bg-brand-warm/40">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6">
                  <Link
                    href={`/admin/udalosti/${event.slug}?tab=registracie`}
                    className="flex items-start gap-4 min-w-0 flex-1 group"
                  >
                    <div className="w-11 h-11 rounded-xl bg-brand-tint flex items-center justify-center shrink-0">
                      <Calendar className="w-5 h-5 text-brand-orange" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-lg text-brand-text group-hover:text-brand-orange-readable transition-colors flex items-center gap-2">
                        {event.venue}
                        <ChevronRight className="w-4 h-4 opacity-40 group-hover:opacity-100" />
                      </div>
                      <div className="text-brand-muted text-sm mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-brand-orange" />
                          {event.city}
                        </span>
                        <span>
                          {formatEventDateLabel(event.date)} o {event.time}
                        </span>
                      </div>
                    </div>
                  </Link>
                  <div className="flex flex-wrap items-center gap-3 lg:justify-end shrink-0">
                    <span className="text-sm text-brand-muted">
                      <span className="font-semibold text-brand-text">{totals.teams}</span>{" "}
                      {totals.teams === 1 ? "tím" : totals.teams >= 2 && totals.teams <= 4 ? "tímy" : "tímov"}
                      {" · "}
                      <span className="font-semibold text-brand-text">{formatSkPlayerCountTotal(totals.players)}</span>
                    </span>
                    {list.length > 0 && (
                      <button
                        type="button"
                        onClick={() => clearVenue(event, list.length)}
                        disabled={clearingVenueSlug === event.slug}
                        className="flex items-center gap-2 text-sm font-semibold px-3 py-2 rounded-xl border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                        {clearingVenueSlug === event.slug ? "Mažem…" : "Vymazať všetky"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="p-4 sm:p-6 space-y-3">
                {list.length === 0 ? (
                  <p className="text-brand-muted text-sm py-4 text-center">Zatiaľ žiadne registrácie pre tento podnik.</p>
                ) : (
                  list.map((r) => (
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
                  ))
                )}
              </div>
            </section>
          );
        })}

        {grouped.orphans.length > 0 && (
          <section className="bg-brand-card rounded-2xl border border-amber-300/50 overflow-hidden">
            <div className="px-6 py-4 border-b border-brand-border bg-amber-50/80 dark:bg-amber-950/20">
              <h2 className="font-semibold text-brand-text">Iné / nepriradené</h2>
              <p className="text-brand-muted text-xs mt-1">Registrácie bez zodpovedajúcej udalosti v zozname</p>
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
    </div>
  );
}
