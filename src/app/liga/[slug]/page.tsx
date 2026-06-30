"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Medal, Trophy, Calendar } from "lucide-react";
import type { QuizEvent } from "@/lib/data";
const medalStyles = [
  { bg: "#FFD700", color: "#5a3e00", border: "#c9a800" },
  { bg: "#C0C0C0", color: "#333333", border: "#909090" },
  { bg: "#CD7F32", color: "#ffffff", border: "#a05a1a" },
];

const INITIAL_RESULTS = 3;

export default function LigaDetailPage({ params }: { params: { slug: string } }) {
  const [event, setEvent] = useState<QuizEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    fetch(`/api/events/${params.slug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setEvent(data))
      .finally(() => setLoading(false));
  }, [params.slug]);

  if (loading) {
    return <div className="min-h-screen bg-brand-bg pt-16 flex items-center justify-center text-brand-muted">Načítavam...</div>;
  }
  if (!event || event.active === false) notFound();
  if (event.leagueTable.length === 0 && event.pastResults.length === 0) notFound();
  const results = event.pastResults.slice().reverse();
  const visibleResults = showAll ? results : results.slice(0, INITIAL_RESULTS);
  const hidden = results.length - INITIAL_RESULTS;

  return (
    <div className="min-h-screen bg-brand-bg pt-16">
      <section className="bg-brand-warm border-b border-brand-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <Link href="/liga" className="inline-flex items-center gap-1.5 text-brand-muted hover:text-brand-orange-readable transition-colors text-sm mb-6">
            <ChevronLeft className="w-4 h-4" /> Podniky
          </Link>
          <h1 className="font-display text-5xl sm:text-6xl text-brand-text tracking-wide">{event.venue}</h1>
          <p className="text-brand-muted text-sm mt-2">{event.city} &mdash; {event.address}</p>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">

        {results.length > 0 && (
          <div className="bg-brand-card rounded-2xl border border-brand-border p-6 md:p-8">
            <h2 className="font-display text-3xl text-brand-text tracking-wide mb-5">História kvízov</h2>
            <div className="space-y-2">
              {visibleResults.map((r, i) => (
                <div key={i} className="grid items-center gap-3 px-4 py-3 rounded-xl hover:bg-brand-hover transition-colors"
                  style={{ gridTemplateColumns: "1.1rem 6.5rem 2.5rem 1fr auto" }}>
                  <Calendar className="w-4 h-4 text-brand-orange-readable shrink-0" />
                  <span className="font-semibold text-brand-text text-sm">{r.date}</span>
                  <span className="text-brand-muted text-sm">víťaz</span>
                  <span className="font-semibold text-brand-orange-readable text-sm">{r.winnerTeam}</span>
                  <span className="text-brand-muted text-sm font-medium text-right">{r.points} bodov</span>
                </div>
              ))}
            </div>
            {!showAll && hidden > 0 && (
              <button
                onClick={() => setShowAll(true)}
                className="mt-3 text-brand-orange-readable text-sm font-semibold hover:underline w-full text-center py-2"
              >
                Zobraziť viac ({hidden} ďalších)
              </button>
            )}
            {showAll && hidden > 0 && (
              <button
                onClick={() => setShowAll(false)}
                className="mt-3 text-brand-muted text-sm hover:underline w-full text-center py-2"
              >
                Skryť
              </button>
            )}
          </div>
        )}

        {event.leagueTable.length > 0 && (
          <div className="bg-brand-card rounded-2xl border border-brand-border p-6 md:p-8">
            <h2 className="font-display text-3xl text-brand-text tracking-wide mb-6">Ligová tabuľka</h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-brand-surface rounded-xl">
                    <th className="text-left py-3 px-3 text-xs text-brand-muted uppercase tracking-wider font-semibold rounded-l-xl w-14">#</th>
                    <th className="text-left py-3 px-3 text-xs text-brand-muted uppercase tracking-wider font-semibold">Tím</th>
                    <th className="text-right py-3 px-4 text-xs text-brand-muted uppercase tracking-wider font-semibold">Body</th>
                    <th className="text-right py-3 px-4 text-xs text-brand-muted uppercase tracking-wider font-semibold rounded-r-xl whitespace-nowrap">Počet kvízov</th>
                  </tr>
                </thead>
                <tbody>
                  {event.leagueTable.map((entry, idx) => (
                    <tr
                      key={entry.rank}
                      className={`transition-colors hover:bg-brand-hover border-b ${idx === event.leagueTable.length - 1 ? "border-transparent" : "border-brand-border"}`}
                    >
                      <td className="py-4 px-3">
                        {entry.rank <= 3 ? (
                          <span
                            className="inline-flex w-8 h-8 rounded-full border items-center justify-center"
                            style={{
                              background: medalStyles[entry.rank - 1].bg,
                              color: medalStyles[entry.rank - 1].color,
                              borderColor: medalStyles[entry.rank - 1].border,
                            }}
                          >
                            <Medal className="w-4 h-4" />
                          </span>
                        ) : (
                          <span className="text-brand-muted text-sm font-medium w-8 inline-block text-center">{entry.rank}</span>
                        )}
                      </td>
                      <td className="py-4 px-3">
                        <span className={`font-semibold ${entry.rank === 1 ? "text-brand-orange-readable text-base" : "text-brand-text text-sm"}`}>
                          {entry.teamName}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className={`font-display text-2xl font-bold ${entry.rank === 1 ? "text-brand-orange-readable" : "text-brand-text"}`}>
                          {entry.points}
                        </span>
                        <span className="text-brand-muted text-xs ml-0.5">b</span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className="inline-flex items-center justify-center min-w-[2rem] h-7 rounded-lg bg-brand-surface text-brand-muted text-sm font-semibold border border-brand-border">
                          {entry.quizzesPlayed}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="text-center pt-4">
          <Link href={`/udalosti/${event.slug}`} className="btn-primary text-sm px-6 py-3">
            <Trophy className="w-4 h-4" /> Zaregistrovať tím na ďalší kvíz
          </Link>
        </div>

      </div>
    </div>
  );
}
