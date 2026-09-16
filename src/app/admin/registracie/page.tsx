"use client";
import { useEffect, useMemo, useState } from "react";
import { Phone, MapPin, Clock, Trash2 } from "lucide-react";
import type { QuizEvent } from "@/lib/data";
import { parseRegistrationPlayerCount } from "@/lib/registration-utils";
import RegistrationPlayersStepper from "@/components/admin/RegistrationPlayersStepper";

type Registration = {
  id: string;
  eventSlug: string;
  venue: string;
  teamName: string;
  players: string;
  phone: string;
  createdAt: string;
};

export default function RegistraciaPage() {
  const [regs, setRegs] = useState<Registration[]>([]);
  const [events, setEvents] = useState<QuizEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [updatingPlayersId, setUpdatingPlayersId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      fetch(`/api/register?_=${Date.now()}`, { cache: "no-store" }).then((r) => r.json()),
      fetch(`/api/admin/events?_=${Date.now()}`, { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([regData, eventData]) => {
        setRegs(regData.registrations ?? []);
        setEvents(eventData.events ?? []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const eventBySlug = useMemo(() => new Map(events.map((event) => [event.slug, event])), [events]);

  const limitsFor = (reg: Registration) => {
    const event = eventBySlug.get(reg.eventSlug);
    const min = Math.max(1, event?.minPlayers ?? 2);
    const max = Math.max(min, event?.maxPlayers ?? 8, 20);
    return { min, max };
  };

  const filtered = regs
    .slice()
    .reverse()
    .filter(
      (r) =>
        !filter ||
        r.venue.toLowerCase().includes(filter.toLowerCase()) ||
        r.teamName.toLowerCase().includes(filter.toLowerCase())
    );

  const adjustPlayers = async (reg: Registration, delta: number) => {
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
      const res = await fetch(`/api/admin/registrations?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (res.ok) load();
    } finally {
      setDeletingId(null);
    }
  };

  const deleteFiltered = async () => {
    if (filtered.length === 0) return;
    const msgConfirm =
      filter.trim().length > 0
        ? `Naozaj zmazať ${filtered.length} zobrazených registrácií?`
        : `Naozaj zmazať všetkých ${filtered.length} registrácií? Toto sa nedá vrátiť.`;
    if (!confirm(msgConfirm)) return;
    setBulkDeleting(true);
    try {
      const res = await fetch(
        `/api/admin/registrations?ids=${filtered.map((r) => r.id).join(",")}`,
        { method: "DELETE" }
      );
      if (res.ok) load();
    } finally {
      setBulkDeleting(false);
    }
  };

  return (
    <div className="w-full">
      <h1 className="font-display text-4xl text-brand-text tracking-wide mb-1">Registrácie</h1>
      <p className="text-brand-muted text-sm mb-2">Zoznam všetkých prihlásených tímov</p>
      <p className="text-brand-muted text-xs mb-6">
        Pri každom tíme môžeš tlačidlami <strong className="text-brand-text">− / +</strong> upraviť počet hráčov (uloží sa
        hneď).
      </p>
      {msg && (
        <p className={`text-sm mb-4 ${msg.ok ? "text-green-600" : "text-red-500"}`}>{msg.text}</p>
      )}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <input
          className="input text-sm max-w-xs"
          placeholder="Hľadať podnik alebo tím..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <span className="text-brand-muted text-sm">{filtered.length} záznamov</span>
        {filtered.length > 0 && (
          <button
            onClick={deleteFiltered}
            disabled={bulkDeleting}
            className="ml-auto flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            {bulkDeleting ? "Mažem..." : filter.trim() ? "Vymazať zobrazené" : "Vymazať všetky"}
          </button>
        )}
      </div>
      {loading && <p className="text-brand-muted text-sm">Načítavam...</p>}
      {!loading && filtered.length === 0 && (
        <div className="bg-brand-card rounded-2xl border border-brand-border p-12 text-center">
          <p className="text-brand-muted">Zatiaľ žiadne registrácie.</p>
        </div>
      )}
      <div className="space-y-3">
        {filtered.map((r) => {
          const { min, max } = limitsFor(r);
          return (
          <div
            key={r.id}
            className="bg-brand-card rounded-2xl border border-brand-border p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4"
          >
            <div className="min-w-0 flex-1 space-y-3">
              <div className="font-display text-2xl text-brand-text">{r.teamName}</div>
              <div className="flex flex-wrap items-center gap-4 text-sm text-brand-muted">
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-brand-orange" />
                  {r.venue}
                </span>
                <span className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" />
                  {r.phone}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  {r.createdAt}
                </span>
              </div>
              <RegistrationPlayersStepper
                players={r.players}
                minPlayers={min}
                maxPlayers={max}
                busy={updatingPlayersId === r.id}
                onAdjust={(delta) => adjustPlayers(r, delta)}
              />
            </div>
            <button
              onClick={() => deleteOne(r.id, r.teamName)}
              disabled={deletingId === r.id}
              className="shrink-0 flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors disabled:opacity-50"
              title="Zmazať registráciu"
            >
              <Trash2 className="w-4 h-4" />
              {deletingId === r.id ? "..." : "Zmazať"}
            </button>
          </div>
          );
        })}
      </div>
    </div>
  );
}
