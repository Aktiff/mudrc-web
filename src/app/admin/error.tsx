"use client";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="max-w-lg space-y-4 py-10">
      <h1 className="font-display text-3xl text-brand-text tracking-wide">Stránku sa nepodarilo načítať</h1>
      <p className="text-brand-muted text-sm">{error.message || "Skús to znova o chvíľu."}</p>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={reset} className="btn-primary text-sm py-2.5 px-5">
          Skúsiť znova
        </button>
        <a href="/admin/hotove-kvizy" className="btn-outline text-sm py-2.5 px-5">
          Kvízy
        </a>
        <a href="/admin" className="btn-outline text-sm py-2.5 px-5">
          Prehľad
        </a>
      </div>
    </div>
  );
}
