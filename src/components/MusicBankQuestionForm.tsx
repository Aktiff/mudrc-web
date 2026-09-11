"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Plus } from "lucide-react";
import AudioUrlField from "@/components/admin/AudioUrlField";
import { addMusicBankItemAsync } from "@/lib/music-bank-client";

type Props = {
  onAdded?: () => void;
  onMessage?: (text: string, ok: boolean) => void;
};

export default function MusicBankQuestionForm({ onAdded, onMessage }: Props) {
  const [open, setOpen] = useState(false);
  const [artist, setArtist] = useState("");
  const [title, setTitle] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

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
      await addMusicBankItemAsync({
        artist: artist.trim(),
        title: title.trim(),
        audioUrl: audioUrl.trim(),
        note: note.trim() || undefined,
      });
      setArtist("");
      setTitle("");
      setAudioUrl("");
      setNote("");
      onMessage?.("Skladba pridaná do banky hudby.", true);
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
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-brand-warm/50 transition-colors"
      >
        <div>
          <p className="font-semibold text-brand-text text-sm">Pridať skladbu do banky hudby</p>
          <p className="text-brand-muted text-xs mt-0.5">
            ~30 s ukážka · 1 bod interpret · 1 bod názov piesne · pre 4. kolo (hudobné ukážky)
          </p>
        </div>
        {open ? <ChevronUp className="w-5 h-5 text-brand-muted shrink-0" /> : <ChevronDown className="w-5 h-5 text-brand-muted shrink-0" />}
      </button>

      {open && (
        <div className="px-5 pb-5 pt-0 space-y-4 border-t border-brand-border">
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
            <label className="label">Poznámka pre teba (voliteľné)</label>
            <input className="input text-sm py-2" value={note} onChange={(e) => setNote(e.target.value)} placeholder="napr. začína od refrénu" />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="button"
            disabled={submitting}
            onClick={handleSubmit}
            className="btn-primary text-sm py-2.5 px-5 inline-flex items-center gap-2 disabled:opacity-60"
          >
            <Plus className="w-4 h-4" />
            {submitting ? "Ukladám…" : "Pridať do banky hudby"}
          </button>
        </div>
      )}
    </div>
  );
}
