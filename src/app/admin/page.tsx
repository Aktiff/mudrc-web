import Link from "next/link";
import { Calendar, Plus, PauseCircle } from "lucide-react";
import { readEvents } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const { events } = await readEvents();

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

      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display text-2xl text-brand-text tracking-wide">Udalosti</h2>
        <Link href="/admin/udalosti/nova" className="btn-primary text-sm py-2.5 px-5">
          <Plus className="w-4 h-4" /> Nová udalosť
        </Link>
      </div>

      <div className="space-y-3">
        {events.map((e) => (
          <Link
            key={e.slug}
            href={`/admin/udalosti/${e.slug}`}
            className="block bg-white rounded-2xl border border-stone-200 px-6 py-5 hover:border-brand-orange transition-colors"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                  <Calendar className="w-5 h-5 text-brand-orange" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-stone-800">{e.venue}</span>
                    {!e.active && (
                      <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                        <PauseCircle className="w-3 h-3" /> Pozastavená
                      </span>
                    )}
                  </div>
                  <div className="text-stone-400 text-sm">
                    {e.city} &mdash; {e.date} o {e.time}
                  </div>
                </div>
              </div>
              <div className="text-sm text-stone-400 shrink-0">
                {e.leagueTable.length} tímov · {e.pastResults.length} kvízov
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
