"use client";

import Link from "next/link";

export default function PlayQuizError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[9999] bg-[#060606] text-white flex flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-xl">Projekciu sa nepodarilo otvoriť.</p>
      <p className="text-white/60 text-sm max-w-md">{error.message || "Skús to znova o chvíľu."}</p>
      <button
        type="button"
        onClick={reset}
        className="rounded-xl bg-[#f0c800] text-black font-bold px-5 py-3"
      >
        Skúsiť znova
      </button>
      <Link href="/admin/hotove-kvizy" className="text-[#f0c800] underline text-sm">
        Späť na kvízy
      </Link>
    </div>
  );
}
