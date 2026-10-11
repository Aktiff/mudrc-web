"use client";

import { useState } from "react";

type Props = { slug: string };

export default function FacebookEventPostButton({ slug }: Props) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [configured, setConfigured] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [postedUrl, setPostedUrl] = useState("");

  async function openPreview() {
    setError("");
    setPostedUrl("");
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/events/${encodeURIComponent(slug)}/facebook`, {
        cache: "no-store",
      });
      const data = (await res.json().catch(() => null)) as { message?: string; configured?: boolean; error?: string } | null;
      if (!res.ok || !data?.message) {
        setError(data?.error || "Text príspevku sa nepodarilo pripraviť.");
        setOpen(true);
        return;
      }
      setMessage(data.message);
      setConfigured(data.configured !== false);
      setOpen(true);
    } catch {
      setError("Text príspevku sa nepodarilo pripraviť.");
      setOpen(true);
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/events/${encodeURIComponent(slug)}/facebook`, {
        method: "POST",
      });
      const data = (await res.json().catch(() => null)) as { url?: string; error?: string; message?: string } | null;
      if (!res.ok || !data?.url) {
        if (data?.message) setMessage(data.message);
        setError(data?.error || "Príspevok sa nepodarilo odoslať.");
        return;
      }
      setPostedUrl(data.url);
    } catch {
      setError("Príspevok sa nepodarilo odoslať.");
    } finally {
      setBusy(false);
    }
  }

  async function copyText() {
    if (!message) return;
    try {
      await navigator.clipboard.writeText(message);
      setError("");
    } catch {
      setError("Text sa nepodarilo skopírovať.");
    }
  }

  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : void openPreview())}
        disabled={busy && !open}
        className="text-xs font-semibold px-3 py-1.5 rounded-full border border-[#1877F2]/40 text-[#1877F2] hover:bg-[#1877F2]/10 disabled:opacity-60"
      >
        {busy && !open ? "Pripravujem…" : "Poslať na Facebook"}
      </button>
      {open && (
        <div className="mt-3 rounded-xl border border-brand-border bg-brand-surface p-3 space-y-3">
          <p className="text-xs text-brand-muted">
            Text je z uloženej udalosti. Ak si údaje práve menil, najprv ich ulož.
          </p>
          {message && (
            <textarea
              readOnly
              value={message}
              rows={14}
              className="w-full text-sm text-brand-text bg-brand-card border border-brand-border rounded-lg p-3 resize-y"
            />
          )}
          {postedUrl ? (
            <p className="text-sm text-green-700 dark:text-green-300">
              Príspevok je na stránke.{" "}
              <a href={postedUrl} target="_blank" rel="noreferrer" className="underline">
                Otvoriť
              </a>
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void publish()}
                disabled={busy || !message || !configured}
                className="text-sm font-semibold px-4 py-2 rounded-xl bg-[#1877F2] text-white disabled:opacity-50"
              >
                {busy ? "Posielam…" : "Odoslať na stránku"}
              </button>
              <button
                type="button"
                onClick={() => void copyText()}
                disabled={!message}
                className="text-sm font-semibold px-4 py-2 rounded-xl border border-brand-border text-brand-text disabled:opacity-50"
              >
                Kopírovať text
              </button>
            </div>
          )}
          {!configured && !postedUrl && (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Odoslanie zatiaľ nejde: na Verceli chýba FACEBOOK_PAGE_ACCESS_TOKEN. Text si môžeš skopírovať.
            </p>
          )}
          {error && <p className="text-sm text-red-600 dark:text-red-300">{error}</p>}
        </div>
      )}
    </div>
  );
}
