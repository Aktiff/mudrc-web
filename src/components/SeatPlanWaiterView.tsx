"use client";

import { useEffect, useState } from "react";
import { Printer, Share2 } from "lucide-react";
import SeatPlanCanvas from "@/components/SeatPlanCanvas";
import type { SeatPlan } from "@/lib/seat-plan";

function sortTables(plan: SeatPlan) {
  return [...plan.tables].sort((a, b) =>
    a.number.localeCompare(b.number, "sk", { numeric: true })
  );
}

export default function SeatPlanWaiterView({ plan: initialPlan }: { plan: SeatPlan }) {
  const [plan, setPlan] = useState(initialPlan);
  const peopleCount = plan.tables.reduce((sum, table) => sum + (table.people || 0), 0);
  const tables = sortTables(plan);

  useEffect(() => {
    const token = initialPlan.shareToken;
    if (!token) return;
    fetch(`/api/zasadacie/${token}?_=${Date.now()}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.id && Array.isArray(data.tables)) setPlan(data as SeatPlan);
      })
      .catch(() => {
        /* keep server-rendered plan */
      });
  }, [initialPlan.shareToken]);

  const share = async () => {
    const title = `${plan.venue || plan.title} — zasadací`;
    if (navigator.share) {
      try {
        await navigator.share({ title, url: window.location.href, text: title });
        return;
      } catch {
        /* cancelled */
      }
    }
    window.print();
  };

  return (
    <div className="waiter-plan flex h-[100dvh] flex-col bg-brand-bg px-3 py-3 sm:px-4">
      <div className="waiter-toolbar mb-3 flex shrink-0 flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-orange-readable">Zasadací poriadok</p>
          <h1 className="font-display text-3xl tracking-wide text-brand-text sm:text-4xl">{plan.venue || plan.title}</h1>
          {(plan.date || plan.title) && (
            <p className="text-sm text-brand-muted">
              {plan.date}
              {plan.date && plan.title ? " · " : ""}
              {plan.title !== plan.venue ? plan.title : ""}
              {` · ${plan.tables.length} stolov · ${peopleCount} ľudí`}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-outline py-2 px-4 text-sm" onClick={() => void share()}>
            <Share2 className="h-4 w-4" /> Zdieľať
          </button>
          <button type="button" className="btn-primary py-2 px-4 text-sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Tlačiť
          </button>
        </div>
      </div>

      <div className="mb-3 hidden print:block">
        <h1 className="font-display text-4xl tracking-wide">{plan.venue || plan.title}</h1>
        {plan.date && <p className="text-sm">{plan.date}</p>}
        <p className="text-sm">
          {plan.tables.length} stolov · {peopleCount} ľudí
        </p>
      </div>

      {plan.notes && (
        <p className="mb-3 shrink-0 rounded-xl border border-brand-border bg-brand-card px-4 py-2 text-sm text-brand-text">
          {plan.notes}
        </p>
      )}

      <div className="waiter-canvas min-h-0 flex-1 overflow-hidden rounded-xl bg-brand-surface/60 p-1">
        <SeatPlanCanvas plan={plan} variant="waiter" />
      </div>

      <div className="waiter-table-list mt-4 hidden overflow-x-auto rounded-2xl border border-brand-border bg-brand-card print:mt-6 print:block">
        <table className="w-full min-w-[20rem] text-left text-sm">
          <thead>
            <tr className="border-b border-brand-border text-xs uppercase tracking-wider text-brand-muted">
              <th className="px-4 py-3">Stôl</th>
              <th className="px-4 py-3">Rezervácia</th>
              <th className="px-4 py-3">Ľudí</th>
              <th className="px-4 py-3">Stoličky</th>
            </tr>
          </thead>
          <tbody>
            {tables.map((table) => (
              <tr key={table.id} className="border-b border-brand-border last:border-0">
                <td className="px-4 py-3 font-display text-xl tracking-wide">{table.number}</td>
                <td className="px-4 py-3 font-semibold">{table.reservation || "—"}</td>
                <td className="px-4 py-3">{table.people || "—"}</td>
                <td className="px-4 py-3 text-brand-muted">{table.seats}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
