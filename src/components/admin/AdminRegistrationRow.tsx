"use client";

import { Clock, Phone, Trash2 } from "lucide-react";
import RegistrationPlayersStepper from "@/components/admin/RegistrationPlayersStepper";

export type AdminRegistration = {
  id: string;
  eventSlug: string;
  venue: string;
  teamName: string;
  players: string;
  phone: string;
  createdAt: string;
};

type Props = {
  reg: AdminRegistration;
  minPlayers: number;
  maxPlayers: number;
  busy: boolean;
  deleting: boolean;
  onAdjust: (delta: number) => void;
  onDelete: () => void;
};

export default function AdminRegistrationRow({
  reg,
  minPlayers,
  maxPlayers,
  busy,
  deleting,
  onAdjust,
  onDelete,
}: Props) {
  return (
    <div className="rounded-xl border border-brand-border p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4 bg-brand-card">
      <div className="min-w-0 flex-1 space-y-3">
        <div className="font-display text-xl text-brand-text">{reg.teamName}</div>
        <RegistrationPlayersStepper
          players={reg.players}
          minPlayers={minPlayers}
          maxPlayers={maxPlayers}
          busy={busy}
          onAdjust={onAdjust}
        />
        <div className="flex flex-wrap items-center gap-4 text-sm text-brand-muted">
          <span className="flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5" />
            {reg.phone}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            {reg.createdAt}
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={onDelete}
        disabled={deleting}
        className="shrink-0 flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors disabled:opacity-50"
      >
        <Trash2 className="w-4 h-4" />
        {deleting ? "..." : "Zmazať"}
      </button>
    </div>
  );
}
