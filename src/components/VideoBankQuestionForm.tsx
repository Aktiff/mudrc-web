"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Plus, Upload } from "lucide-react";
import VideoUrlField from "@/components/admin/VideoUrlField";
import { addVideoBankItemAsync, findVideoClipConflictAsync } from "@/lib/video-bank-client";
import { parseVideoClipFromFileName, videoClipKey } from "@/lib/video-bank";
import { uploadVideoFileClient } from "@/lib/upload-video-client";

type Props = {
  onAdded?: () => void;
  onMessage?: (text: string, ok: boolean) => void;
};

type BulkPreviewRow = {
  file: File;
  label: string;
  answer: string;
  parseError?: string;
};

const VIDEO_ACCEPT = "video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.m4v";

export default function VideoBankQuestionForm({ onAdded, onMessage }: Props) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [answer, setAnswer] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [bulkRows, setBulkRows] = useState<BulkPreviewRow[]>([]);
  const [bulkUploading, setBulkUploading] = useState(false);

  const bulkReadyCount = useMemo(
    () => bulkRows.filter((row) => !row.parseError).length,
    [bulkRows]
  );

  const handleBulkFilePick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files?.length) return;
    const rows: BulkPreviewRow[] = [];
    for (const file of Array.from(files)) {
      const parsed = parseVideoClipFromFileName(file.name);
      if (!parsed) {
        rows.push({ file, label: "", answer: "", parseError: "Očakávam „Film - Odpoveď.mp4“" });
      } else {
        rows.push({ file, label: parsed.label, answer: parsed.answer });
      }
    }
    setBulkRows(rows);
    event.target.value = "";
  };

  const runBulkUpload = async () => {
    const valid = bulkRows.filter((row) => !row.parseError);
    if (!valid.length) return;
    setBulkUploading(true);
    let okCount = 0;
    const seen = new Set<string>();
    for (const row of valid) {
      const key = videoClipKey(row.label, row.answer);
      if (seen.has(key)) continue;
      seen.add(key);
      try {
        const conflict = await findVideoClipConflictAsync(row.label, row.answer);
        if (conflict) continue;
        const url = await uploadVideoFileClient(row.file);
        await addVideoBankItemAsync({
          label: row.label,
          answer: row.answer,
          videoUrl: url,
          note: note.trim() || undefined,
        });
        okCount += 1;
      } catch {
        /* skip */
      }
    }
    setBulkUploading(false);
    if (okCount > 0) {
      setBulkRows([]);
      onAdded?.();
      onMessage?.(`Pridaných ${okCount} video ukážok do banky.`, true);
    }
  };

  const handleSubmit = async () => {
    setError("");
    if (!label.trim() || !answer.trim() || !videoUrl.trim()) {
      setError("Vyplň popis, odpoveď a video.");
      return;
    }
    setSubmitting(true);
    try {
      await addVideoBankItemAsync({
        label: label.trim(),
        answer: answer.trim(),
        videoUrl: videoUrl.trim(),
        note: note.trim() || undefined,
      });
      setLabel("");
      setAnswer("");
      setVideoUrl("");
      setNote("");
      onMessage?.("Video ukážka pridaná do banky.", true);
      onAdded?.();
    } catch (err) {
      const text = err instanceof Error ? err.message : "Uloženie zlyhalo.";
      setError(text);
      onMessage?.(text, false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-brand-card border border-amber-300/40 dark:border-amber-800 rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-brand-warm/50 transition-colors"
      >
        <div>
          <p className="font-semibold text-brand-text text-sm">Pridať video ukážku do banky</p>
          <p className="text-brand-muted text-xs mt-0.5">Filmy, seriály · vložíš do ľubovoľného slotu otázky</p>
        </div>
        {open ? <ChevronUp className="w-5 h-5 shrink-0" /> : <ChevronDown className="w-5 h-5 shrink-0" />}
      </button>
      {open && (
        <div className="px-5 pb-5 pt-0 space-y-4 border-t border-brand-border">
          <label className="btn-primary text-sm py-2 px-4 inline-flex items-center gap-2 cursor-pointer">
            <Upload className="w-4 h-4" />
            {bulkUploading ? "Nahrávam…" : "Hromadný upload video"}
            <input type="file" accept={VIDEO_ACCEPT} multiple className="hidden" disabled={bulkUploading} onChange={handleBulkFilePick} />
          </label>
          {bulkRows.length > 0 && (
            <button type="button" disabled={bulkUploading || bulkReadyCount === 0} onClick={runBulkUpload} className="btn-outline text-sm py-2 px-3">
              Nahrať {bulkReadyCount} súborov
            </button>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Popis (pre teba)</label>
              <input className="input text-sm" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="napr. Matrix — lobby" />
            </div>
            <div>
              <label className="label">Správna odpoveď</label>
              <input className="input text-sm" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="napr. Matrix" />
            </div>
          </div>
          <VideoUrlField value={videoUrl} onChange={setVideoUrl} onUploadError={(t) => onMessage?.(t, false)} onUploadSuccess={(t) => onMessage?.(t, true)} />
          <input className="input text-sm" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Poznámka pre teba (voliteľné)" />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button type="button" disabled={submitting || bulkUploading} onClick={handleSubmit} className="btn-primary text-sm py-2 px-4 inline-flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Pridať jedno video
          </button>
        </div>
      )}
    </div>
  );
}
