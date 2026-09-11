"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Armchair, Copy, Plus, Trash2 } from "lucide-react";
import { formatUpdatedAt, type SeatPlanSummary } from "@/lib/seat-plan";

type EventOption = { slug: string; venue: string; date: string };

export default function SeatPlanListClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetEvent = searchParams.get("event") ?? "";
  const [plans, setPlans] = useState<SeatPlanSummary[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [eventSlug, setEventSlug] = useState(presetEvent);
  const [fromRegs, setFromRegs] = useState(true);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    Promise.all([
      fetch(`/api/admin/seat-plans?_=${Date.now()}`, { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/admin/events", { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([planData, eventData]) => {
        setPlans(planData.plans ?? []);
        setEvents(
          (eventData.events ?? []).map((event: EventOption) => ({
            slug: event.slug,
            venue: event.venue,
            date: event.date,
          }))
        );
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (presetEvent) setEventSlug(presetEvent);
  }, [presetEvent]);

  const createPlan = async (opts?: { duplicateFrom?: string; clearReservations?: boolean }) => {
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/admin/seat-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          opts?.duplicateFrom
            ? { duplicateFrom: opts.duplicateFrom, clearReservations: opts.clearReservations ?? true }
            : {
                eventSlug,
                fromRegistrations: Boolean(eventSlug) && fromRegs,
              }
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Nepodarilo sa vytvoriť zasadací.");
        return;
      }
      router.push(`/admin/zasadacie/${data.id}`);
    } finally {
      setCreating(false);
    }
  };

  const removePlan = async (id: string, title: string) => {
    if (!confirm(`Zmazať zasadací „${title}“?`)) return;
    const res = await fetch(`/api/admin/seat-plans/${id}`, { method: "DELETE" });
    if (res.ok) load();
  };

  const presetVenue = events.find((event) => event.slug === eventSlug);

  return (
    <div className="w-full">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display mb-1 text-4xl tracking-wide text-brand-text">Zasadacie poriadky</h1>
          <p className="text-sm text-brand-muted">
            Nakresli miestnosť, rozostav stoly, doplň mená tímov a pošli odkaz čašníkovi.
          </p>
        </div>
      </div>

      <div className="mb-8 rounded-2xl border border-brand-border bg-brand-card p-5">
        <h2 className="font-display text-2xl tracking-wide text-brand-text">Nový zasadací</h2>
        {presetVenue && (
          <p className="mt-1 text-sm text-brand-muted">
            Pre podnik <span className="font-semibold text-brand-text">{presetVenue.venue}</span>
          </p>
        )}
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <label className="label">Udalosť / podnik</label>
            <select className="input" value={eventSlug} onChange={(e) => setEventSlug(e.target.value)}>
              <option value="">Prázdna miestnosť</option>
              {events.map((event) => (
                <option key={event.slug} value={event.slug}>
                  {event.venue} ({event.date})
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            disabled={creating}
            onClick={() => void createPlan()}
            className="btn-primary justify-center py-2.5 px-5 text-sm"
          >
            <Plus className="h-4 w-4" />
            {creating ? "Vytváram…" : "Vytvoriť"}
          </button>
        </div>
        {eventSlug && (
          <label className="mt-3 flex items-center gap-2 text-sm text-brand-muted">
            <input type="checkbox" checked={fromRegs} onChange={(e) => setFromRegs(e.target.checked)} />
            Hneď rozložiť stoly podľa registrácií
          </label>
        )}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>

      {loading && <p className="text-sm text-brand-muted">Načítavam…</p>}
      {!loading && plans.length === 0 && (
        <p className="rounded-2xl border border-dashed border-brand-border px-6 py-10 text-center text-sm text-brand-muted">
          Zatiaľ žiadny zasadací. Vytvor miestnosť, ťahaj stoly a pošli odkaz obsluhe.
        </p>
      )}
      <div className="space-y-3">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className="flex flex-col gap-4 rounded-2xl border border-brand-border bg-brand-card px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <Link href={`/admin/zasadacie/${plan.id}`} className="min-w-0 flex-1">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-tint">
                  <Armchair className="h-5 w-5 text-brand-orange" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-brand-text">{plan.venue || plan.title}</div>
                  <div className="text-sm text-brand-muted">
                    {plan.date ? `${plan.date} · ` : ""}
                    {plan.tableCount} stolov · {plan.peopleCount} ľudí · {plan.assignedCount} rezervácií
                  </div>
                  <div className="text-xs text-brand-muted-light">{formatUpdatedAt(plan.updatedAt)}</div>
                </div>
              </div>
            </Link>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-outline py-2 px-3 text-xs"
                onClick={() => void createPlan({ duplicateFrom: plan.id, clearReservations: true })}
                title="Skopírovať rozloženie miestnosti bez mien"
              >
                <Copy className="h-3.5 w-3.5" /> Miestnosť znova
              </button>
              <Link href={`/admin/zasadacie/${plan.id}`} className="btn-primary py-2 px-4 text-xs">
                Otvoriť
              </Link>
              <button
                type="button"
                className="btn-outline py-2 px-3 text-xs text-red-600"
                onClick={() => void removePlan(plan.id, plan.venue || plan.title)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
