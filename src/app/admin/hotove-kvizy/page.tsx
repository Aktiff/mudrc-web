import Link from "next/link";
import { MonitorPlay, Pencil, Play, Layers } from "lucide-react";
import { readAllQuizDecks } from "@/lib/quiz-deck-storage";
import { readAllEventsRaw } from "@/lib/storage";

export const dynamic = "force-dynamic";

function formatUpdatedAt(iso: string | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("sk-SK", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function HotoveKvizyPage() {
  const [{ events }, decks] = await Promise.all([readAllEventsRaw(), readAllQuizDecks()]);
  const deckBySlug = new Map(decks.map((deck) => [deck.eventSlug, deck]));

  const rows = events
    .map((event) => {
      const deck = deckBySlug.get(event.slug);
      return {
        slug: event.slug,
        venue: event.venue,
        city: event.city,
        slideCount: deck?.slides.length ?? 0,
        updatedAt: deck?.updatedAt,
        hasDeck: Boolean(deck?.slides.length),
      };
    })
    .sort((a, b) => {
      if (a.hasDeck !== b.hasDeck) return a.hasDeck ? -1 : 1;
      const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      if (aTime !== bTime) return bTime - aTime;
      return a.venue.localeCompare(b.venue, "sk");
    });

  const withSlides = rows.filter((row) => row.hasDeck).length;

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="font-display text-4xl text-brand-text tracking-wide mb-1">Hotové kvízy</h1>
        <p className="text-brand-muted text-sm max-w-2xl leading-relaxed">
          Slidy pre projektor — otázky, kolá a prestávky namiesto Canvy. Pre každý podnik jedna prezentácia;
          na konci večera na odhalenie bodov stále použite{" "}
          <strong className="text-brand-text font-semibold">Výsledky → Prezentácia</strong>.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
        <div className="bg-brand-card rounded-2xl border border-brand-border px-5 py-4">
          <div className="text-brand-muted text-xs uppercase tracking-wider mb-1">Podnikov</div>
          <div className="font-display text-3xl text-brand-text">{rows.length}</div>
        </div>
        <div className="bg-brand-card rounded-2xl border border-brand-border px-5 py-4">
          <div className="text-brand-muted text-xs uppercase tracking-wider mb-1">S pripravenými slidmi</div>
          <div className="font-display text-3xl text-brand-text">{withSlides}</div>
        </div>
        <div className="bg-brand-card rounded-2xl border border-brand-border px-5 py-4 col-span-2 sm:col-span-1">
          <div className="text-brand-muted text-xs uppercase tracking-wider mb-1">Celkom slidov</div>
          <div className="font-display text-3xl text-brand-text">
            {rows.reduce((sum, row) => sum + row.slideCount, 0)}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {rows.map((row) => (
          <div
            key={row.slug}
            className="bg-brand-card rounded-2xl border border-brand-border px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-4 sm:justify-between"
          >
            <div className="flex items-start gap-4 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-brand-tint flex items-center justify-center shrink-0">
                <MonitorPlay className="w-5 h-5 text-brand-orange" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-brand-text">{row.venue}</div>
                <div className="text-brand-muted text-sm">{row.city}</div>
                <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                  <span
                    className={`font-semibold px-2.5 py-1 rounded-full inline-flex items-center gap-1 ${
                      row.hasDeck
                        ? "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300"
                        : "bg-brand-surface text-brand-muted border border-brand-border"
                    }`}
                  >
                    <Layers className="w-3 h-3" />
                    {row.slideCount} {row.slideCount === 1 ? "slide" : row.slideCount < 5 ? "slidy" : "slidov"}
                  </span>
                  {row.hasDeck && (
                    <span className="text-brand-muted">Upravené {formatUpdatedAt(row.updatedAt)}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href={`/admin/udalosti/${row.slug}/prezentacia-kvizu`}
                className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl border border-brand-border text-brand-text hover:border-brand-orange hover:text-brand-orange-readable transition-colors"
              >
                <Pencil className="w-4 h-4" />
                Upraviť
              </Link>
              <Link
                href={`/admin/udalosti/${row.slug}/prezentacia-kvizu/prehrat`}
                className={`inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl transition-colors ${
                  row.hasDeck
                    ? "bg-brand-orange text-brand-btn-fg hover:opacity-90"
                    : "bg-brand-surface text-brand-muted border border-brand-border pointer-events-none opacity-60"
                }`}
                aria-disabled={!row.hasDeck}
                tabIndex={row.hasDeck ? 0 : -1}
              >
                <Play className="w-4 h-4" />
                Prehrať
              </Link>
            </div>
          </div>
        ))}
      </div>

      {rows.length === 0 && (
        <div className="bg-brand-card rounded-2xl border border-brand-border px-6 py-10 text-center text-brand-muted">
          Zatiaľ nemáš žiadne udalosti. Najprv vytvor podnik v sekcii Udalosti.
        </div>
      )}
    </div>
  );
}
