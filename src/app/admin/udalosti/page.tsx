import Link from "next/link";
import { Plus, Calendar, PauseCircle, ChevronRight } from "lucide-react";
import { readEvents } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function AdminUdalostitPage() {
  const { events } = await readEvents();

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-4xl text-brand-text tracking-wide mb-1">Udalosti</h1>
          <p className="text-brand-muted text-sm">Spravuj kvízové udalosti a podniky</p>
        </div>
        <Link href="/admin/udalosti/nova" className="btn-primary text-sm py-2.5 px-5">
          <Plus className="w-4 h-4" /> Nová udalosť
        </Link>
      </div>
      <div className="space-y-3">
        {events.map((e) => (
          <Link
            key={e.slug}
            href={`/admin/udalosti/${e.slug}`}
            className="block bg-brand-card rounded-2xl border border-brand-border px-6 py-5 hover:border-brand-orange hover:bg-brand-warm transition-colors group"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-brand-tint flex items-center justify-center shrink-0">
                  <Calendar className="w-5 h-5 text-brand-orange" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-brand-text group-hover:text-brand-orange-readable transition-colors">
                      {e.venue}
                    </span>
                    {!e.active && (
                      <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300 px-2 py-0.5 rounded-full">
                        <PauseCircle className="w-3 h-3" /> Kvíz vypnutý
                      </span>
                    )}
                    {e.leagueActive === false && (
                      <span className="text-xs text-brand-muted bg-brand-surface px-2 py-0.5 rounded-full border border-brand-border">
                        Liga vypnutá
                      </span>
                    )}
                  </div>
                  <div className="text-brand-muted text-sm">
                    {e.city} &mdash; {e.date} o {e.time}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm text-brand-muted shrink-0">
                <span className="hidden sm:inline">{e.leagueTable.length} tímov v lige</span>
                <span className="hidden sm:inline">{e.pastResults.length} výsledkov</span>
                <ChevronRight className="w-5 h-5 text-brand-muted-light group-hover:text-brand-orange transition-colors" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
