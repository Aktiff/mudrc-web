"use client";

import { useMemo, useState } from "react";
import type { PaySeat } from "@/lib/pay-domain";
import { formatSeatLabel } from "@/lib/pay-domain";

type Row = {
  teamId: string;
  teamName: string;
  seat: PaySeat;
};

type Props = {
  venue: string;
  whenLabel: string;
  rows: Row[];
  walkUpHref: string;
};

export default function PayCheckInClient({ venue, whenLabel, rows: initial, walkUpHref }: Props) {
  const [pin, setPin] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [rows, setRows] = useState(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const sorted = useMemo(
    () =>
      [...rows].sort((a, b) =>
        a.teamName.localeCompare(b.teamName, "sk") || a.seat.index - b.seat.index
      ),
    [rows]
  );

  async function toggle(row: Row) {
    setError("");
    setBusy(row.seat.id);
    try {
      const res = await fetch("/api/pay/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, teamId: row.teamId, seatId: row.seat.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Check-in zlyhal.");
        if (res.status === 401) setUnlocked(false);
        setBusy(null);
        return;
      }
      setUnlocked(true);
      setRows((prev) =>
        prev.map((r) =>
          r.seat.id === row.seat.id
            ? { ...r, seat: { ...r.seat, checkedInAt: data.checkedInAt ?? undefined } }
            : r
        )
      );
    } catch {
      setError("Sieťová chyba.");
    }
    setBusy(null);
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <p className="text-brand-muted text-sm">
          {venue} · {whenLabel}
        </p>
        <h1 className="font-display text-4xl text-brand-text uppercase tracking-wide mt-1">Check-in</h1>
        <p className="text-sm text-brand-muted mt-2">Len paid lístky. Moderátor bez hotovosti.</p>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <label className="block">
          <span className="text-sm font-medium">PIN</span>
          <input
            className="mt-1 block rounded-xl border border-brand-border bg-brand-card px-4 py-3"
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="PAY_CHECKIN_PIN"
          />
        </label>
        <a href={walkUpHref} className="btn-outline">
          Walk-up (+ príplatok)
        </a>
      </div>

      {error ? <p className="text-red-600 text-sm">{error}</p> : null}
      {unlocked ? <p className="text-xs text-brand-muted">PIN OK — môžeš checkovať.</p> : null}

      {sorted.length === 0 ? (
        <p className="text-brand-muted">Zatiaľ žiadne paid miesta na tento termín.</p>
      ) : (
        <ul className="space-y-2">
          {sorted.map((row) => {
            const inAt = row.seat.checkedInAt;
            return (
              <li
                key={row.seat.id}
                className="rounded-xl border border-brand-border bg-brand-card px-4 py-3 flex items-center justify-between gap-3"
              >
                <div>
                  <div className="font-semibold text-brand-text">
                    {row.teamName} · {formatSeatLabel(row.seat)}
                  </div>
                  <div className="text-xs text-brand-muted">
                    {row.seat.amountEur}&nbsp;€ · {row.seat.kind}
                    {row.seat.payerName ? ` · ${row.seat.payerName}` : ""}
                    {inAt ? " · checked-in" : ""}
                  </div>
                </div>
                <button
                  type="button"
                  className={inAt ? "btn-outline text-sm px-4 py-2" : "btn-primary text-sm px-4 py-2"}
                  disabled={!pin || busy === row.seat.id}
                  onClick={() => toggle(row)}
                >
                  {busy === row.seat.id ? "…" : inAt ? "Odcheckovať" : "Check-in"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
