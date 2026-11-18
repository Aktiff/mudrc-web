"use client";

import { useMemo, useState } from "react";
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

function playersNoun(n: number): string {
  if (n === 1) return "hráč";
  if (n < 5) return "hráči";
  return "hráčov";
}

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
  /** Product rule: dropdown from 2 … quiz maxPlayers (still clamped by event min). */
  const playerMin = Math.max(2, minPlayers);
  const playerMax = Math.max(playerMin, maxPlayers);
  const playerOptions = useMemo(
    () => Array.from({ length: playerMax - playerMin + 1 }, (_, i) => playerMin + i),
    [playerMin, playerMax]
  );
  const [teamName, setTeamName] = useState("");
  const [players, setPlayers] = useState(String(playerMin));
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function waitUntilTeamReady(teamToken: string): Promise<boolean> {
    for (let attempt = 0; attempt < 20; attempt++) {
      try {
        const res = await fetch(`/api/pay/team/${encodeURIComponent(teamToken)}`, {
          cache: "no-store",
        });
        if (res.ok) return true;
      } catch {
        /* retry */
      }
      await new Promise((r) => setTimeout(r, 300 + attempt * 100));
    }
    return false;
  }

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
      const teamToken = String(data.teamToken ?? "");
      if (!teamToken) {
        setError("Registrácia prebehla, ale chýba odkaz na tím.");
        setLoading(false);
        return;
      }
      // Blob listing can lag — wait until the team page will not 404.
      const ready = await waitUntilTeamReady(teamToken);
      if (!ready) {
        setError("Rezervácia sa ukladá dlhšie než obvykle. Skús obnoviť stránku o chvíľu.");
        setLoading(false);
        router.push(`${basePath}/t/${teamToken}`);
        return;
      }
      router.push(`${basePath}/t/${teamToken}`);
    } catch {
      setError("Sieťová chyba. Skús znova.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-md space-y-4">
      <div className="text-center sm:text-left">
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
        <select
          className="mt-1 w-full rounded-xl border border-brand-border bg-brand-card px-4 py-3 pr-10"
          value={players}
          onChange={(e) => setPlayers(e.target.value)}
          required
        >
          {playerOptions.map((n) => (
            <option key={n} value={n}>
              {n} {playersNoun(n)}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-sm font-medium text-brand-text">Telefón kapitána (povinný)</span>
        <input
          className="mt-1 w-full rounded-xl border border-brand-border bg-brand-card px-4 py-3"
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
          autoComplete="tel"
          placeholder="+421 912 345 678"
          aria-required="true"
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
          Po registrácii ti pošleme odkaz na stránku tímu — otvoríš ju kedykoľvek bez prihlásenia. Použije sa aj na
          doklady, refund a zdieľanie pay-linku.
        </span>
      </label>

      {error ? <p className="text-red-600 text-sm">{error}</p> : null}

      <button type="submit" className="btn-primary w-full justify-center" disabled={loading}>
        {loading ? "Ukladám rezerváciu…" : "Rezervovať miesta a získať pay-link"}
      </button>
    </form>
  );
}
