"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Plus, Upload } from "lucide-react";
import AudioUrlField from "@/components/admin/AudioUrlField";
import { addMusicBankItemAsync, findMusicTrackConflictAsync } from "@/lib/music-bank-client";
import {
  formatMusicBankTagsLabel,
  formatMusicTrackDuplicateMessage,
  musicTrackKey,
  parseMusicTrackFromFileName,
} from "@/lib/music-bank";
import { uploadAudioFileClient } from "@/lib/upload-audio-client";

type Props = {
  onAdded?: () => void;
  onMessage?: (text: string, ok: boolean) => void;
};

type BulkPreviewRow = {
  file: File;
  artist: string;
  title: string;
  parseError?: string;
};

const AUDIO_ACCEPT =
  "audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/mp4,audio/x-m4a,.mp3,.m4a,.wav,.ogg";

export default function MusicBankQuestionForm({ onAdded, onMessage }: Props) {
  const [open, setOpen] = useState(false);
  const [artist, setArtist] = useState("");
  const [title, setTitle] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [bulkRows, setBulkRows] = useState<BulkPreviewRow[]>([]);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number; label: string } | null>(
    null
  );
  const [bulkErrors, setBulkErrors] = useState<string[]>([]);

  const bulkReadyCount = useMemo(
    () => bulkRows.filter((row) => !row.parseError).length,
    [bulkRows]
  );

  const handleBulkFilePick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files?.length) return;

    const rows: BulkPreviewRow[] = [];
    for (const file of Array.from(files)) {
      const parsed = parseMusicTrackFromFileName(file.name);
      if (!parsed) {
        rows.push({
          file,
          artist: "",
          title: "",
          parseError: "Očakávam názov „Interpret - Názov skladby.mp3“",
        });
      } else {
        rows.push({ file, artist: parsed.artist, title: parsed.title });
      }
    }
    setBulkRows(rows);
    setBulkErrors([]);
    event.target.value = "";
  };

  const runBulkUpload = async () => {
    const valid = bulkRows.filter((row) => !row.parseError);
    if (!valid.length) {
      setError("Vyber aspoň jeden súbor v správnom formáte názvu.");
      return;
    }

    setError("");
    setBulkErrors([]);
    setBulkUploading(true);
    setBulkProgress({ done: 0, total: valid.length, label: "" });

    const failures: string[] = [];
    let okCount = 0;
    const seenInBatch = new Set<string>();

    for (let i = 0; i < valid.length; i += 1) {
      const row = valid[i];
      const batchKey = musicTrackKey(row.artist, row.title);
      if (seenInBatch.has(batchKey)) {
        failures.push(`${row.file.name}: Rovnaká skladba je vo výbere viackrát.`);
        continue;
      }
      seenInBatch.add(batchKey);
      setBulkProgress({
        done: i,
        total: valid.length,
        label: `${row.artist} — ${row.title}`,
      });

      try {
        const conflict = await findMusicTrackConflictAsync(row.artist, row.title);
        if (conflict) {
          failures.push(`${row.file.name}: ${formatMusicTrackDuplicateMessage(conflict)}`);
          continue;
        }

        const url = await uploadAudioFileClient(row.file);
        await addMusicBankItemAsync({
          artist: row.artist,
          title: row.title,
          audioUrl: url,
          note: note.trim() || undefined,
        });
        okCount += 1;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload zlyhal";
        failures.push(`${row.file.name}: ${msg}`);
      }
    }

    setBulkProgress({ done: valid.length, total: valid.length, label: "" });
    setBulkUploading(false);

    if (failures.length) {
      setBulkErrors(failures);
    }

    if (okCount > 0) {
      setBulkRows([]);
      onAdded?.();
      onMessage?.(
        failures.length
          ? `Pridaných ${okCount}/${valid.length} skladieb. Skontroluj chyby nižšie.`
          : `Pridaných ${okCount} skladieb do banky hudby.`,
        !failures.length
      );
    } else {
      onMessage?.("Žiadna skladba sa nepodarila nahrať.", false);
    }
  };

  const handleSubmit = async () => {
    setError("");
    if (!artist.trim() || !title.trim()) {
      setError("Vyplň interpreta a názov skladby.");
      return;
    }
    if (!audioUrl.trim()) {
      setError("Nahraj alebo vlož URL audio ukážky.");
      return;
    }

    setSubmitting(true);
    try {
      const saved = await addMusicBankItemAsync({
        artist: artist.trim(),
        title: title.trim(),
        audioUrl: audioUrl.trim(),
        note: note.trim() || undefined,
      });
      setArtist("");
      setTitle("");
      setAudioUrl("");
      setNote("");
      const tagLine = formatMusicBankTagsLabel(saved.tags);
      onMessage?.(
        tagLine ? `Skladba pridaná. Tagy: ${tagLine}` : "Skladba pridaná (tagy sa nepodarilo zistiť).",
        true
      );
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
    <div className="bg-brand-card border border-violet-300/40 dark:border-violet-800 rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 sm:px-6 sm:py-5 text-left hover:bg-brand-warm/50 transition-colors"
      >
        <div>
          <p className="font-semibold text-brand-text text-sm">Pridať skladbu do banky hudby</p>
          <p className="text-brand-muted text-xs mt-0.5">
            Hromadný upload · tagy (jazyk, štýl, dekáda) z MusicBrainz · 1+1 bod · 4. kolo
          </p>
        </div>
        {open ? <ChevronUp className="w-5 h-5 text-brand-muted shrink-0" /> : <ChevronDown className="w-5 h-5 text-brand-muted shrink-0" />}
      </button>

      {open && (
        <div className="px-5 py-5 sm:px-6 sm:py-6 space-y-5 border-t border-brand-border">
          <div className="rounded-xl border border-dashed border-violet-300/60 dark:border-violet-700 bg-brand-warm/40 p-4 space-y-3">
            <div>
              <p className="text-sm font-semibold text-brand-text">Hromadné nahratie</p>
              <p className="text-brand-muted text-xs mt-1 leading-relaxed">
                Pomenuj súbory ako pri kvíze:{" "}
                <span className="font-mono text-[11px]">The Beatles - Help!.mp3</span>,{" "}
                <span className="font-mono text-[11px]">Kryštof, Tomáš Klus - Cesta.mp3</span> — vždy{" "}
                <strong>interpret, medzera, pomlčka, medzera, názov</strong>.
              </p>
            </div>
            <label className="btn-primary text-sm py-2.5 px-5 inline-flex items-center gap-2 cursor-pointer">
              <Upload className="w-4 h-4" />
              {bulkUploading ? "Nahrávam…" : "Vybrať viac súborov naraz"}
              <input
                type="file"
                accept={AUDIO_ACCEPT}
                multiple
                className="hidden"
                disabled={bulkUploading}
                onChange={handleBulkFilePick}
              />
            </label>

            {bulkProgress && (
              <p className="text-xs text-brand-muted">
                {bulkUploading
                  ? `Nahrávam ${bulkProgress.done + 1}/${bulkProgress.total}${bulkProgress.label ? `: ${bulkProgress.label}` : ""}…`
                  : `Hotovo ${bulkProgress.done}/${bulkProgress.total}.`}
              </p>
            )}

            {bulkRows.length > 0 && (
              <div className="space-y-2 max-h-48 overflow-y-auto rounded-lg border border-brand-border bg-brand-card/80 p-2">
                {bulkRows.map((row) => (
                  <div
                    key={`${row.file.name}-${row.file.size}`}
                    className={`text-xs px-2 py-1.5 rounded-md ${row.parseError ? "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300" : "bg-brand-surface text-brand-text"}`}
                  >
                    {row.parseError ? (
                      <>
                        <span className="font-semibold">{row.file.name}</span> — {row.parseError}
                      </>
                    ) : (
                      <>
                        <span className="text-brand-muted">{row.file.name}</span>
                        <span className="mx-1.5">→</span>
                        <span className="font-semibold">{row.artist}</span>
                        <span className="text-brand-muted"> · </span>
                        <span>{row.title}</span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            {bulkRows.length > 0 && (
              <button
                type="button"
                disabled={bulkUploading || bulkReadyCount === 0}
                onClick={runBulkUpload}
                className="btn-outline text-sm py-2 px-4 disabled:opacity-50"
              >
                {bulkUploading
                  ? "Pridávam do banky…"
                  : `Nahrať a pridať ${bulkReadyCount} skladieb`}
              </button>
            )}

            {bulkErrors.length > 0 && (
              <ul className="text-xs text-red-600 dark:text-red-400 space-y-1 list-disc pl-4">
                {bulkErrors.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center" aria-hidden>
              <div className="w-full border-t border-brand-border" />
            </div>
            <p className="relative text-center text-[11px] uppercase tracking-wider text-brand-muted bg-brand-card px-2 mx-auto w-fit">
              alebo jedna skladba ručne
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Interpret</label>
              <input className="input text-sm py-2" value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="napr. Queen" />
            </div>
            <div>
              <label className="label">Názov skladby</label>
              <input className="input text-sm py-2" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="napr. Bohemian Rhapsody" />
            </div>
          </div>
          <AudioUrlField
            value={audioUrl}
            onChange={setAudioUrl}
            onUploadError={(text) => onMessage?.(text, false)}
            onUploadSuccess={(text) => onMessage?.(text, true)}
          />
          <div>
            <label className="label">Poznámka pre teba (voliteľné, platí aj pre hromadný upload)</label>
            <input className="input text-sm py-2" value={note} onChange={(e) => setNote(e.target.value)} placeholder="napr. začína od refrénu" />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="button"
            disabled={submitting || bulkUploading}
            onClick={handleSubmit}
            className="btn-primary text-sm py-2.5 px-5 inline-flex items-center gap-2 disabled:opacity-60"
          >
            <Plus className="w-4 h-4" />
            {submitting ? "Ukladám…" : "Pridať jednu skladbu"}
          </button>
        </div>
      )}
    </div>
  );
}
