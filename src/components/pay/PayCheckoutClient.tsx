"use client";

import { useState } from "react";
import Link from "next/link";

type Props = {
  /** Shared team pay link — claims next unpaid seat */
  teamToken?: string;
  /** Legacy per-seat token */
  seatToken?: string;
  amountEur: number;
  seatLabel: string;
  teamName: string;
  venue: string;
  whenLabel: string;
  teamHref: string;
  homeHref: string;
  remainingPending?: number;
  totalSeats?: number;
  alreadyPaid?: boolean;
  blockedMessage?: string;
};

export default function PayCheckoutClient({
  teamToken,
  seatToken,
  amountEur,
  seatLabel,
  teamName,
  venue,
  whenLabel,
  teamHref,
  homeHref,
  remainingPending,
  totalSeats,
  alreadyPaid,
  blockedMessage,
}: Props) {
  const [payerName, setPayerName] = useState("");
  const [payerEmail, setPayerEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [paid, setPaid] = useState(!!alreadyPaid);
  const [paidSeatLabel, setPaidSeatLabel] = useState(seatLabel);
  const [leftAfterPay, setLeftAfterPay] = useState<number | undefined>(undefined);

  async function payMock() {
    setError("");
    setLoading(true);
    try {
      const body = teamToken
        ? { teamToken, payerName, payerEmail }
        : { seatToken, payerName, payerEmail };
      const res = await fetch("/api/pay/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Platba zlyhala.");
        setLoading(false);
        return;
      }
      if (data.seat?.index) {
        setPaidSeatLabel(`Miesto ${data.seat.index}`);
      }
      if (typeof data.remainingPending === "number") {
        setLeftAfterPay(data.remainingPending);
      }
      setPaid(true);
    } catch {
      setError("Sieťová chyba.");
    }
    setLoading(false);
  }

  if (blockedMessage) {
    return (
      <div className="max-w-md space-y-4">
        <h1 className="font-display text-4xl text-brand-text uppercase tracking-wide">Platba nedostupná</h1>
        <p className="text-brand-muted">{blockedMessage}</p>
        <Link href={homeHref} className="btn-outline">
          Späť na zoznam
        </Link>
      </div>
    );
  }

  if (paid) {
    return (
      <div className="max-w-md space-y-4 text-center py-6">
        <p className="text-5xl" aria-hidden>
          ✓
        </p>
        <h1 className="font-display text-4xl text-brand-text uppercase tracking-wide">Zaplatené</h1>
        <p className="text-brand-muted">
          {paidSeatLabel} · {teamName} · {amountEur}&nbsp;€ (mock)
        </p>
        <p className="text-sm text-brand-muted">Rezervácia je potvrdená. Ukáž toto pri check-ine.</p>
        {typeof leftAfterPay === "number" && leftAfterPay > 0 ? (
          <p className="text-sm text-brand-muted">
            V tíme ešte ostáva {leftAfterPay}{" "}
            {leftAfterPay === 1 ? "miesto" : leftAfterPay < 5 ? "miesta" : "miest"} — rovnaký link môžu použiť
            kamaráti.
          </p>
        ) : null}
        <div className="flex flex-wrap gap-3 justify-center">
          {typeof leftAfterPay === "number" && leftAfterPay > 0 && teamToken ? (
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setPaid(false);
                setLeftAfterPay(undefined);
                setPayerName("");
                setPayerEmail("");
              }}
            >
              Zaplatiť ďalšie miesto
            </button>
          ) : null}
          <Link href={teamHref} className="btn-primary">
            Stav tímu
          </Link>
          <Link href={homeHref} className="btn-outline">
            Domov
          </Link>
        </div>
      </div>
    );
  }

  const remainingLabel =
    typeof remainingPending === "number" && typeof totalSeats === "number"
      ? `Ostáva ${remainingPending} z ${totalSeats} miest`
      : seatLabel;

  return (
    <div className="max-w-md space-y-5">
      <div>
        <p className="text-brand-muted text-sm">
          {venue} · {whenLabel}
        </p>
        <h1 className="font-display text-4xl text-brand-text uppercase tracking-wide mt-1">Platba kartou</h1>
        <p className="text-brand-muted mt-2">
          {teamName} · {remainingLabel}
        </p>
        <p className="font-display text-5xl text-brand-orange-readable mt-4">{amountEur} €</p>
        <p className="text-xs text-brand-muted mt-2">
          {teamToken
            ? "Zaplatíš jedno miesto. Rovnaký odkaz môžu použiť aj ostatní, kým sú voľné miesta."
            : null}{" "}
          Testovací checkout — kliknutím sa platba okamžite označí ako úspešná. Žiadna skutočná karta.
        </p>
      </div>

      <label className="block">
        <span className="text-sm font-medium">Meno (voliteľné)</span>
        <input
          className="mt-1 w-full rounded-xl border border-brand-border bg-brand-card px-4 py-3"
          value={payerName}
          onChange={(e) => setPayerName(e.target.value)}
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium">E-mail na doklad (voliteľné)</span>
        <input
          className="mt-1 w-full rounded-xl border border-brand-border bg-brand-card px-4 py-3"
          type="email"
          value={payerEmail}
          onChange={(e) => setPayerEmail(e.target.value)}
        />
      </label>

      {error ? <p className="text-red-600 text-sm">{error}</p> : null}

      <button type="button" className="btn-primary w-full justify-center" onClick={payMock} disabled={loading}>
        {loading ? "Spracovávam…" : `Zaplatiť kartou ${amountEur} € (mock)`}
      </button>
    </div>
  );
}
