"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown } from "lucide-react";
import Link from "next/link";
import { quizLibraryListRequestUrl, type LibraryQuizListItem } from "@/lib/quiz-library-client";
import { questionCountLabel } from "@/lib/quiz-library";
import { formatAveragePoints } from "@/lib/quiz-library-usage";
import { CANVAS_LIBRARY_QUIZ_ID } from "@/lib/quiz-result-library";
import type { QuizUsageExclude } from "@/lib/quiz-library-usage";

type QuizOption = LibraryQuizListItem;

function libraryOptionLabel(option: QuizOption, hasTeams: boolean): string {
  const usage = option.usageCount ? ` (${option.usageCount}× hraný)` : " (nepoužitý)";
  const average =
    typeof option.averagePoints === "number" ? ` · priemer ${formatAveragePoints(option.averagePoints)}` : "";
  const fitness = !hasTeams ? "" : option.isSafe ? " ✓ vhodný" : " ⚠ konflikt";
  return `${option.title} · ${questionCountLabel(option.filledCount ?? 0)}${usage}${average}${fitness}`;
}

type Props = {
  value: string;
  onChange: (id: string) => void;
  teamNames: string[];
  /** Pri úprave existujúceho večera — nepočítať tento záznam do „už hrali“. */
  excludeUsage?: QuizUsageExclude | null;
  /** Kratší text pri detaile výsledku */
  variant?: "default" | "editResult";
  invalid?: boolean;
};

