import Link from "next/link";
import { Plus, Calendar, ChevronRight } from "lucide-react";
import { RestoreMissingEvents } from "@/components/admin/RestoreMissingEvents";
import { formatEventDateLabel } from "@/lib/data";
import { getPollActiveFlagsBySlug } from "@/lib/poll-storage";
import { listMissingSeedEvents, readEvents } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function AdminUdalostitPage() {
  const [{ events }, missing] = await Promise.all([readEvents(), listMissingSeedEvents()]);
  const pollActiveBySlug = await getPollActiveFlagsBySlug(events.map((event) => event.slug));

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
      <RestoreMissingEvents
        missing={missing.map((event) => ({ slug: event.slug, venue: event.venue, city: event.city }))}
      />
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
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        e.active
                          ? "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                      }`}
                    >
                      {e.active ? "Kvíz aktívny" : "Kvíz vypnutý"}
                    </span>
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        e.leagueActive !== false
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                          : "bg-brand-surface text-brand-muted border border-brand-border"
                      }`}
                    >
                      {e.leagueActive !== false ? "Liga zapnutá" : "Liga vypnutá"}
                    </span>
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        pollActiveBySlug[e.slug]
                          ? "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300"
                          : "bg-brand-surface text-brand-muted border border-brand-border"
                      }`}
                    >
                      {pollActiveBySlug[e.slug] ? "Anketa zapnutá" : "Anketa vypnutá"}
                    </span>
                    {e.registrationOpen === false && (
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-brand-surface text-brand-muted border border-brand-border">
                        Registrácie zatvorené
                      </span>
                    )}
                  </div>
                  <div className="text-brand-muted text-sm">
                    {e.city} &mdash; {formatEventDateLabel(e.date)} o {e.time}
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
