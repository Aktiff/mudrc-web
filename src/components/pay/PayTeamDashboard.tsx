"use client";

import { useMemo, useState } from "react";
import type { PayTeam } from "@/lib/pay-domain";
import { formatSeatLabel, teamSummary } from "@/lib/pay-domain";

type Props = {
  team: PayTeam;
  whenLabel: string;
  /** e.g. "" on pay.mudrc.sk or "/pay" on main site */
  basePath: "" | "/pay";
  /** Absolute origin for copy-link, e.g. https://pay.mudrc.sk */
  origin: string;
};

function sharedPayPath(basePath: "" | "/pay", teamToken: string): string {
  return `${basePath}/s/${teamToken}`;
}

export default function PayTeamDashboard({ team, whenLabel, basePath, origin }: Props) {
  const summary = teamSummary(team);
  const [copied, setCopied] = useState(false);
  const shareUrl = `${origin}${sharedPayPath(basePath, team.token)}`;

  const statusLabel = useMemo(() => {
    switch (team.status) {
      case "open":
        return "Rezervované — čaká sa na platby";
      case "partial":
        return `Čiastočne zaplatené (${summary.paid}/${summary.total})`;
      case "full":
        return "Tím kompletný — všetky miesta paid";
      case "closed_at_start":
        return "Po štarte — neuhradené uvoľnené";
      case "cancelled":
        return "Zrušené";
      default:
        return team.status;
    }
  }, [team.status, summary.paid, summary.total]);

  async function copySharedLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <p className="text-brand-muted text-sm">
          {team.venue}
          {team.city ? `, ${team.city}` : ""} · {whenLabel}
        </p>
        <h1 className="font-display text-4xl md:text-5xl text-brand-text uppercase tracking-wide mt-1">
          {team.teamName}
        </h1>
        <p className="mt-3 text-brand-muted">{statusLabel}</p>
        <p className="text-sm text-brand-muted mt-1">
          Kapitán: {team.captainEmail} · {team.captainPhone}
        </p>
      </div>

      <div className="rounded-2xl border border-brand-border bg-brand-card p-4 grid grid-cols-3 gap-3 text-center">
        <div>
          <div className="font-display text-3xl text-brand-text">{summary.paid}</div>
          <div className="text-xs text-brand-muted">paid</div>
        </div>
        <div>
          <div className="font-display text-3xl text-brand-text">{summary.pending}</div>
          <div className="text-xs text-brand-muted">pending</div>
        </div>
        <div>
          <div className="font-display text-3xl text-brand-text">{summary.total}</div>
          <div className="text-xs text-brand-muted">miest</div>
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-brand-border bg-brand-surface px-4 py-4">
        <h2 className="font-display text-2xl uppercase tracking-wide text-brand-text">Pay-link tímu</h2>
        <p className="text-sm text-brand-muted">
          Jeden odkaz pre celý tím. Pošli ho kamarátom — každý zaplatí jedno miesto (
          {team.seats[0]?.amountEur ?? "—"}&nbsp;€). Hold platí do štartu kvízu.
        </p>
        {summary.pending > 0 ? (
          <>
            <p className="text-xs text-brand-muted break-all font-mono bg-brand-card rounded-xl px-3 py-2 border border-brand-border">
              {shareUrl}
            </p>
            <div className="flex flex-wrap gap-2">
              <a href={sharedPayPath(basePath, team.token)} className="btn-primary text-sm px-4 py-2">
                Otvoriť platbu
              </a>
              <button type="button" className="btn-outline text-sm px-4 py-2" onClick={copySharedLink}>
                {copied ? "Skopírované" : "Kopírovať link"}
              </button>
            </div>
          </>
        ) : team.status === "full" ? (
          <p className="text-sm font-semibold text-brand-orange-readable">Všetky miesta sú zaplatené.</p>
        ) : (
          <p className="text-sm text-brand-muted">Online platba už nie je dostupná (po štarte / uvoľnené).</p>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="font-display text-2xl uppercase tracking-wide text-brand-text">Miesta</h2>
        <ul className="space-y-2">
          {team.seats
            .filter((s) => s.kind === "prepaid")
            .map((seat) => (
              <li
                key={seat.id}
                className="rounded-xl border border-brand-border bg-brand-card px-4 py-3 flex items-center justify-between gap-3"
              >
                <div>
                  <div className="font-semibold text-brand-text">
                    {formatSeatLabel(seat)}{" "}
                    <span className="text-brand-muted font-normal">· {seat.amountEur}&nbsp;€</span>
                  </div>
                  <div className="text-xs text-brand-muted mt-0.5">
                    {seat.status === "paid"
                      ? `paid${seat.payerName ? ` · ${seat.payerName}` : ""}`
                      : seat.status === "void"
                        ? "uvoľnené po štarte"
                        : "pending_payment"}
                  </div>
                </div>
                {seat.status === "paid" ? (
                  <span className="text-sm font-semibold text-brand-orange-readable">Potvrdené</span>
                ) : seat.status === "pending_payment" ? (
                  <span className="text-sm text-brand-muted">Čaká</span>
                ) : (
                  <span className="text-sm text-brand-muted">Nedostupné</span>
                )}
              </li>
            ))}
        </ul>
      </div>
    </div>
  );
}
