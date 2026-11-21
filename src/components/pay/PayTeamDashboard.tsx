"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { PayTeam } from "@/lib/pay-domain";
import { formatSeatLabel, formatSeatStatusLabel, teamSummary } from "@/lib/pay-domain";

type Props = {
  team: PayTeam;
  whenLabel: string;
  /** e.g. "" on pay.mudrc.sk or "/pay" on main site */
  basePath: "" | "/pay";
  /** Absolute origin for copy-link, e.g. https://pay.mudrc.sk */
  origin: string;
  /** Quiz rule: max team size */
  maxPlayers: number;
  /** Current online unit price (payment-time tier), if online still open */
  currentUnitPrice?: number;
  earlyFee?: number;
  lateFee?: number;
  walkUpFee?: number;
  onlinePayOpen?: boolean;
};

function sharedPayPath(basePath: "" | "/pay", teamToken: string): string {
  return `${basePath}/s/${teamToken}`;
}

export default function PayTeamDashboard({
  team,
  whenLabel,
  basePath,
  origin,
  maxPlayers,
  currentUnitPrice,
  earlyFee,
  lateFee,
  walkUpFee,
  onlinePayOpen = true,
}: Props) {
  const router = useRouter();
  const summary = teamSummary(team);
  const currentSeats = team.seats.filter(
    (s) => s.kind === "prepaid" && (s.status === "pending_payment" || s.status === "paid")
  ).length;
  const canAddSeat =
    onlinePayOpen &&
    team.status !== "cancelled" &&
    team.status !== "closed_at_start" &&
    currentSeats < maxPlayers;
  const [copied, setCopied] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const shareUrl = `${origin}${sharedPayPath(basePath, team.token)}`;
  const unitPrice =
    currentUnitPrice ?? team.seats.find((s) => s.kind === "prepaid" && s.status === "pending_payment")?.amountEur;

  const statusLabel = useMemo(() => {
    switch (team.status) {
      case "open":
        return "Rezervované — čaká sa na platby";
      case "partial":
        return `Čiastočne zaplatené (${summary.paid}/${summary.total})`;
      case "full":
        return "Tím kompletný — všetky miesta zaplatené";
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

  async function addSeat() {
    setAddError("");
    setAdding(true);
    try {
      const res = await fetch("/api/pay/add-seat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamToken: team.token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAddError(typeof data.error === "string" ? data.error : "Miesto sa nepodarilo pridať.");
        setAdding(false);
        return;
      }
      router.refresh();
    } catch {
      setAddError("Sieťová chyba.");
    }
    setAdding(false);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="text-center sm:text-left">
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
          <div className="text-xs text-brand-muted">zaplatené</div>
        </div>
        <div>
          <div className="font-display text-3xl text-brand-text">{summary.pending}</div>
          <div className="text-xs text-brand-muted">čaká na zaplatenie</div>
        </div>
        <div>
          <div className="font-display text-3xl text-brand-text">{summary.total}</div>
          <div className="text-xs text-brand-muted">
            miest
            <span className="block text-[10px] mt-0.5">max {maxPlayers}</span>
          </div>
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-brand-border bg-brand-surface px-4 py-4">
        <h2 className="font-display text-2xl uppercase tracking-wide text-brand-text">Pay-link tímu</h2>
        <p className="text-sm text-brand-muted">
          Jeden odkaz pre celý tím. Pošli ho kamarátom — každý môže zaplatiť jedno alebo viac miest naraz
          {unitPrice != null && onlinePayOpen ? ` (teraz ${unitPrice}\u00a0€ / miesto)` : ""}.
          {earlyFee != null && lateFee != null && walkUpFee != null
            ? ` Cenník ${earlyFee}/${lateFee}/${walkUpFee} €. Soft-hold neuhradených miest platí, kým je online okno otvorené.`
            : " Soft-hold neuhradených miest platí, kým je online okno otvorené."}
        </p>
        {summary.pending > 0 && onlinePayOpen ? (
          <>
            <p className="text-xs text-brand-muted break-all font-mono bg-brand-card rounded-xl px-3 py-2 border border-brand-border">
              {shareUrl}
            </p>
            <div className="flex flex-wrap gap-2">
              <a href={shareUrl} className="btn-primary text-sm px-4 py-2">
                Otvoriť platbu
              </a>
              <button type="button" className="btn-outline text-sm px-4 py-2" onClick={copySharedLink}>
                {copied ? "Skopírované" : "Kopírovať link"}
              </button>
            </div>
            {summary.pending > 1 ? (
              <p className="text-xs text-brand-muted">
                Na platobnej stránke vieš zvoliť počet miest (1–{summary.pending}), napr. polovicu alebo celý
                zvyšok tímu.
              </p>
            ) : null}
          </>
        ) : team.status === "full" ? (
          <p className="text-sm font-semibold text-brand-orange-readable">Všetky miesta sú zaplatené.</p>
        ) : !onlinePayOpen ? (
          <p className="text-sm text-brand-muted">
            Online platba uzamknutá
            {walkUpFee != null ? ` — walk-up na mieste za ${walkUpFee}\u00a0€` : ""}.
          </p>
        ) : (
          <p className="text-sm text-brand-muted">Online platba už nie je dostupná (po štarte / uvoľnené).</p>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl uppercase tracking-wide text-brand-text">Miesta</h2>
          {canAddSeat ? (
            <button
              type="button"
              className="btn-outline text-sm px-4 py-2"
              onClick={addSeat}
              disabled={adding}
            >
              {adding ? "Pridávam…" : `Pridať člena (+1 · max ${maxPlayers})`}
            </button>
          ) : currentSeats >= maxPlayers && team.status !== "closed_at_start" && team.status !== "cancelled" ? (
            <span className="text-xs text-brand-muted">Dosiahnutý max tímu ({maxPlayers})</span>
          ) : null}
        </div>
        {addError ? <p className="text-red-600 text-sm">{addError}</p> : null}
        <p className="text-xs text-brand-muted">
          Ak ste zaregistrovali menej miest, môžete doplniť ďalšie až do maxima kvízu ({maxPlayers} hráčov).
        </p>
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
                    {formatSeatStatusLabel(seat.status)}
                    {seat.status === "paid" && seat.payerName ? ` · ${seat.payerName}` : ""}
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
