import Link from "next/link";
import { Plus, Calendar, ChevronRight } from "lucide-react";
import { RestoreMissingEvents } from "@/components/admin/RestoreMissingEvents";
import { formatEventDateLabel } from "@/lib/data";
import { isValidStoredEvent } from "@/lib/event-normalize";
import { getPollActiveFlagsBySlug } from "@/lib/poll-storage";
import { listMissingSeedEvents, readAllEventsRaw } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function AdminUdalostitPage() {
  const [{ events }, missing] = await Promise.all([readAllEventsRaw(), listMissingSeedEvents()]);
  const pollActiveBySlug = await getPollActiveFlagsBySlug(events.map((event) => event.slug));

  return (
    <div className="w-full">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-4xl text-brand-text tracking-wide mb-1">Udalosti</h1>
          <p className="text-brand-muted text-sm">Spravuj kvízové udalosti a podniky</p>
        </div>
        <Link href="/admin/udalosti/nova" className="btn-primary text-sm py-2.5 px-5 shrink-0 self-start">
          <Plus className="w-4 h-4" /> Nová udalosť
        </Link>
      </div>
      <RestoreMissingEvents
        missing={missing.map((event) => ({ slug: event.slug, venue: event.venue, city: event.city }))}
      />
      <div className="space-y-4">
        {events.map((e) => {
          const invalid = !isValidStoredEvent(e);
          return (
          <Link
            key={e.slug}
            href={`/admin/udalosti/${e.slug}`}
            className={`block bg-brand-card rounded-2xl border px-6 sm:px-8 py-5 sm:py-6 hover:border-brand-orange hover:bg-brand-warm transition-colors group ${
              invalid ? "border-red-400/60" : "border-brand-border"
            }`}
          >
            <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-8">
              <div className="flex items-start gap-4 min-w-0 flex-1">
                <div className="w-11 h-11 rounded-xl bg-brand-tint flex items-center justify-center shrink-0">
                  <Calendar className="w-5 h-5 text-brand-orange" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-lg text-brand-text group-hover:text-brand-orange-readable transition-colors">
                    {e.venue}
                  </div>
                  <div className="text-brand-muted text-sm mt-1">
                    {e.city} &mdash; {formatEventDateLabel(e.date)} o {e.time}
                  </div>
                  <div className="text-brand-muted-light text-xs mt-1 font-mono">/{e.slug}{invalid ? " · neúplný záznam" : ""}</div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 lg:max-w-md xl:max-w-lg">
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

              <div className="flex items-center gap-4 text-sm text-brand-muted shrink-0 lg:min-w-[11rem] lg:justify-end">
                <div className="flex flex-col sm:flex-row lg:flex-col gap-0.5 sm:gap-3 lg:gap-1 lg:text-right">
                  <span>{e.leagueTable.length} tímov v lige</span>
                  <span>{e.pastResults.length} výsledkov</span>
                </div>
                <ChevronRight className="w-5 h-5 text-brand-muted-light group-hover:text-brand-orange transition-colors shrink-0" />
              </div>
            </div>
          </Link>
          );
        })}
      </div>
    </div>
  );
}