export default function LibraryQuizPicker({
  value,
  onChange,
  teamNames,
  excludeUsage = null,
  variant = "default",
  invalid = false,
}: Props) {
  const [options, setOptions] = useState<QuizOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const activeTeams = useMemo(
    () => teamNames.map((name) => name.trim()).filter(Boolean),
    [teamNames]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(quizLibraryListRequestUrl(activeTeams, excludeUsage), {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setOptions([]);
        setLoadError((data as { error?: string }).error ?? "Nepodarilo sa načítať knižnicu kvízov.");
        return;
      }
      const data = await res.json();
      setOptions(
        (data.quizzes ?? []).map((quiz: QuizOption) => ({
          id: quiz.id,
          title: quiz.title,
          usageCount: quiz.usageCount ?? 0,
          isSafe: quiz.isSafe ?? true,
          conflictingTeams: quiz.conflictingTeams ?? [],
          averagePoints: typeof quiz.averagePoints === "number" ? quiz.averagePoints : null,
          filledCount: typeof quiz.filledCount === "number" ? quiz.filledCount : 0,
        }))
      );
    } catch {
      setOptions([]);
      setLoadError("Sieťová chyba pri načítaní knižnice.");
    } finally {
      setLoading(false);
    }
  }, [activeTeams, excludeUsage]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  const selected = options.find((option) => option.id === value);
  const hasTeams = activeTeams.length > 0;
  const usable = options.filter((option) => !hasTeams || option.isSafe);
  const blocked = hasTeams ? options.filter((option) => !option.isSafe) : [];

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const closedLabel = loading
    ? "Načítavam kvízy…"
    : value === CANVAS_LIBRARY_QUIZ_ID
      ? "Kvíz v Canve (bez knižnice)"
      : selected
        ? libraryOptionLabel(selected, hasTeams)
        : "— Vyber —";

  const pick = (id: string) => {
    onChange(id);
    setOpen(false);
  };

  const renderOption = (option: QuizOption, canUse: boolean) => (
    <button
      key={option.id}
      type="button"
      role="option"
      aria-selected={value === option.id}
      onClick={() => pick(option.id)}
      className={`block w-full text-left px-3 py-2 text-sm ${
        canUse
          ? "bg-green-700 text-green-50 font-semibold hover:bg-green-600"
          : "text-brand-text hover:bg-brand-hover"
      } ${value === option.id ? "ring-1 ring-inset ring-brand-orange" : ""}`}
    >
      {libraryOptionLabel(option, hasTeams)}
    </button>
  );

  return (
    <div className="mb-6 bg-brand-warm border border-brand-border rounded-2xl p-5 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <label className="label mb-1">Hotový kvíz {variant === "editResult" ? "" : "(povinné)"}</label>
          <p className="text-brand-muted text-xs max-w-xl">
            {variant === "editResult" ? (
              <>Kvíz priradený k tomuto večeru. Ak si sa pomýlil, zvoľ iný a ulož priradenie.</>
            ) : (
              <>
                Po načítaní tímov vyber, ktorý kvíz im dáš. Bez výberu sa výsledok neuloží. „Kvíz v Canve“ zvoľ len
                vtedy, keď si ho naozaj robil mimo knižnice.
              </>
            )}
          </p>
        </div>
        <Link href="/admin/hotove-kvizy" className="text-xs font-semibold text-brand-orange-readable hover:underline">
          Spravovať knižnicu →
        </Link>
      </div>

      <div className="relative" ref={rootRef}>
        <button
          type="button"
          className={`input flex items-center justify-between gap-3 text-left ${invalid && !value ? "border-red-500" : ""}`}
          disabled={loading}
          aria-expanded={open}
          aria-haspopup="listbox"
          onClick={() => setOpen((current) => !current)}
        >
          <span className="truncate">{closedLabel}</span>
          <ChevronDown className={`w-4 h-4 shrink-0 text-brand-muted transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && !loading && (
          <div
            role="listbox"
            className="absolute z-30 mt-1 w-full max-h-[70vh] overflow-y-auto rounded-xl border border-brand-border bg-brand-card shadow-xl py-1"
          >
            <button
              type="button"
              role="option"
              className="block w-full text-left px-3 py-2 text-sm text-brand-muted hover:bg-brand-hover"
              onClick={() => pick("")}
            >
              — Vyber —
            </button>
            <button
              type="button"
              role="option"
              aria-selected={value === CANVAS_LIBRARY_QUIZ_ID}
              className="block w-full text-left px-3 py-2 text-sm text-brand-text hover:bg-brand-hover"
              onClick={() => pick(CANVAS_LIBRARY_QUIZ_ID)}
            >
              Kvíz v Canve (bez knižnice)
            </button>
            {hasTeams && usable.length > 0 && (
              <div className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-green-400">
                Môžu byť
              </div>
            )}
            {usable.map((option) => renderOption(option, hasTeams && option.isSafe))}
            {blocked.length > 0 && (
              <div className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-brand-muted">
                Konflikt
              </div>
            )}
            {blocked.map((option) => renderOption(option, false))}
          </div>
        )}
      </div>

      {variant !== "editResult" && selected && selected.id !== CANVAS_LIBRARY_QUIZ_ID && activeTeams.length > 0 && (
        <div
          className={`text-sm rounded-xl px-4 py-3 flex items-start gap-2 ${
            selected.isSafe
              ? "bg-green-50 text-green-700 border border-green-200 dark:bg-green-950/30 dark:text-green-300 dark:border-green-800"
              : "bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800"
          }`}
        >
          {selected.isSafe ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />}
          <span>
            {selected.isSafe
              ? "Tieto tímy na tomto kvíze ešte nehrali — môžeš ho použiť."
              : `Pozor: na tomto kvíze už hrali: ${selected.conflictingTeams.join(", ")}.`}
            {typeof selected.averagePoints === "number"
              ? ` Priemer tímov, ktoré ho už hrali: ${formatAveragePoints(selected.averagePoints)}.`
              : ""}
          </span>
        </div>
      )}

      {value === CANVAS_LIBRARY_QUIZ_ID && (
        <p className="text-sm rounded-xl px-4 py-3 bg-brand-surface border border-brand-border text-brand-muted">
          Výsledky sa uložia bez priradenia hotového kvízu — v knižnici nič neoznačíš ako použité.
        </p>
      )}

      {loadError ? (
        <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
      ) : null}

      {!loading && !loadError && options.length === 0 && (
        <p className="text-sm text-brand-muted">
          Knižnica je prázdna. Môžeš použiť „Kvíz v Canve“ alebo{" "}
          <Link href="/admin/hotove-kvizy" className="text-brand-orange-readable underline">
            vytvoriť hotový kvíz
          </Link>
          .
        </p>
      )}
    </div>
  );
}
