"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Props = {
  /** Shared team pay link — claims next unpaid seat(s) */
  teamToken?: string;
  /** Legacy per-seat token */
  seatToken?: string;
  /** Price per seat */
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

function seatsNoun(count: number): string {
  if (count === 1) return "miesto";
  if (count < 5) return "miesta";
  return "miest";
}

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
  const maxQuantity = teamToken
    ? Math.max(1, typeof remainingPending === "number" ? remainingPending : 1)
    : 1;
  const [quantity, setQuantity] = useState(1);
  const [payerName, setPayerName] = useState("");
  const [payerEmail, setPayerEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [paid, setPaid] = useState(!!alreadyPaid);
  const [paidSeatLabel, setPaidSeatLabel] = useState(seatLabel);
  const [paidTotalEur, setPaidTotalEur] = useState(amountEur);
  const [paidQuantity, setPaidQuantity] = useState(1);
  const [leftAfterPay, setLeftAfterPay] = useState<number | undefined>(undefined);
  const [emailNote, setEmailNote] = useState("");

  const safeQuantity = Math.min(Math.max(1, quantity), maxQuantity);
  const totalEur = useMemo(
    () => Math.round(amountEur * safeQuantity * 100) / 100,
    [amountEur, safeQuantity]
  );

  async function payMock() {
    setError("");
    setEmailNote("");
    setLoading(true);
    try {
      const body = teamToken
        ? { teamToken, payerName, payerEmail, quantity: safeQuantity }
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
      const qty = typeof data.quantity === "number" ? data.quantity : safeQuantity;
      setPaidQuantity(qty);
      if (Array.isArray(data.seats) && data.seats.length > 1) {
        const indexes = data.seats
          .map((s: { index?: number }) => s.index)
          .filter((n: unknown): n is number => typeof n === "number");
        setPaidSeatLabel(
          indexes.length > 0
            ? `${qty} ${seatsNoun(qty)} (${indexes.map((i: number) => `Miesto ${i}`).join(", ")})`
            : `${qty} ${seatsNoun(qty)}`
        );
      } else if (data.seat?.index) {
        setPaidSeatLabel(`Miesto ${data.seat.index}`);
      } else if (qty > 1) {
        setPaidSeatLabel(`${qty} ${seatsNoun(qty)}`);
      }
      if (typeof data.totalEur === "number") {
        setPaidTotalEur(data.totalEur);
      } else {
        setPaidTotalEur(Math.round(amountEur * qty * 100) / 100);
      }
      if (typeof data.remainingPending === "number") {
        setLeftAfterPay(data.remainingPending);
      }
      const sentTo =
        (typeof data.emailTo === "string" && data.emailTo.trim()) || payerEmail.trim();
      if (data.emailSent && sentTo) {
        setEmailNote(`Potvrdenie platby sme poslali tebe na ${sentTo}.`);
      } else if (sentTo && data.emailWarning) {
        setEmailNote(
          `Platba prebehla, ale potvrdenie na ${sentTo} sa nepodarilo odoslať: ${String(data.emailWarning)}`
        );
      } else if (!sentTo) {
        setEmailNote("Bez e-mailu neposielame potvrdenie — nabudúce ho vyplň pri platbe.");
      }
      setPaid(true);
    } catch {
      setError("Sieťová chyba.");
    }
    setLoading(false);
  }

  if (blockedMessage) {
    return (
      <div className="mx-auto max-w-md space-y-4 text-center">
        <h1 className="font-display text-4xl text-brand-text uppercase tracking-wide">Platba nedostupná</h1>
        <p className="text-brand-muted">{blockedMessage}</p>
        <Link href={homeHref} className="btn-outline inline-flex">
          Späť na zoznam
        </Link>
      </div>
    );
  }

  if (paid) {
    return (
      <div className="mx-auto max-w-md space-y-4 text-center py-6">
        <p className="text-5xl" aria-hidden>
          ✓
        </p>
        <h1 className="font-display text-4xl text-brand-text uppercase tracking-wide">Zaplatené</h1>
        <p className="text-brand-muted">
          {paidSeatLabel} · {teamName} · {paidTotalEur}&nbsp;€ (mock)
        </p>
        <p className="text-sm text-brand-muted">
          {paidQuantity > 1
            ? "Rezervácie sú potvrdené. Ukáž toto pri check-ine."
            : "Rezervácia je potvrdená. Ukáž toto pri check-ine."}
        </p>
        {emailNote ? (
          <p className="text-sm text-brand-text bg-brand-card border border-brand-border rounded-xl px-3 py-2">
            {emailNote}
          </p>
        ) : null}
        {typeof leftAfterPay === "number" && leftAfterPay > 0 ? (
          <p className="text-sm text-brand-muted">
            V tíme ešte ostáva {leftAfterPay} {seatsNoun(leftAfterPay)} — rovnaký link môžu použiť
            kamaráti, alebo zaplať viac naraz.
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
                setQuantity(1);
                setPayerName("");
                setPayerEmail("");
                setEmailNote("");
              }}
            >
              Zaplatiť ďalšie miesta
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

  const halfRemaining = Math.max(1, Math.floor(maxQuantity / 2));

  return (
    <div className="mx-auto max-w-md space-y-5">
      <div className="text-center sm:text-left">
        <p className="text-brand-muted text-sm">
          {venue} · {whenLabel}
        </p>
        <h1 className="font-display text-4xl text-brand-text uppercase tracking-wide mt-1">Platba kartou</h1>
        <p className="text-brand-muted mt-2">
          {teamName} · {remainingLabel}
        </p>
        <p className="font-display text-5xl text-brand-orange-readable mt-4">{totalEur} €</p>
        {teamToken && maxQuantity > 1 ? (
          <p className="text-sm text-brand-muted mt-1">
            {safeQuantity} × {amountEur}&nbsp;€
          </p>
        ) : null}
        <p className="text-xs text-brand-muted mt-2">
          {teamToken
            ? maxQuantity > 1
              ? "Vyber, koľko nezaplatených miest chceš uhradiť naraz. Rovnaký odkaz môžu použiť aj ostatní."
              : "Zaplatíš jedno miesto. Rovnaký odkaz môžu použiť aj ostatní, kým sú voľné miesta."
            : null}{" "}
          Testovací checkout — kliknutím sa platba okamžite označí ako úspešná. Žiadna skutočná karta.
        </p>
      </div>

      {teamToken && maxQuantity > 1 ? (
        <div className="space-y-3 rounded-2xl border border-brand-border bg-brand-surface px-4 py-4">
          <label className="block">
            <span className="text-sm font-medium">Počet miest na zaplatenie</span>
            <div className="mt-2 flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={maxQuantity}
                step={1}
                value={safeQuantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="flex-1 accent-brand-orange"
                aria-valuemin={1}
                aria-valuemax={maxQuantity}
                aria-valuenow={safeQuantity}
              />
              <input
                type="number"
                min={1}
                max={maxQuantity}
                value={safeQuantity}
                onChange={(e) => {
                  const n = Math.floor(Number(e.target.value));
                  if (!Number.isFinite(n)) return;
                  setQuantity(Math.min(maxQuantity, Math.max(1, n)));
                }}
                className="w-16 rounded-xl border border-brand-border bg-brand-card px-2 py-2 text-center font-semibold"
              />
            </div>
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`btn-outline text-sm px-3 py-1.5 ${safeQuantity === 1 ? "ring-1 ring-brand-orange" : ""}`}
              onClick={() => setQuantity(1)}
            >
              1
            </button>
            {halfRemaining > 1 && halfRemaining < maxQuantity ? (
              <button
                type="button"
                className={`btn-outline text-sm px-3 py-1.5 ${safeQuantity === halfRemaining ? "ring-1 ring-brand-orange" : ""}`}
                onClick={() => setQuantity(halfRemaining)}
              >
                Polovica ({halfRemaining})
              </button>
            ) : null}
            <button
              type="button"
              className={`btn-outline text-sm px-3 py-1.5 ${safeQuantity === maxQuantity ? "ring-1 ring-brand-orange" : ""}`}
              onClick={() => setQuantity(maxQuantity)}
            >
              Všetky ({maxQuantity})
            </button>
          </div>
        </div>
      ) : null}

      <label className="block">
        <span className="text-sm font-medium">Meno (voliteľné)</span>
        <input
          className="mt-1 w-full rounded-xl border border-brand-border bg-brand-card px-4 py-3"
          value={payerName}
          onChange={(e) => setPayerName(e.target.value)}
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Tvoj e-mail — potvrdenie platby</span>
        <input
          className="mt-1 w-full rounded-xl border border-brand-border bg-brand-card px-4 py-3"
          type="email"
          value={payerEmail}
          onChange={(e) => setPayerEmail(e.target.value)}
          autoComplete="email"
          placeholder="napr. ty@email.sk"
        />
        <span className="text-xs text-brand-muted mt-1 block">
          Potvrdenie príde na túto adresu (platiteľ), nie kapitánovi tímu. Odporúčame vyplniť.
          {safeQuantity > 1 ? " Jedno e-mailové potvrdenie pokryje všetky miesta z tejto platby." : null}
        </span>
      </label>

      {error ? <p className="text-red-600 text-sm text-center">{error}</p> : null}

      <button type="button" className="btn-primary w-full justify-center" onClick={payMock} disabled={loading}>
        {loading
          ? "Spracovávam…"
          : safeQuantity > 1
            ? `Zaplatiť ${safeQuantity} ${seatsNoun(safeQuantity)} · ${totalEur} € (mock)`
            : `Zaplatiť kartou ${totalEur} € (mock)`}
      </button>
    </div>
  );
}
