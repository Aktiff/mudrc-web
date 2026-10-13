"use client";

import { useState } from "react";
import { addBankThemeAsync } from "@/lib/bank-themes-client";
import { normalizeBankThemeName } from "@/lib/bank-themes";

type SharedProps = {
  themes: string[];
  onThemesChange?: (themes: string[]) => void;
};

function useAddTheme(onThemesChange?: (themes: string[]) => void, onAdded?: (theme: string) => void) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const add = async () => {
    const theme = normalizeBankThemeName(draft);
    if (!theme) return;
    setBusy(true);
    try {
      const themes = await addBankThemeAsync(theme);
      onThemesChange?.(themes);
      onAdded?.(theme);
      setDraft("");
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Tému sa nepodarilo pridať.");
    } finally {
      setBusy(false);
    }
  };

  return { draft, setDraft, busy, add };
}

function AddThemeRow({
  draft,
  setDraft,
  busy,
  add,
}: {
  draft: string;
  setDraft: (value: string) => void;
  busy: boolean;
  add: () => void;
}) {
  return (
    <div className="flex gap-2">
      <input
        className="input text-xs py-1.5 flex-1 min-w-0"
        value={draft}
        placeholder="Nová téma"
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            add();
          }
        }}
      />
      <button type="button" className="btn-outline text-xs py-1.5 px-2 shrink-0" disabled={busy || !draft.trim()} onClick={add}>
        {busy ? "Pridávam…" : "Pridať tému"}
      </button>
    </div>
  );
}

export function BankThemeFilters({
  themes,
  value,
  counts,
  onChange,
  onThemesChange,
}: SharedProps & {
  value: string;
  counts?: Record<string, number>;
  onChange: (theme: string) => void;
}) {
  const adder = useAddTheme(onThemesChange, onChange);
  const options = themes.includes(value) ? themes : [value, ...themes];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {options.map((theme) => {
          const count = counts?.[theme];
          return (
            <button
              key={theme}
              type="button"
              onClick={() => onChange(theme)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                value === theme
                  ? "bg-brand-orange text-brand-btn-fg border-brand-orange"
                  : "border-brand-border text-brand-muted hover:border-brand-orange"
              }`}
            >
              {theme}
              {typeof count === "number" ? ` (${count})` : ""}
            </button>
          );
        })}
      </div>
      <AddThemeRow {...adder} />
    </div>
  );
}

export function BankThemeSelect({
  themes,
  value,
  onChange,
  onThemesChange,
}: SharedProps & {
  value: string;
  onChange: (theme: string) => void;
}) {
  const adder = useAddTheme(onThemesChange, onChange);
  const options = themes.includes(value) ? themes : value ? [value, ...themes] : themes;

  return (
    <div className="space-y-2">
      <label className="label">Téma</label>
      <select className="input text-sm py-2" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((theme) => (
          <option key={theme} value={theme}>
            {theme}
          </option>
        ))}
      </select>
      <AddThemeRow {...adder} />
    </div>
  );
}
