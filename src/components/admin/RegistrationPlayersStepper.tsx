"use client";

import { Minus, Plus, Users } from "lucide-react";
import { parsePlayerCount } from "@/lib/seat-plan";

type Props = {
  players: string;
  minPlayers?: number;
  maxPlayers?: number;
  busy?: boolean;
  onAdjust: (delta: number) => void;
};

export default function RegistrationPlayersStepper({
  players,
  minPlayers = 2,
  maxPlayers = 8,
  busy = false,
  onAdjust,
}: Props) {
  const min = Math.max(1, minPlayers);
  const max = Math.max(min, maxPlayers);
  const count = parsePlayerCount(players) || min;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-brand-muted flex items-center gap-1">
        <Users className="w-3.5 h-3.5" />
        Počet hráčov
      </span>
      <div
        className="inline-flex items-stretch rounded-xl border-2 border-brand-orange/50 bg-brand-card shadow-sm overflow-hidden"
        role="group"
        aria-label="Upraviť počet hráčov"
      >
        <button
          type="button"
          onClick={() => onAdjust(-1)}
          disabled={busy || count <= min}
          className="px-3 py-2 bg-brand-orange/10 hover:bg-brand-orange/20 text-brand-orange-readable font-bold disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
          title={`Odobrať hráča (min. ${min})`}
          aria-label="Odobrať hráča"
        >
          <Minus className="w-4 h-4" />
        </button>
        <div className="min-w-[5.5rem] px-3 py-2 flex flex-col items-center justify-center border-x border-brand-orange/30 bg-brand-surface">
          <span className="font-display text-xl text-brand-text tabular-nums leading-none">
            {busy ? "…" : count}
          </span>
          <span className="text-[10px] text-brand-muted font-medium mt-0.5">
            {count === 1 ? "hráč" : count >= 2 && count <= 4 ? "hráči" : "hráčov"}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onAdjust(1)}
          disabled={busy || count >= max}
          className="px-3 py-2 bg-brand-orange/10 hover:bg-brand-orange/20 text-brand-orange-readable font-bold disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
          title={`Pridať hráča (max. ${max})`}
          aria-label="Pridať hráča"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
      <span className="text-xs text-brand-muted">
        Rozsah {min}–{max} · uloží sa hneď
      </span>
    </div>
  );
}
