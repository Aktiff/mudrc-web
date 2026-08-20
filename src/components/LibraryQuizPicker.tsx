"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import Link from "next/link";

type QuizOption = {
  id: string;
  title: string;
  usageCount: number;
  isSafe: boolean;
  conflictingTeams: string[];
};

type Props = {
  value: string;
  onChange: (id: string) => void;
  teamNames: string[];
};

export default function LibraryQuizPicker({ value, onChange, teamNames }: Props) {
  const [options, setOptions] = useState<QuizOption[]>([]);
  const [loading, setLoading] = useState(true);

  const activeTeams = useMemo(
    () => teamNames.map((name) => name.trim()).filter(Boolean),
    [teamNames]
  );

  const load = useCallback(async () => {
    setLoading(true);
    const qs = activeTeams.length ? `?teams=${encodeURIComponent(activeTeams.join("\n"))}` : "";
    const res = await fetch(`/api/admin/quiz-library${qs}&_=${Date.now()}`.replace("?&", "?"), { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setOptions(
        (data.quizzes ?? []).map((quiz: QuizOption & { slides?: unknown[] }) => ({
          id: quiz.id,
          title: quiz.title,
          usageCount: quiz.usageCount,
          isSafe: quiz.isSafe,
          conflictingTeams: quiz.conflictingTeams,
        }))
      );
    }
    setLoading(false);
  }, [activeTeams]);

  useEffect(() => {
    load();
  }, [load]);

  const selected = options.find((option) => option.id === value);

  return (
    <div className="mb-6 bg-brand-warm border border-brand-border rounded-2xl p-5 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <label className="label mb-1">Hotový kvíz (otázky na večer)</label>
          <p className="text-brand-muted text-xs max-w-xl">
            Vyber ktorý kvíz z knižnice si použil. Po uložení sa priradí k tomuto podniku a dátumu — uvidíš ho v{" "}
            <Link href="/admin/hotove-kvizy" className="text-brand-orange-readable underline">
              Hotových kvízoch
            </Link>
            .
          </p>
        </div>
        <Link href="/admin/hotove-kvizy" className="text-xs font-semibold text-brand-orange-readable hover:underline">
          Spravovať knižnicu →
        </Link>
      </div>

      <select
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={loading}
      >
        <option value="">{loading ? "Načítavam kvízy…" : "— Vyber hotový kvíz —"}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.title}
            {option.usageCount ? ` (${option.usageCount}× hraný)` : " (nepoužitý)"}
            {activeTeams.length && !option.isSafe ? " ⚠ konflikt" : activeTeams.length && option.isSafe ? " ✓ vhodný" : ""}
          </option>
        ))}
      </select>

      {selected && activeTeams.length > 0 && (
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
          </span>
        </div>
      )}

      {!loading && options.length === 0 && (
        <p className="text-sm text-brand-muted">
          Knižnica je prázdna.{" "}
          <Link href="/admin/hotove-kvizy" className="text-brand-orange-readable underline">
            Vytvor hotový kvíz
          </Link>
          .
        </p>
      )}
    </div>
  );
}
