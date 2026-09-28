"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { trackRegistrationComplete } from "@/lib/analytics";
import { TeamAutocomplete } from "@/components/TeamAutocomplete";

interface Props {
  eventSlug: string;
  venue: string;
  minPlayers?: number;
  maxPlayers?: number;
  teamSuggestions?: string[];
  onClose: () => void;
}

export default function RegistrationModal({
  eventSlug,
  venue,
  minPlayers = 2,
  maxPlayers = 8,
  teamSuggestions = [],
  onClose,
}: Props) {
  const [teamName, setTeamName] = useState("");
  const [players, setPlayers] = useState(String(minPlayers));
  const [phone, setPhone] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ team?: string; phone?: string }>({});
  const [mounted, setMounted] = useState(false);

  function validateForm(): boolean {
    const next: { team?: string; phone?: string } = {};
    if (!teamName.trim()) {
      next.team = "Zadaj názov tímu.";
    }
    const phoneDigits = phone.replace(/\D/g, "");
    if (!phone.trim()) {
      next.phone = "Zadaj telefónne číslo.";
    } else if (phoneDigits.length < 9) {
      next.phone = "Telefónne číslo musí mať aspoň 9 číslic.";
    }
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  useEffect(() => {
    setMounted(true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!validateForm()) return;

    setLoading(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venue, eventSlug, teamName, players, phone }),
      });
      if (res.ok) {
        trackRegistrationComplete({
          eventSlug,
          venue,
          players: Number(players) || undefined,
        });
        setSubmitted(true);
      } else {
        const data = await res.json().catch(() => ({}));
        const msg =
          (typeof data.error === "string" && data.error) ||
          (typeof data.message === "string" && data.message) ||
          "Chyba pri registrácii. Skús znova.";
        setError(msg);
      }
    } catch {
      setError("Sieťová chyba. Skús znova.");
    }
    setLoading(false);
  };

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="registration-modal-title"
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative bg-brand-card rounded-3xl shadow-2xl w-full max-w-md max-h-[min(90dvh,640px)] overflow-y-auto p-8 border border-brand-border">
        <button onClick={onClose} className="absolute top-5 right-5 text-brand-muted hover:text-brand-text transition-colors">
          <X className="w-5 h-5" />
        </button>
        {submitted ? (
          <div className="text-center py-8">
            <div className="text-6xl mb-4">&#127881;</div>
            <h3 className="font-display text-3xl text-brand-text mb-2">Hotovo!</h3>
            <p className="text-brand-muted">
              Tím <strong>{teamName}</strong> bol zaregistrovaný na kvíz v <strong>{venue}</strong>. Uvidíme sa
              tam!
            </p>
            <button onClick={onClose} className="btn-primary mt-6 px-8 py-3">
              Zatvoriť
            </button>
          </div>
        ) : (
          <>
            <h3 id="registration-modal-title" className="font-display text-3xl text-brand-text mb-1">
              Registrácia
            </h3>
            <p className="text-brand-muted text-sm mb-6">{venue}</p>
            <form onSubmit={handleSubmit} noValidate className="space-y-4" lang="sk">
              <div>
                <label className="block text-sm font-medium text-brand-text mb-1.5" htmlFor="reg-team-name">
                  Názov tímu
                </label>
                <TeamAutocomplete
                  id="reg-team-name"
                  value={teamName}
                  onChange={(value) => {
                    setTeamName(value);
                    if (fieldErrors.team) setFieldErrors((prev) => ({ ...prev, team: undefined }));
                  }}
                  suggestions={teamSuggestions}
                  placeholder="napr. Mudrc"
                  ariaInvalid={!!fieldErrors.team}
                  className={`w-full border rounded-xl px-4 py-3 text-brand-text bg-brand-surface placeholder:text-brand-muted-light focus:outline-none focus:border-brand-orange transition-colors ${
                    fieldErrors.team ? "border-red-500" : "border-brand-border"
                  }`}
                />
                {fieldErrors.team && (
                  <p className="text-red-500 text-sm mt-1.5" role="alert">
                    {fieldErrors.team}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-text mb-1.5">Počet hráčov</label>
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
                <label className="block text-sm font-medium text-brand-text mb-1.5" htmlFor="reg-phone">
                  Telefónne číslo
                </label>
                <input
                  id="reg-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  aria-required="true"
                  aria-invalid={!!fieldErrors.phone}
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    if (fieldErrors.phone) setFieldErrors((prev) => ({ ...prev, phone: undefined }));
                  }}
                  placeholder="+421 912 345 678"
                  className={`w-full border rounded-xl px-4 py-3 text-brand-text bg-brand-surface placeholder:text-brand-muted-light focus:outline-none focus:border-brand-orange transition-colors ${
                    fieldErrors.phone ? "border-red-500" : "border-brand-border"
                  }`}
                />
                {fieldErrors.phone && (
                  <p className="text-red-500 text-sm mt-1.5" role="alert">
                    {fieldErrors.phone}
                  </p>
                )}
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3.5 mt-2">
                {loading ? "Registrujem..." : "Zaregistrovať tím"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
