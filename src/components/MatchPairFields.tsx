"use client";

import { ChevronDown, ChevronUp, Plus, X } from "lucide-react";
import { MATCH_LEFT_MAX, MATCH_RIGHT_MAX, matchLetter } from "@/lib/quiz-question-options";

type MatchPairFieldsProps = {
  left: string[];
  right: string[];
  assign: number[];
  onChange: (left: string[], right: string[], assign: number[]) => void;
};

export default function MatchPairFields({ left, right, assign, onChange }: MatchPairFieldsProps) {
  const updateLeft = (index: number, value: string) => {
    const next = [...left];
    next[index] = value;
    onChange(next, right, assign);
  };

  const updateRight = (index: number, value: string) => {
    const next = [...right];
    next[index] = value;
    onChange(left, next, assign);
  };

  const setAssign = (index: number, letterIndex: number) => {
    const next = [...assign];
    next[index] = letterIndex;
    onChange(left, right, next);
  };

  const moveLeft = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= left.length) return;
    const nextLeft = [...left];
    const nextAssign = [...assign];
    const item = nextLeft[index] ?? "";
    nextLeft[index] = nextLeft[target] ?? "";
    nextLeft[target] = item;
    const letter = nextAssign[index] ?? 0;
    nextAssign[index] = nextAssign[target] ?? 0;
    nextAssign[target] = letter;
    onChange(nextLeft, right, nextAssign);
  };

  const moveRight = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= right.length) return;
    const nextRight = [...right];
    const item = nextRight[index] ?? "";
    nextRight[index] = nextRight[target] ?? "";
    nextRight[target] = item;
    const nextAssign = assign.map((value) => {
      if (value === index) return target;
      if (value === target) return index;
      return value;
    });
    onChange(left, nextRight, nextAssign);
  };

  const removeLeft = (index: number) => {
    if (left.length <= 2) return;
    onChange(
      left.filter((_, itemIndex) => itemIndex !== index),
      right,
      assign.filter((_, itemIndex) => itemIndex !== index)
    );
  };

  const removeRight = (index: number) => {
    if (right.length <= 2) return;
    onChange(
      left,
      right.filter((_, itemIndex) => itemIndex !== index),
      assign.map((value) => {
        if (value === index) return 0;
        if (value > index) return value - 1;
        return value;
      })
    );
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-brand-muted">
        Ľavá a pravá strana majú vlastný počet. Ku každej položke vľavo vyber možnosť vpravo, napríklad štyroch politikov k dvom stranám.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-muted">Ľavá strana</p>
          {left.map((item, index) => (
            <div key={`left-${index}`} className="flex items-center gap-2">
              <span className="w-6 shrink-0 text-sm font-mono font-semibold text-brand-muted">{index + 1}.</span>
              <input
                value={item}
                onChange={(event) => updateLeft(index, event.target.value)}
                placeholder="Položka"
                className="input text-sm py-2 min-w-0 flex-1"
              />
              <select
                value={String(Math.min(assign[index] ?? 0, Math.max(0, right.length - 1)))}
                onChange={(event) => setAssign(index, Number(event.target.value))}
                className="input text-sm py-2 w-36 shrink-0"
                title="Pravá strana"
              >
                {right.map((target, targetIndex) => (
                  <option key={targetIndex} value={targetIndex}>
                    {matchLetter(targetIndex)}
                    {target.trim() ? ` ${target.trim()}` : ""}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => moveLeft(index, -1)}
                disabled={index === 0}
                className="rounded-lg border border-brand-border p-2 text-brand-muted disabled:opacity-30"
                title="Vyššie"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => moveLeft(index, 1)}
                disabled={index === left.length - 1}
                className="rounded-lg border border-brand-border p-2 text-brand-muted disabled:opacity-30"
                title="Nižšie"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
              {left.length > 2 ? (
                <button
                  type="button"
                  onClick={() => removeLeft(index)}
                  className="rounded-lg border border-brand-border p-2 text-brand-muted"
                  title="Odstrániť"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          ))}
          {left.length < MATCH_LEFT_MAX ? (
            <button
              type="button"
              onClick={() => onChange([...left, ""], right, [...assign, 0])}
              className="inline-flex items-center gap-1 rounded-lg border border-brand-border px-3 py-1.5 text-xs text-brand-muted hover:border-brand-orange"
            >
              <Plus className="h-3.5 w-3.5" />
              Pridať položku
            </button>
          ) : null}
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-muted">Pravá strana</p>
          {right.map((item, index) => (
            <div key={`right-${index}`} className="flex items-center gap-2">
              <span className="w-6 shrink-0 text-sm font-mono font-semibold text-brand-muted">{matchLetter(index)}</span>
              <input
                value={item}
                onChange={(event) => updateRight(index, event.target.value)}
                placeholder="Možnosť"
                className="input text-sm py-2 min-w-0 flex-1"
              />
              <button
                type="button"
                onClick={() => moveRight(index, -1)}
                disabled={index === 0}
                className="rounded-lg border border-brand-border p-2 text-brand-muted disabled:opacity-30"
                title="Vyššie"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => moveRight(index, 1)}
                disabled={index === right.length - 1}
                className="rounded-lg border border-brand-border p-2 text-brand-muted disabled:opacity-30"
                title="Nižšie"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
              {right.length > 2 ? (
                <button
                  type="button"
                  onClick={() => removeRight(index)}
                  className="rounded-lg border border-brand-border p-2 text-brand-muted"
                  title="Odstrániť"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          ))}
          {right.length < MATCH_RIGHT_MAX ? (
            <button
              type="button"
              onClick={() => onChange(left, [...right, ""], assign)}
              className="inline-flex items-center gap-1 rounded-lg border border-brand-border px-3 py-1.5 text-xs text-brand-muted hover:border-brand-orange"
            >
              <Plus className="h-3.5 w-3.5" />
              Pridať možnosť
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
