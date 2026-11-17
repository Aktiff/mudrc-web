"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  eventSlug: string;
  quizDate: string;
  venue: string;
  whenLabel: string;
  minPlayers: number;
  maxPlayers: number;
  prepaidPrice: number;
  /** e.g. "" or "/pay" */
  basePath: "" | "/pay";
};

export default function PayRegisterForm({
  eventSlug,
  quizDate,
  venue,
  whenLabel,
  minPlayers,
  maxPlayers,
  prepaidPrice,
  basePath,
}: Props) {
  const router = useRouter();
  const [teamName, setTeamName] = useState("");
  const [players, setPlayers] = useState(String(minPlayers));
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/pay/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventSlug,
          quizDate,
          teamName,
          players,
          phone,
          email,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Registrácia zlyhala.");
        setLoading(false);
        return;
      }
      router.push(`${basePath}/t/${String(data.teamToken)}`);
    } catch {
      setError("Sieťová chyba. Skús znova.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 max-w-md">
      <div>
        <p className="text-brand-muted text-sm mb-1">{venue}</p>
        <h1 className="font-display text-4xl text-brand-text tracking-wide uppercase">Registrácia tímu</h1>
        <p className="text-brand-muted mt-2 text-sm">{whenLabel}</p>
        <p className="text-brand-muted mt-1 text-sm">
          Predplatné {prepaidPrice}&nbsp;€ / miesto · hold do štartu kvízu
        </p>
      </div>

      <label className="block">
        <span className="text-sm font-medium text-brand-text">Názov tímu</span>
        <input
          className="mt-1 w-full rounded-xl border border-brand-border bg-brand-card px-4 py-3"
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
          required
          autoComplete="organization"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-brand-text">Počet miest (hráčov)</span>
        <input
          className="mt-1 w-full rounded-xl border border-brand-border bg-brand-card px-4 py-3"
          type="number"
          min={minPlayers}
          max={maxPlayers}
          value={players}
          onChange={(e) => setPlayers(e.target.value)}
          required
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-brand-text">Telefón kapitána</span>
        <input
          className="mt-1 w-full rounded-xl border border-brand-border bg-brand-card px-4 py-3"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
          autoComplete="tel"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-brand-text">E-mail kapitána (povinný)</span>
        <input
          className="mt-1 w-full rounded-xl border border-brand-border bg-brand-card px-4 py-3"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
        <span className="text-xs text-brand-muted mt-1 block">
          Na doklady, refund a zdieľanie pay-linkov.
        </span>
      </label>

      {error ? <p className="text-red-600 text-sm">{error}</p> : null}

      <button type="submit" className="btn-primary w-full justify-center" disabled={loading}>
        {loading ? "Ukladám…" : "Rezervovať miesta a získať pay-linky"}
      </button>
    </form>
  );
}
