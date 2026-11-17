"use client";

import { useState } from "react";
import Link from "next/link";

type Props = {
  eventSlug: string;
  quizDate: string;
  venue: string;
  whenLabel: string;
  walkUpPrice: number;
  prepaidPrice: number;
  checkInHref: string;
};

export default function PayWalkUpForm({
  eventSlug,
  quizDate,
  venue,
  whenLabel,
  walkUpPrice,
  prepaidPrice,
  checkInHref,
}: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/pay/walk-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventSlug, quizDate, name, email, phone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Walk-up zlyhal.");
        setLoading(false);
        return;
      }
      setDone(true);
    } catch {
      setError("Sieťová chyba.");
    }
    setLoading(false);
  }

  if (done) {
    return (
      <div className="max-w-md space-y-4">
        <h1 className="font-display text-4xl uppercase tracking-wide text-brand-text">Walk-up paid</h1>
        <p className="text-brand-muted">
          Mock platba {walkUpPrice}&nbsp;€ pre {name} je potvrdená.
        </p>
        <Link href={checkInHref} className="btn-primary">
          Späť na check-in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="max-w-md space-y-4">
      <div>
        <p className="text-brand-muted text-sm">
          {venue} · {whenLabel}
        </p>
        <h1 className="font-display text-4xl uppercase tracking-wide text-brand-text mt-1">Walk-up</h1>
        <p className="text-brand-muted text-sm mt-2">
          Na mieste {walkUpPrice}&nbsp;€ (predplatné {prepaidPrice}&nbsp;€ + príplatok). Len karta — mock auto-success.
        </p>
      </div>

      <label className="block">
        <span className="text-sm font-medium">Meno hosťa</span>
        <input
          className="mt-1 w-full rounded-xl border border-brand-border bg-brand-card px-4 py-3"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium">E-mail (voliteľné)</span>
        <input
          className="mt-1 w-full rounded-xl border border-brand-border bg-brand-card px-4 py-3"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Telefón (voliteľné)</span>
        <input
          className="mt-1 w-full rounded-xl border border-brand-border bg-brand-card px-4 py-3"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </label>

      {error ? <p className="text-red-600 text-sm">{error}</p> : null}

      <button type="submit" className="btn-primary w-full justify-center" disabled={loading}>
        {loading ? "Platím…" : `Zaplatiť kartou ${walkUpPrice} € (mock)`}
      </button>
    </form>
  );
}
