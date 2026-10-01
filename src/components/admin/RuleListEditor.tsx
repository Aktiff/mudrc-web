"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, GripVertical, Plus, Trash2 } from "lucide-react";

function moveToIndex(items: string[], from: number, to: number): string[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function RuleListEditor({
  rules,
  onChange,
  placeholder,
  addLabel,
  emptyLabel,
}: {
  rules: string[];
  onChange: (rules: string[]) => void;
  placeholder: string;
  addLabel: string;
  emptyLabel: string;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const move = (from: number, to: number) => {
    const next = moveToIndex(rules, from, to);
    if (next !== rules) onChange(next);
  };

  return (
    <div>
      <div className="space-y-2 mb-4">
        {rules.length === 0 && <p className="text-brand-muted text-sm py-4 text-center">{emptyLabel}</p>}
        {rules.map((rule, i) => (
          <div
            key={i}
            onDragOver={(e) => {
              e.preventDefault();
              e.currentTarget.classList.add("ring-2", "ring-brand-orange/40");
            }}
            onDragLeave={(e) => {
              e.currentTarget.classList.remove("ring-2", "ring-brand-orange/40");
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.classList.remove("ring-2", "ring-brand-orange/40");
              const from = Number(e.dataTransfer.getData("text/plain"));
              if (!Number.isInteger(from)) return;
              move(from, i);
              setDragIndex(null);
            }}
            className={`flex items-center gap-2 rounded-xl ${dragIndex === i ? "opacity-60" : ""}`}
          >
            <button
              type="button"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("text/plain", String(i));
                e.dataTransfer.effectAllowed = "move";
                setDragIndex(i);
              }}
              onDragEnd={() => setDragIndex(null)}
              className="p-1 rounded-md text-brand-muted hover:text-brand-text cursor-grab active:cursor-grabbing shrink-0"
              title="Presuň pretiahnutím"
            >
              <GripVertical className="w-4 h-4" />
            </button>
            <span className="text-brand-muted-light text-sm w-5 text-right shrink-0">{i + 1}.</span>
            <input
              className="input text-sm py-2 flex-1"
              value={rule}
              onChange={(e) => onChange(rules.map((item, idx) => (idx === i ? e.target.value : item)))}
              placeholder={placeholder}
            />
            <button
              type="button"
              disabled={i === 0}
              onClick={() => move(i, i - 1)}
              className="p-1.5 rounded-lg border border-brand-border text-brand-muted hover:text-brand-text hover:border-brand-orange disabled:opacity-30 disabled:pointer-events-none transition-colors shrink-0"
              title="Posunúť hore"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={i === rules.length - 1}
              onClick={() => move(i, i + 1)}
              className="p-1.5 rounded-lg border border-brand-border text-brand-muted hover:text-brand-text hover:border-brand-orange disabled:opacity-30 disabled:pointer-events-none transition-colors shrink-0"
              title="Posunúť dole"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onChange(rules.filter((_, idx) => idx !== i))}
              className="text-brand-muted-light hover:text-red-400 transition-colors shrink-0"
              title="Zmazať pravidlo"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => onChange([...rules, ""])} className="btn-outline text-sm py-2 px-4 w-full justify-center">
        <Plus className="w-4 h-4" /> {addLabel}
      </button>
    </div>
  );
}
