import Link from "next/link";
import { Calendar, Plus, PauseCircle } from "lucide-react";
import eventsData from "@/data/events.json";

export default function AdminDashboard() {
  const events = eventsData.events;

  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-4xl text-brand-text tracking-wide mb-1">Prehľad</h1>
      <p className="text-stone-500 text-sm mb-8">Vitaj v admin rozhraní Mudrc kvíz</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        <div className="bg-white rounded-2xl border border-stone-200 p-6">
          <div className="text-stone-400 text-xs uppercase tracking-wider mb-1">Udalosti</div>
          <div className="font-display text-4xl text-brand-text">{events.length}</div>
        </div>
        <div className="bg-white rounded-2xl border border-stone-200 p-6">
          <div className="text-stone-400 text-xs uppercase tracking-wider mb-1">Tímov v ligách</div>
          <div className="font-display text-4xl text-brand-text">
            {events.reduce((sum, e) => sum + e.leagueTable.length, 0)}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-stone-200 p-6">
          <div className="text-stone-400 text-xs uppercase tracking-wider mb-1">Odohraných kvízov</div>
          <div className="font-display text-4xl text-brand-text">
            {events.reduce((sum, e) => sum + e.pastResults.length, 0)}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-stone-700">Udalosti</h2>
        <Link href="/admin/udalosti/nova" className="btn-primary text-sm py-2 px-4">
          <Plus className="w-4 h-4" /> Nová udalosť
        </Link>
      </div>
      <div className="space-y-2">
        {events.map((e) => (
          <Link
            key={e.slug}
            href={`/admin/udalosti/${e.slug}`}
            className="flex items-center justify-between bg-white rounded-xl border border-stone-200 px-5 py-4 hover:border-brand-orange transition-colors group"
          >
            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-brand-orange" />
              <span className="font-medium text-stone-700 group-hover:text-brand-orange transition-colors">{e.venue}</span>
              <span className="text-stone-400 text-sm">{e.city}</span>
              {!(e as { active?: boolean }).active && (
                <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                  <PauseCircle className="w-3 h-3" /> Pozastavená
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm text-stone-400">
              <span>{e.date} {e.time}</span>
              <span>{e.leagueTable.length} tímov</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
