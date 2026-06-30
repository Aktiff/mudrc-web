import Link from "next/link";
import { Trophy } from "lucide-react";
import type { Metadata } from "next";
import { readEvents } from "@/lib/storage";
import { getVisibleLeagues } from "@/lib/data";

export const metadata: Metadata = {
  title: "Liga",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function LigaPage() {
  const { events } = await readEvents();
  const activeEvents = getVisibleLeagues(events);

  return (
    <div className="min-h-screen bg-brand-bg pt-16">
      <section className="bg-brand-warm border-b border-brand-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <span className="text-brand-orange-readable text-sm font-semibold uppercase tracking-wider">
            Sezóna 2025 / 2026
          </span>
          <h1 className="font-display text-6xl sm:text-7xl text-brand-text tracking-wide mt-3">LIGA</h1>
          <p className="text-brand-muted text-lg mt-3 max-w-xl">
            Vyber podnik a uvidíš históriu kvízov a ligovú tabuľku. Zbieraj body, bojuj o prvé miesto.
          </p>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {activeEvents.length === 0 && (
          <p className="text-brand-muted text-center">Zatiaľ žiadne aktívne ligy.</p>
        )}
        <div className="space-y-4">
          {activeEvents.map((event) => {
            const leader = event.leagueTable[0];
            return (
              <Link
                key={event.slug}
                href={`/liga/${event.slug}`}
                className="block bg-brand-card rounded-2xl border border-brand-border px-6 py-5 hover:border-brand-orange-readable hover:shadow-lg transition-[border-color,box-shadow] duration-200 group"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-brand-tint flex items-center justify-center shrink-0">
                      <Trophy className="w-5 h-5 text-brand-orange-readable" />
                    </div>
                    <div>
                      <div className="font-display text-2xl text-brand-text tracking-wide group-hover:text-brand-orange-readable transition-colors">
                        {event.venue}
                      </div>
                      <div className="text-brand-muted text-sm">{event.city}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 text-sm text-brand-muted shrink-0">
                    <div className="text-center w-12 hidden sm:block">
                      <div className="font-bold text-brand-text text-lg leading-tight">{event.leagueTable.length}</div>
                      <div className="text-xs">tímov</div>
                    </div>
                    <div className="text-center w-12 hidden sm:block">
                      <div className="font-bold text-brand-text text-lg leading-tight">{event.pastResults.length}</div>
                      <div className="text-xs">kvízov</div>
                    </div>
                    {leader && (
                      <div className="text-right w-28 hidden md:block">
                        <div className="text-xs text-brand-muted mb-0.5">Líder</div>
                        <div className="font-semibold text-brand-orange-readable truncate">{leader.teamName}</div>
                      </div>
                    )}
                    <div className="text-brand-orange-readable group-hover:translate-x-1 transition-transform text-lg">→</div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
