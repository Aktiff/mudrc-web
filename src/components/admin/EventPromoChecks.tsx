"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { promoChecksForEvent, type EventPromoChecklist, type QuizEvent } from "@/lib/data";

const STEPS: { key: keyof Omit<EventPromoChecklist, "date">; label: string }[] = [
  { key: "flyerSent", label: "Leták majiteľom" },
  { key: "groupPosted", label: "Post do skupiny" },
  { key: "groupsShared", label: "Zdieľané v skupinách" },
];

export default function EventPromoChecks({
  event,
}: {
  event: Pick<QuizEvent, "slug" | "date" | "promoChecklist">;
}) {
  const [checks, setChecks] = useState(() => promoChecksForEvent(event));
  const [pending, setPending] = useState<string | null>(null);

  async function toggle(key: (typeof STEPS)[number]["key"]) {
    const previous = checks;
    const next = { ...checks, date: event.date, [key]: !checks[key] };
    setChecks(next);
    setPending(key);
    try {
      const res = await fetch(`/api/admin/events/${encodeURIComponent(event.slug)}`, {
        method: "PUT",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          _promoChecklist: true,
          flyerSent: next.flyerSent,
          groupPosted: next.groupPosted,
          groupsShared: next.groupsShared,
        }),
      });
      if (!res.ok) setChecks(previous);
    } catch {
      setChecks(previous);
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {STEPS.map((step) => {
        const on = checks[step.key];
        return (
          <button
            key={step.key}
            type="button"
            aria-pressed={on}
            disabled={pending !== null}
            onClick={() => toggle(step.key)}
            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-full border transition-colors disabled:opacity-60 ${
              on
                ? "bg-green-100 text-green-800 border-green-300 dark:bg-green-950/50 dark:text-green-300 dark:border-green-800"
                : "bg-brand-surface text-brand-muted border-brand-border hover:border-brand-orange hover:text-brand-text"
            }`}
          >
            <span
              className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                on ? "bg-green-600 border-green-600 text-white" : "border-current"
              }`}
            >
              {on ? <Check className="w-3 h-3" strokeWidth={3} /> : null}
            </span>
            {step.label}
          </button>
        );
      })}
    </div>
  );
}
