"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Eye, EyeOff, GripVertical, Plus, Trash2 } from "lucide-react";
import type { QuizRule } from "@/lib/quiz-rules";

function moveToIndex(items: QuizRule[], from: number, to: number): QuizRule[] {
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
  rules: QuizRule[];
  onChange: (rules: QuizRule[]) => void;
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
            className={`flex items-center gap-2 rounded-xl ${dragIndex === i ? "opacity-60" : ""} ${rule.hidden ? "opacity-60" : ""}`}
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
              className={`input text-sm py-2 flex-1 ${rule.hidden ? "line-through text-brand-muted" : ""}`}
              value={rule.text}
              onChange={(e) =>
                onChange(rules.map((item, idx) => (idx === i ? { ...item, text: e.target.value } : item)))
              }
              placeholder={placeholder}
            />
            <button
              type="button"
              onClick={() =>
                onChange(rules.map((item, idx) => (idx === i ? { ...item, hidden: !item.hidden } : item)))
              }
              className={`p-1.5 rounded-lg border shrink-0 transition-colors ${
                rule.hidden
                  ? "border-brand-orange text-brand-orange-readable bg-brand-tint"
                  : "border-brand-border text-brand-muted hover:text-brand-text hover:border-brand-orange"
              }`}
              title={rule.hidden ? "Znova zobraziť pravidlo" : "Dočasne skryť pravidlo"}
            >
              {rule.hidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
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
      <button type="button" onClick={() => onChange([...rules, { text: "" }])} className="btn-outline text-sm py-2 px-4 w-full justify-center">
        <Plus className="w-4 h-4" /> {addLabel}
      </button>
    </div>
  );
}
