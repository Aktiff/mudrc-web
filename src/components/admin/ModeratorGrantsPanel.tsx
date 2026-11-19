"use client";

import { useEffect, useState } from "react";
import { UserPlus, X } from "lucide-react";

type Grant = {
  username: string;
  eventSlug: string;
  grantedAt: string;
  grantedBy: string;
};

export default function ModeratorGrantsPanel({ eventSlug }: { eventSlug: string }) {
  const [moderators, setModerators] = useState<string[]>([]);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [selected, setSelected] = useState("");
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const res = await fetch(`/api/admin/moderators?slug=${encodeURIComponent(eventSlug)}&_=${Date.now()}`, {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!res.ok) return;
    const data = (await res.json()) as { moderators?: string[]; grants?: Grant[] };
    setModerators(data.moderators ?? []);
    setGrants(data.grants ?? []);
    if (!selected && (data.moderators?.length ?? 0) > 0) {
      setSelected(data.moderators![0]);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventSlug]);

  const grant = async () => {
    if (!selected) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/moderators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ username: selected, eventSlug }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ text: data.error ?? "Nepodarilo sa prideliť práva.", ok: false });
        return;
      }
      setMsg({ text: `Moderátor ${selected} má práva pre tento podnik.`, ok: true });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (username: string) => {
    if (!confirm(`Odobrať moderátorské práva používateľovi ${username}?`)) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(
        `/api/admin/moderators?username=${encodeURIComponent(username)}&eventSlug=${encodeURIComponent(eventSlug)}`,
        { method: "DELETE", credentials: "same-origin" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ text: data.error ?? "Nepodarilo sa odobrať práva.", ok: false });
        return;
      }
      setMsg({ text: `Práva pre ${username} boli odobraté.`, ok: true });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const grantedNames = new Set(grants.map((g) => g.username.toLowerCase()));
  const available = moderators.filter((name) => !grantedNames.has(name.toLowerCase()));

  return (
    <div className="bg-brand-card rounded-2xl border border-brand-border p-6 space-y-4">
      <div>
        <h2 className="font-display text-xl text-brand-text tracking-wide">Moderátori podniku</h2>
        <p className="text-brand-muted text-sm mt-1">
          Priraď moderátora k tomuto podniku. Uvidí len túto udalosť, môže spúšťať prezentácie a ukladať /
          opravovať vlastné výsledkové tabuľky.
        </p>
      </div>

      {grants.length === 0 ? (
        <p className="text-sm text-brand-muted">Zatiaľ nie je priradený žiadny moderátor.</p>
      ) : (
        <ul className="space-y-2">
          {grants.map((grant) => (
            <li
              key={`${grant.username}-${grant.eventSlug}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-brand-border px-4 py-3"
            >
              <div>
                <div className="font-semibold text-brand-text">{grant.username}</div>
                <div className="text-xs text-brand-muted">
                  Od {new Date(grant.grantedAt).toLocaleString("sk-SK")}
                </div>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void revoke(grant.username)}
                className="inline-flex items-center gap-1 text-sm font-semibold text-red-500 hover:text-red-600 disabled:opacity-50"
              >
                <X className="w-4 h-4" /> Odobrať
              </button>
            </li>
          ))}
        </ul>
      )}

      {available.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <select
            className="input py-2.5"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            {available.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy || !selected}
            onClick={() => void grant()}
            className="btn-primary text-sm py-2.5 px-4 justify-center"
          >
            <UserPlus className="w-4 h-4" />
            Prideliť práva
          </button>
        </div>
      )}

      {moderators.length === 0 && (
        <p className="text-sm text-amber-700 dark:text-amber-300">
          V systéme zatiaľ nie je žiadny moderátorský účet.
        </p>
      )}

      {msg && (
        <p className={`text-sm ${msg.ok ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
