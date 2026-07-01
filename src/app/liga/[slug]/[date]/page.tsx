import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Trophy } from "lucide-react";
import { readEvents } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function QuizDetailPage({ params }: { params: { slug: string; date: string } }) {
  const { events } = await readEvents();
  const event = events.find((e) => e.slug === params.slug);
  if (!event) notFound();

  const dateDisplay = params.date.replace(/-/g, ".");
  const result = event.pastResults.find((r) => r.date.replace(/\./g, "-") === params.date);
  if (!result || !result.teams || result.teams.length === 0) notFound();

  const sorted = [...result.teams].sort((a, b) => b.total - a.total);

  return (
    <div className="min-h-screen bg-brand-bg pt-16">
      <section className="bg-brand-warm border-b border-orange-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <Link
            href={`/liga/${params.slug}`}
            className="inline-flex items-center gap-1.5 text-brand-muted hover:text-brand-orange transition-colors text-sm mb-5"
          >
            <ChevronLeft className="w-4 h-4" /> {event.venue}
          </Link>
          <h1 className="font-display text-5xl text-brand-text tracking-wide">{dateDisplay}</h1>
          <p className="text-brand-muted text-sm mt-1">
            Vyhrali: <span className="font-semibold text-brand-orange">{result.winnerTeam}</span>
            {" · "}
            {result.teams.length} {result.teams.length === 1 ? "tim" : result.teams.length < 5 ? "timy" : "timov"}
          </p>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="bg-white rounded-2xl border border-brand-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-stone-50 border-b border-brand-border">
                <th className="text-left px-6 py-3.5 text-xs text-stone-400 uppercase tracking-wider font-medium w-10">#</th>
                <th className="text-left px-2 py-3.5 text-xs text-stone-400 uppercase tracking-wider font-medium">Tim</th>
                <th className="text-right px-6 py-3.5 text-xs text-stone-400 uppercase tracking-wider font-medium">Body</th>
                <th className="text-right px-6 py-3.5 text-xs text-brand-orange uppercase tracking-wider font-semibold">Liga +</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {sorted.map((team, i) => {
                const isFirst = i === 0;
                const isTop3 = i < 3;
                return (
                  <tr key={i} className={`transition-colors ${isFirst ? "bg-orange-50/40" : "hover:bg-stone-50/60"}`}>
                    <td className="px-6 py-4">
                      {isTop3 ? (
                        <span className={`inline-flex w-7 h-7 rounded-full items-center justify-center text-xs font-bold ${
                          i === 0 ? "bg-amber-100 text-amber-600" : i === 1 ? "bg-stone-100 text-stone-500" : "bg-orange-50 text-orange-700"
                        }`}>
                          {i + 1}
                        </span>
                      ) : (
                        <span className="text-stone-400 text-sm w-7 inline-block text-center">{i + 1}</span>
                      )}
                    </td>
                    <td className="px-2 py-4">
                      <span className={`font-semibold text-sm ${isFirst ? "text-brand-orange" : "text-brand-text"}`}>
                        {team.teamName}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`font-display text-xl ${isFirst ? "text-brand-orange" : "text-stone-700"}`}>
                        {team.total % 1 === 0 ? team.total : team.total.toFixed(2).replace(/\.?0+$/, "")}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`text-sm font-bold ${team.ligaPoints > 0 ? "text-brand-orange" : "text-stone-300"}`}>
                        +{team.ligaPoints % 1 === 0 ? team.ligaPoints : team.ligaPoints.toFixed(1)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <Link href={`/liga/${params.slug}`} className="text-sm text-brand-muted hover:text-brand-orange transition-colors flex items-center gap-1">
            <ChevronLeft className="w-4 h-4" /> Spat na ligu
          </Link>
          <Link href={`/liga/${params.slug}`} className="btn-primary text-sm px-5 py-2.5">
            <Trophy className="w-4 h-4" /> Ligova tabulka
          </Link>
        </div>
      </div>
    </div>
  );
}
