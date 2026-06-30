import Link from "next/link";
import { Plus, Pencil, Calendar, PauseCircle } from "lucide-react";
import { readEvents } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function AdminUdalostitPage() {
  const { events } = await readEvents();

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-4xl text-brand-text tracking-wide mb-1">Udalosti</h1>
          <p className="text-stone-500 text-sm">Spravuj kvízové udalosti a podniky</p>
        </div>
        <Link href="/admin/udalosti/nova" className="btn-primary text-sm py-2.5 px-5">
          <Plus className="w-4 h-4" /> Nová udalosť
        </Link>
      </div>
      <div className="space-y-3">
        {events.map((e) => (
          <div
            key={e.slug}
            className="bg-white rounded-2xl border border-stone-200 px-6 py-5 flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5 text-brand-orange" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-stone-800">{e.venue}</span>
                  {!e.active && (
                    <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                      <PauseCircle className="w-3 h-3" /> Kvíz vypnutý
                    </span>
                  )}
                  {e.leagueActive === false && (
                    <span className="text-xs text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full">
                      Liga vypnutá
                    </span>
                  )}
                </div>
                <div className="text-stone-400 text-sm">
                  {e.city} &mdash; {e.date} o {e.time}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-6 text-sm text-stone-400">
              <span>{e.leagueTable.length} tímov v lige</span>
              <span>{e.pastResults.length} výsledkov</span>
              <Link
                href={`/admin/udalosti/${e.slug}`}
                className="flex items-center gap-1.5 text-brand-orange hover:underline font-medium"
              >
                <Pencil className="w-3.5 h-3.5" /> Upraviť
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
