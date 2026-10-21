"use client";

import { ChevronDown, ChevronUp, Plus, X } from "lucide-react";
import { MATCH_PAIR_MAX, matchLetter } from "@/lib/quiz-question-options";

type MatchPairFieldsProps = {
  left: string[];
  right: string[];
  onChange: (left: string[], right: string[]) => void;
};

export default function MatchPairFields({ left, right, onChange }: MatchPairFieldsProps) {
  const count = Math.max(left.length, right.length);

  const update = (side: "left" | "right", index: number, value: string) => {
    const nextLeft = [...left];
    const nextRight = [...right];
    while (nextLeft.length < count) nextLeft.push("");
    while (nextRight.length < count) nextRight.push("");
    if (side === "left") nextLeft[index] = value;
    else nextRight[index] = value;
    onChange(nextLeft, nextRight);
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= count) return;
    const nextLeft = [...left];
    const nextRight = [...right];
    while (nextLeft.length < count) nextLeft.push("");
    while (nextRight.length < count) nextRight.push("");
    const leftItem = nextLeft[index] ?? "";
    nextLeft[index] = nextLeft[target] ?? "";
    nextLeft[target] = leftItem;
    const rightItem = nextRight[index] ?? "";
    nextRight[index] = nextRight[target] ?? "";
    nextRight[target] = rightItem;
    onChange(nextLeft, nextRight);
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-brand-muted">
        Rovnaký riadok je správna dvojica. Do kvízu sa obe strany zamiešajú a vznikne odpoveď typu 1C, 2A, 3B.
      </p>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="w-6 shrink-0 text-sm font-mono font-semibold text-brand-muted">{index + 1}.</span>
            <input
              value={left[index] ?? ""}
              onChange={(event) => update("left", index, event.target.value)}
              placeholder="Ľavá strana"
              className="input text-sm py-2 min-w-0 flex-1"
            />
          </div>
          <span className="hidden sm:inline text-brand-muted text-sm">→</span>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="w-6 shrink-0 text-sm font-mono font-semibold text-brand-muted">{matchLetter(index)}</span>
            <input
              value={right[index] ?? ""}
              onChange={(event) => update("right", index, event.target.value)}
              placeholder="Pravá strana"
              className="input text-sm py-2 min-w-0 flex-1"
            />
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => move(index, -1)}
              disabled={index === 0}
              className="rounded-lg border border-brand-border p-2 text-brand-muted disabled:opacity-30"
              title="Vyššie"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => move(index, 1)}
              disabled={index === count - 1}
              className="rounded-lg border border-brand-border p-2 text-brand-muted disabled:opacity-30"
              title="Nižšie"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
            {count > 2 ? (
              <button
                type="button"
                onClick={() =>
                  onChange(
                    left.filter((_, itemIndex) => itemIndex !== index),
                    right.filter((_, itemIndex) => itemIndex !== index)
                  )
                }
                className="rounded-lg border border-brand-border p-2 text-brand-muted"
                title="Odstrániť"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>
      ))}
      {count < MATCH_PAIR_MAX ? (
        <button
          type="button"
          onClick={() => onChange([...left, ""], [...right, ""])}
          className="inline-flex items-center gap-1 rounded-lg border border-brand-border px-3 py-1.5 text-xs text-brand-muted hover:border-brand-orange"
        >
          <Plus className="h-3.5 w-3.5" />
          Pridať dvojicu
        </button>
      ) : null}
    </div>
  );
}
