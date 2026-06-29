"use client";
import { useState } from "react";
import { X } from "lucide-react";

interface Props {
  eventSlug: string;
  venue: string;
  minPlayers?: number;
  maxPlayers?: number;
  onClose: () => void;
}

export default function RegistrationModal({ eventSlug, venue, minPlayers = 2, maxPlayers = 8, onClose }: Props) {
  const [teamName, setTeamName] = useState("");
  const [players, setPlayers] = useState(String(minPlayers));
  const [phone, setPhone] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venue, eventSlug, teamName, players, phone }),
      });
      if (res.ok) {
        setSubmitted(true);
      } else {
        setError("Chyba pri registrácii. Skús znova.");
      }
    } catch {
      setError("Sieťová chyba. Skús znova.");
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-brand-card rounded-3xl shadow-2xl w-full max-w-md p-8 border border-brand-border">
        <button onClick={onClose} className="absolute top-5 right-5 text-brand-muted hover:text-brand-text transition-colors">
          <X className="w-5 h-5" />
        </button>
        {submitted ? (
          <div className="text-center py-8">
            <div className="text-6xl mb-4">&#127881;</div>
            <h3 className="font-display text-3xl text-brand-text mb-2">{"Hotovo!"}</h3>
            <p className="text-brand-muted">
              {"T\u00edm "}<strong>{teamName}</strong>{" bol zaregistrovan\u00fd na kv\u00edz v "}
              <strong>{venue}</strong>{". Uvidíme sa tam!"}
            </p>
            <button onClick={onClose} className="btn-primary mt-6 px-8 py-3">
              {"Zatvori\u0165"}
            </button>
          </div>
        ) : (
          <>
            <h3 className="font-display text-3xl text-brand-text mb-1">{"Registrácia"}</h3>
            <p className="text-brand-muted text-sm mb-6">{venue}</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-brand-text mb-1.5">{"Názov tímu"}</label>
                <input
                  type="text"
                  required
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder={"napr. Bzdochy"}
                  className="w-full border border-brand-border rounded-xl px-4 py-3 text-brand-text bg-brand-surface placeholder:text-brand-muted-light focus:outline-none focus:border-brand-orange transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-text mb-1.5">{"Po\u010det hr\u00e1\u010dov"}</label>
                <select
                  value={players}
                  onChange={(e) => setPlayers(e.target.value)}
                  className="w-full border border-brand-border rounded-xl px-4 py-3 text-brand-text bg-brand-surface focus:outline-none focus:border-brand-orange transition-colors"
                >
                  {Array.from({ length: maxPlayers - minPlayers + 1 }, (_, i) => minPlayers + i).map((n) => (
                    <option key={n} value={n}>{n} {n === 1 ? "hráč" : n < 5 ? "hráči" : "hráčov"}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-text mb-1.5">{"Telef\u00f3nne \u010d\u00edslo"}</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+421 9XX XXX XXX"
                  className="w-full border border-brand-border rounded-xl px-4 py-3 text-brand-text bg-brand-surface placeholder:text-brand-muted-light focus:outline-none focus:border-brand-orange transition-colors"
                />
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3.5 mt-2">
                {loading ? "Registrujem..." : "Zaregistrova\u0165 t\u00edm"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
