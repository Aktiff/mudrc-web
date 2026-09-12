"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Plus, Upload } from "lucide-react";
import AudioUrlField from "@/components/admin/AudioUrlField";
import { addSoundBankItemAsync, findSoundClipConflictAsync } from "@/lib/sound-bank-client";
import { formatSoundClipDuplicateMessage, parseSoundClipFromFileName, soundClipKey } from "@/lib/sound-bank";
import { uploadAudioFileClient } from "@/lib/upload-audio-client";

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

const AUDIO_ACCEPT =
  "audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/mp4,audio/x-m4a,.mp3,.m4a,.wav,.ogg";

export default function SoundBankQuestionForm({ onAdded, onMessage }: Props) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [answer, setAnswer] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
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
      const parsed = parseSoundClipFromFileName(file.name);
      if (!parsed) {
        rows.push({ file, label: "", answer: "", parseError: "Očakávam „Popis - Odpoveď.mp3“ alebo „Trump.mp3“" });
      } else {
        rows.push({ file, label: parsed.label, answer: parsed.answer });
      }
    }
    setBulkRows(rows);
    event.target.value = "";
  };

  const runBulkUpload = async () => {
    const valid = bulkRows.filter((row) => !row.parseError);
    if (!valid.length) {
      setError("Vyber aspoň jeden súbor v správnom formáte.");
      return;
    }
    setError("");
    setBulkUploading(true);
    let okCount = 0;
    const seen = new Set<string>();
    for (const row of valid) {
      const key = soundClipKey(row.label, row.answer);
      if (seen.has(key)) continue;
      seen.add(key);
      try {
        const conflict = await findSoundClipConflictAsync(row.label, row.answer);
        if (conflict) continue;
        const url = await uploadAudioFileClient(row.file);
        await addSoundBankItemAsync({
          label: row.label,
          answer: row.answer,
          audioUrl: url,
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
      onMessage?.(`Pridaných ${okCount} zvukových ukážok do banky.`, true);
    }
  };

  const handleSubmit = async () => {
    setError("");
    if (!label.trim() || !answer.trim()) {
      setError("Vyplň popis a správnu odpoveď.");
      return;
    }
    if (!audioUrl.trim()) {
      setError("Nahraj alebo vlož URL audio.");
      return;
    }
    setSubmitting(true);
    try {
      await addSoundBankItemAsync({
        label: label.trim(),
        answer: answer.trim(),
        audioUrl: audioUrl.trim(),
        note: note.trim() || undefined,
      });
      setLabel("");
      setAnswer("");
      setAudioUrl("");
      setNote("");
      onMessage?.("Zvuková ukážka pridaná do banky.", true);
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
    <div className="bg-brand-card border border-sky-300/40 dark:border-sky-800 rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-brand-warm/50 transition-colors"
      >
        <div>
          <p className="font-semibold text-brand-text text-sm">Pridať zvukovú ukážku do banky</p>
          <p className="text-brand-muted text-xs mt-0.5">
            Hlasy, zvuky · „Popis - Odpoveď.mp3“ · vložíš do ľubovoľného slotu otázky
          </p>
        </div>
        {open ? <ChevronUp className="w-5 h-5 shrink-0" /> : <ChevronDown className="w-5 h-5 shrink-0" />}
      </button>
      {open && (
        <div className="px-5 pb-5 pt-0 space-y-4 border-t border-brand-border">
          <div className="rounded-xl border border-dashed border-sky-300/60 p-4 space-y-3">
            <label className="btn-primary text-sm py-2 px-4 inline-flex items-center gap-2 cursor-pointer">
              <Upload className="w-4 h-4" />
              {bulkUploading ? "Nahrávam…" : "Hromadný upload audio"}
              <input type="file" accept={AUDIO_ACCEPT} multiple className="hidden" disabled={bulkUploading} onChange={handleBulkFilePick} />
            </label>
            {bulkRows.length > 0 && (
              <button type="button" disabled={bulkUploading || bulkReadyCount === 0} onClick={runBulkUpload} className="btn-outline text-sm py-2 px-3">
                Nahrať {bulkReadyCount} súborov
              </button>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Popis (pre teba)</label>
              <input className="input text-sm" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="napr. Trump — prejav" />
            </div>
            <div>
              <label className="label">Správna odpoveď</label>
              <input className="input text-sm" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="napr. Donald Trump" />
            </div>
          </div>
          <AudioUrlField value={audioUrl} onChange={setAudioUrl} onUploadError={(t) => onMessage?.(t, false)} onUploadSuccess={(t) => onMessage?.(t, true)} />
          <input className="input text-sm" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Poznámka pre teba (voliteľné)" />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button type="button" disabled={submitting || bulkUploading} onClick={handleSubmit} className="btn-primary text-sm py-2 px-4 inline-flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Pridať jednu ukážku
          </button>
        </div>
      )}
    </div>
  );
}
