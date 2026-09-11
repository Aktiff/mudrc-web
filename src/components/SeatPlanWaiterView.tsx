"use client";

import { Printer, Share2 } from "lucide-react";
import SeatPlanCanvas from "@/components/SeatPlanCanvas";
import type { SeatPlan } from "@/lib/seat-plan";

function sortTables(plan: SeatPlan) {
  return [...plan.tables].sort((a, b) =>
    a.number.localeCompare(b.number, "sk", { numeric: true })
  );
}

export default function SeatPlanWaiterView({ plan }: { plan: SeatPlan }) {
  const peopleCount = plan.tables.reduce((sum, table) => sum + (table.people || 0), 0);
  const tables = sortTables(plan);

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
    <div className="waiter-plan mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <div className="waiter-toolbar mb-5 flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-orange-readable">Zasadací poriadok</p>
          <h1 className="font-display text-4xl tracking-wide text-brand-text">{plan.venue || plan.title}</h1>
          {(plan.date || plan.title) && (
            <p className="text-sm text-brand-muted">
              {plan.date}
              {plan.date && plan.title ? " · " : ""}
              {plan.title !== plan.venue ? plan.title : ""}
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

      <div className="mb-4 hidden print:block">
        <h1 className="font-display text-4xl tracking-wide">{plan.venue || plan.title}</h1>
        {plan.date && <p className="text-sm">{plan.date}</p>}
      </div>

      <p className="mb-4 text-sm text-brand-muted">
        {plan.tables.length} stolov · {peopleCount} ľudí
      </p>
      {plan.notes && (
        <p className="mb-4 rounded-xl border border-brand-border bg-brand-card px-4 py-3 text-sm text-brand-text">
          {plan.notes}
        </p>
      )}

      <SeatPlanCanvas plan={plan} variant="waiter" />

      <div className="mt-6 overflow-x-auto rounded-2xl border border-brand-border bg-brand-card">
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
