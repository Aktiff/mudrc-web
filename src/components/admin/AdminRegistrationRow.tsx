"use client";

import { useState } from "react";
import { ArrowRightLeft, ChevronDown, Clock, CreditCard, ExternalLink, Mail, Phone, Trash2 } from "lucide-react";
import RegistrationPlayersStepper from "@/components/admin/RegistrationPlayersStepper";
import { isPayRegistration, type AdminRegistrationView } from "@/lib/pay-admin";
import { formatSeatStatusLabel } from "@/lib/pay-domain";

export type AdminRegistration = AdminRegistrationView;

type Props = {
  reg: AdminRegistration;
  minPlayers: number;
  maxPlayers: number;
  busy: boolean;
  deleting: boolean;
  moves?: { key: string; label: string; onMove: () => void }[];
  moving?: boolean;
  onAdjust: (delta: number) => void;
  onDelete: () => void;
};

function paySeatsLabel(reg: AdminRegistration): string {
  const parsed = Number.parseInt(String(reg.players), 10);
  const reserved = reg.reservedSeats ?? (Number.isFinite(parsed) ? parsed : 0);
  const paid = reg.paidSeats ?? 0;
  const pending = reg.pendingSeats ?? Math.max(0, reserved - paid);
  const seatWord = reserved === 1 ? "miesto" : reserved < 5 ? "miesta" : "miest";
  const parts = [`${reserved} ${seatWord}`, `${paid} zaplatené`];
  if (pending > 0) parts.push(`${pending} čaká`);
  return parts.join(" · ");
}

function teamDashboardHref(token: string): string {
  return `/pay/t/${encodeURIComponent(token)}`;
}

export default function AdminRegistrationRow({
  reg,
  minPlayers,
  maxPlayers,
  busy,
  deleting,
  moves = [],
  moving = false,
  onAdjust,
  onDelete,
}: Props) {
  const fromPay = isPayRegistration(reg);
  const [expanded, setExpanded] = useState(false);
  const seats = reg.paySeats ?? [];
  const canExpand = fromPay && (seats.length > 0 || Boolean(reg.payTeamToken));

  return (
    <div className="rounded-xl border border-brand-border p-4 flex flex-col gap-3 bg-brand-card">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-display text-xl text-brand-text">{reg.teamName}</div>
            {fromPay ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/40 border border-teal-500/30 px-2 py-0.5 rounded-lg">
                <CreditCard className="w-3 h-3" />
                Predplatné
              </span>
            ) : null}
          </div>
          {fromPay ? (
            <div className="rounded-xl border border-teal-500/30 bg-teal-50/60 dark:bg-teal-950/20 px-3 py-2 text-sm text-brand-text">
              {paySeatsLabel(reg)}
            </div>
          ) : (
            <RegistrationPlayersStepper
              players={reg.players}
              minPlayers={minPlayers}
              maxPlayers={maxPlayers}
              busy={busy}
              onAdjust={onAdjust}
            />
          )}
          <div className="flex flex-wrap items-center gap-4 text-sm text-brand-muted">
            <span className="flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5" />
              {reg.phone}
            </span>
            {fromPay && reg.captainEmail ? (
              <span className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" />
                {reg.captainEmail}
              </span>
            ) : null}
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {reg.createdAt}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          {canExpand ? (
            <button
              type="button"
              onClick={() => setExpanded((open) => !open)}
              className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl border border-teal-500/40 text-teal-800 dark:text-teal-200 hover:bg-teal-50 dark:hover:bg-teal-950/30 transition-colors"
              aria-expanded={expanded}
            >
              <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
              {expanded ? "Skryť detail" : "Detail tímu"}
            </button>
          ) : null}
          {!fromPay
            ? moves.map((move) => (
                <button
                  key={move.key}
                  type="button"
                  onClick={move.onMove}
                  disabled={moving || deleting}
                  className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl border border-brand-border text-brand-text hover:border-brand-orange transition-colors disabled:opacity-50"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                  {moving ? "Presúvam…" : move.label}
                </button>
              ))
            : null}
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting || moving}
            className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            {deleting ? "..." : "Zmazať"}
          </button>
        </div>
      </div>

      {expanded && canExpand ? (
        <div className="rounded-xl border border-teal-500/30 bg-teal-50/40 dark:bg-teal-950/20 px-3 py-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-brand-text">Miesta (ako u kapitána)</p>
            {reg.payTeamToken ? (
              <a
                href={teamDashboardHref(reg.payTeamToken)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-800 dark:text-teal-200 hover:underline"
              >
                Otvoriť dashboard tímu
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            ) : null}
          </div>
          {seats.length === 0 ? (
            <p className="text-sm text-brand-muted">Žiadne miesta v rezervácii.</p>
          ) : (
            <ul className="space-y-2">
              {seats.map((seat) => (
                <li
                  key={seat.id}
                  className="rounded-lg border border-brand-border/80 bg-brand-card px-3 py-2 flex items-center justify-between gap-3 text-sm"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-brand-text">
                      Miesto {seat.index}{" "}
                      <span className="text-brand-muted font-normal">· {seat.amountEur}&nbsp;€</span>
                    </div>
                    <div className="text-xs text-brand-muted mt-0.5 truncate">
                      {formatSeatStatusLabel(seat.status)}
                      {seat.status === "paid" && seat.payerName ? ` · ${seat.payerName}` : ""}
                      {seat.status === "paid" && seat.payerEmail ? ` · ${seat.payerEmail}` : ""}
                    </div>
                  </div>
                  {seat.status === "paid" ? (
                    <span className="text-xs font-semibold text-teal-700 dark:text-teal-300 shrink-0">Zaplatené</span>
                  ) : seat.status === "pending_payment" ? (
                    <span className="text-xs text-brand-muted shrink-0">Čaká</span>
                  ) : (
                    <span className="text-xs text-brand-muted shrink-0">Nedostupné</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
