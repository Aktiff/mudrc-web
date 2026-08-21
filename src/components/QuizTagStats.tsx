"use client";

import { useMemo } from "react";
import type { QuizQuestionItem } from "@/lib/quiz-library";
import { countTagUsageInQuestions } from "@/lib/quiz-question-tags";

type Props = {
  questions: QuizQuestionItem[];
};

export default function QuizTagStats({ questions }: Props) {
  const tagCounts = useMemo(() => countTagUsageInQuestions(questions), [questions]);
  const entries = useMemo(
    () =>
      Object.entries(tagCounts).sort(
        (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "sk")
      ),
    [tagCounts]
  );

  if (!entries.length) {
    return (
      <div className="rounded-2xl border border-brand-border bg-brand-card px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-muted mb-1">Tagy v kvíze</p>
        <p className="text-sm text-brand-muted">Zatiaľ žiadne tagy — pridaj ich pri otázkach alebo vlož z banky.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-brand-border bg-brand-card px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-brand-muted mb-2">
        Tagy v kvíze · koľkokrát použité
      </p>
      <div className="flex flex-wrap gap-2">
        {entries.map(([tag, count]) => (
          <span
            key={tag}
            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${
              count >= 4
                ? "border-amber-400/70 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
                : count >= 3
                  ? "border-orange-300/60 bg-brand-tint text-brand-orange-readable"
                  : "border-brand-border bg-brand-surface text-brand-text"
            }`}
          >
            {tag}
            <span className="font-mono opacity-70">×{count}</span>
          </span>
        ))}
      </div>
      {entries.some(([, count]) => count >= 4) && (
        <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">
          Žlté tagy sú už 4× alebo viac — zváž inú tému.
        </p>
      )}
    </div>
  );
}
