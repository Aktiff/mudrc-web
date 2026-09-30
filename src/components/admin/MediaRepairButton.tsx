"use client";

import { useState } from "react";
import { RefreshCw, Wrench } from "lucide-react";

type Props = {
  className?: string;
};

export default function MediaRepairButton({ className }: Props) {
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [ok, setOk] = useState<boolean | null>(null);

  const run = async () => {
    if (running) return;
    if (
      !window.confirm(
        "Skontroluje fotky a ukážky. Staré súbory, ktoré už nie sú v úložisku, treba nahrať znova. Pokračovať?"
      )
    ) {
      return;
    }
    setRunning(true);
    setReport(null);
    setOk(null);
    try {
      const res = await fetch("/api/admin/repair-all-media", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      setOk(data.ok === true);
      const parts: string[] = [];
      if (data.eventImages?.migrated?.length) {
        parts.push(`Fotky podnikov: ${data.eventImages.migrated.length} opravených.`);
      }
      if (typeof data.quizzesChanged === "number") {
        parts.push(`Kvízy: ${data.quizzesChanged} z ${data.quizCount ?? "?"} aktualizovaných.`);
      }
      if (data.banks) {
        const b = data.banks;
        parts.push(
          `Banka: hudba ${b.musicUpdated ?? 0}, zvuk ${b.soundUpdated ?? 0}, video ${b.videoUpdated ?? 0}.`
        );
      }
      if (data.failed?.length) {
        parts.push(`Nepodarilo sa (${data.failed.length}): ${data.failed.slice(0, 5).join("; ")}…`);
      }
      if (data.error) parts.unshift(String(data.error));
      if (data.hint) parts.push(data.hint);
      setReport(parts.join(" ") || "Hotovo.");
    } catch {
      setOk(false);
      setReport("Sieťová chyba — skús znova alebo obnov stránku.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => void run()}
        disabled={running}
        className="btn-outline text-sm py-2.5 px-4 inline-flex items-center gap-2 border-amber-500/40 text-amber-900 dark:text-amber-200 hover:bg-amber-50 dark:hover:bg-amber-950/30"
      >
        {running ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}
        {running ? "Opravujem médiá…" : "Opraviť ukážky a fotky (všetky kvízy)"}
      </button>
      {report && (
        <p className={`text-sm mt-2 max-w-3xl ${ok ? "text-teal-700 dark:text-teal-300" : "text-amber-800 dark:text-amber-200"}`}>
          {report}
        </p>
      )}
    </div>
  );
}
