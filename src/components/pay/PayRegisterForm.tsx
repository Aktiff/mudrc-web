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
  earlyFee: number;
  lateFee: number;
  walkUpFee: number;
  tierLadderCopy: string;
  pricingTier: "early" | "late" | "walk_up";
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
  earlyFee,
  lateFee,
  walkUpFee,
  tierLadderCopy,
  pricingTier,
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
      // Blob listing can lag — wait until the team is readable, then go straight to pay.
      const ready = await waitUntilTeamReady(teamToken);
      const payPath = `${basePath}/s/${teamToken}`;
      if (!ready) {
        setError("Rezervácia sa ukladá dlhšie než obvykle. Presmerúvam na platbu…");
        setLoading(false);
        router.push(payPath);
        return;
      }
      router.push(payPath);
    } catch {
      setError("Sieťová chyba. Skús znova.");
      setLoading(false);
    }
  }

  const tierHint =
    pricingTier === "early"
      ? `Teraz platíš skoré predplatné ${prepaidPrice} € / miesto`
      : pricingTier === "late"
        ? `Teraz platíš neskoré predplatné ${prepaidPrice} € / miesto`
        : `Online je uzamknuté — walk-up ${walkUpFee} € na mieste`;

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-md space-y-4">
      <div className="text-center sm:text-left">
        <p className="text-brand-muted text-sm mb-1">{venue}</p>
        <h1 className="font-display text-4xl text-brand-text tracking-wide uppercase">Registrácia tímu</h1>
        <p className="text-brand-muted mt-2 text-sm">{whenLabel}</p>
        <p className="text-brand-text mt-2 text-sm font-medium">{tierHint}</p>
        <p className="text-brand-muted mt-1 text-sm">
          Skôr = lacnejšie: {earlyFee}&nbsp;€ / {lateFee}&nbsp;€ / {walkUpFee}&nbsp;€. {tierLadderCopy}
        </p>
        <p className="text-brand-muted mt-1 text-xs">
          Cena podľa času platby (nie registrácie). Po registrácii ťa rovno presmerujeme na platbu. Storno: ≥24
          h → 50&nbsp;% · &lt;24 h → 0&nbsp;%.
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
          Po registrácii ťa presmerujeme na platbu a pošleme odkaz na stránku tímu. E-mail slúži aj na doklady a
          storno.
        </span>
      </label>

      {error ? <p className="text-red-600 text-sm">{error}</p> : null}

      <button type="submit" className="btn-primary w-full justify-center" disabled={loading}>
        {loading ? "Ukladám rezerváciu…" : `Rezervovať a zaplatiť (${prepaidPrice} € / miesto)`}
      </button>
    </form>
  );
}
