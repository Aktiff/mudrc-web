"use client";

import { useState } from "react";
import { Download } from "lucide-react";

type Props = {
  quizId: string;
  className?: string;
  label?: string;
  busyLabel?: string;
};

export default function OfflinePresentationDownloadButton({
  quizId,
  className,
  label = "Stiahnuť prezentáciu",
  busyLabel = "Pripravujem ZIP…",
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const download = async () => {
    if (!quizId || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/quiz-library/${encodeURIComponent(quizId)}/offline?_=${Date.now()}`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      const contentType = res.headers.get("content-type") || "";
      if (!res.ok) {
        let message = "Offline prezentáciu sa nepodarilo pripraviť.";
        if (contentType.includes("application/json")) {
          const data = (await res.json().catch(() => null)) as { error?: string; failedUrls?: string[] } | null;
          if (data?.error) message = data.error;
          if (data?.failedUrls?.length) {
            message += ` Chýba ${data.failedUrls.length} médi${data.failedUrls.length === 1 ? "um" : "í"}.`;
          }
        }
        setError(message);
        return;
      }

      const blob = await res.blob();
      const disposition = res.headers.get("content-disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/i);
      const fileName = match?.[1] || `kviz-${quizId}-offline.zip`;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("Sieťová chyba pri sťahovaní. Skús to znova, kým máš internet.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="inline-flex flex-col items-stretch gap-1">
      <button
        type="button"
        onClick={() => void download()}
        disabled={busy}
        title="Stiahne ZIP s offline prezentáciou na disk — funguje bez internetu"
        className={
          className ??
          "btn-outline text-sm py-2.5 px-4 inline-flex items-center gap-2 disabled:opacity-60"
        }
      >
        <Download className="w-4 h-4" />
        {busy ? busyLabel : label}
      </button>
      {error ? <span className="text-xs text-red-500 max-w-xs">{error}</span> : null}
    </span>
  );
}
