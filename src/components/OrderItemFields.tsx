"use client";

import { ChevronDown, ChevronUp, Plus, X } from "lucide-react";
import { ORDER_OPTION_MAX } from "@/lib/quiz-question-options";

type OrderItemFieldsProps = {
  items: string[];
  onChange: (items: string[]) => void;
};

export default function OrderItemFields({ items, onChange }: OrderItemFieldsProps) {
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    const current = next[index] ?? "";
    next[index] = next[target] ?? "";
    next[target] = current;
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-brand-muted">
        Poradie 1 je správne prvé. Do kvízu sa položky zamiešajú.
      </p>
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <span className="w-6 shrink-0 text-sm font-mono font-semibold text-brand-muted">{index + 1}.</span>
          <input
            value={item}
            onChange={(event) => {
              const next = [...items];
              next[index] = event.target.value;
              onChange(next);
            }}
            placeholder={index === 0 ? "Najprv" : "Ďalšia položka"}
            className="input text-sm py-2 min-w-0 flex-1"
          />
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
            disabled={index === items.length - 1}
            className="rounded-lg border border-brand-border p-2 text-brand-muted disabled:opacity-30"
            title="Nižšie"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
          {items.length > 2 ? (
            <button
              type="button"
              onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}
              className="rounded-lg border border-brand-border p-2 text-brand-muted"
              title="Odstrániť"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      ))}
      {items.length < ORDER_OPTION_MAX ? (
        <button
          type="button"
          onClick={() => onChange([...items, ""])}
          className="inline-flex items-center gap-1 rounded-lg border border-brand-border px-3 py-1.5 text-xs text-brand-muted hover:border-brand-orange"
        >
          <Plus className="h-3.5 w-3.5" />
          Pridať položku
        </button>
      ) : null}
    </div>
  );
}
