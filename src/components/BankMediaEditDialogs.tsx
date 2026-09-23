"use client";

import { useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import AudioUrlField from "@/components/admin/AudioUrlField";
import VideoUrlField from "@/components/admin/VideoUrlField";
import type { MusicBankItem } from "@/lib/music-bank";
import { updateMusicBankItemAsync } from "@/lib/music-bank-client";
import type { SoundBankItem } from "@/lib/sound-bank";
import { updateSoundBankItemAsync } from "@/lib/sound-bank-client";
import type { VideoBankItem } from "@/lib/video-bank";
import { updateVideoBankItemAsync } from "@/lib/video-bank-client";
import { formatTagsInput, parseTagsInput } from "@/lib/quiz-question-tags";

function DialogShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-brand-border bg-brand-card shadow-2xl p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 p-2 rounded-lg hover:bg-brand-warm text-brand-muted"
          aria-label="Zavrieť"
        >
          <X className="w-5 h-5" />
        </button>
        <h2 className="font-semibold text-brand-text pr-8">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function EditSoundClipDialog({
  clip,
  onClose,
  onSaved,
}: {
  clip: SoundBankItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [label, setLabel] = useState("");
  const [answer, setAnswer] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!clip) return;
    setLabel(clip.label);
    setAnswer(clip.answer);
    setAudioUrl(clip.audioUrl);
    setNote(clip.note ?? "");
    setError("");
  }, [clip]);

  if (!clip) return null;

  const save = async () => {
    setError("");
    setSubmitting(true);
    try {
      await updateSoundBankItemAsync(clip.id, {
        label: label.trim(),
        answer: answer.trim(),
        audioUrl: audioUrl.trim(),
        note: note.trim() || undefined,
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Uloženie zlyhalo.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DialogShell title="Upraviť zvukovú ukážku" onClose={onClose}>
      <div>
        <label className="label">Popis</label>
        <input className="input text-sm py-2" value={label} onChange={(e) => setLabel(e.target.value)} />
      </div>
      <div>
        <label className="label">Odpoveď</label>
        <input className="input text-sm py-2" value={answer} onChange={(e) => setAnswer(e.target.value)} />
      </div>
      <AudioUrlField value={audioUrl} onChange={setAudioUrl} />
      <div>
        <label className="label">Poznámka</label>
        <input className="input text-sm py-2" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onClose} className="btn-outline text-sm py-2 flex-1">
          Zrušiť
        </button>
        <button type="button" disabled={submitting} onClick={save} className="btn-primary text-sm py-2 flex-1">
          {submitting ? "Ukladám…" : "Uložiť"}
        </button>
      </div>
    </DialogShell>
  );
}

export function EditVideoClipDialog({
  clip,
  onClose,
  onSaved,
}: {
  clip: VideoBankItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [label, setLabel] = useState("");
  const [answer, setAnswer] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!clip) return;
    setLabel(clip.label);
    setAnswer(clip.answer);
    setVideoUrl(clip.videoUrl);
    setNote(clip.note ?? "");
    setError("");
  }, [clip]);

  if (!clip) return null;

  const save = async () => {
    setError("");
    setSubmitting(true);
    try {
      await updateVideoBankItemAsync(clip.id, {
        label: label.trim(),
        answer: answer.trim(),
        videoUrl: videoUrl.trim(),
        note: note.trim() || undefined,
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Uloženie zlyhalo.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DialogShell title="Upraviť video ukážku" onClose={onClose}>
      <div>
        <label className="label">Popis</label>
        <input className="input text-sm py-2" value={label} onChange={(e) => setLabel(e.target.value)} />
      </div>
      <div>
        <label className="label">Odpoveď</label>
        <input className="input text-sm py-2" value={answer} onChange={(e) => setAnswer(e.target.value)} />
      </div>
      <VideoUrlField value={videoUrl} onChange={setVideoUrl} />
      <div>
        <label className="label">Poznámka</label>
        <input className="input text-sm py-2" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onClose} className="btn-outline text-sm py-2 flex-1">
          Zrušiť
        </button>
        <button type="button" disabled={submitting} onClick={save} className="btn-primary text-sm py-2 flex-1">
          {submitting ? "Ukladám…" : "Uložiť"}
        </button>
      </div>
    </DialogShell>
  );
}

export function EditMusicTrackDialog({
  track,
  onClose,
  onSaved,
}: {
  track: MusicBankItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [artist, setArtist] = useState("");
  const [title, setTitle] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [note, setNote] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!track) return;
    setArtist(track.artist);
    setTitle(track.title);
    setAudioUrl(track.audioUrl);
    setNote(track.note ?? "");
    setTagsText(formatTagsInput(track.tags));
    setError("");
  }, [track]);

  if (!track) return null;

  const save = async () => {
    setError("");
    setSubmitting(true);
    try {
      await updateMusicBankItemAsync(track.id, {
        artist: artist.trim(),
        title: title.trim(),
        audioUrl: audioUrl.trim(),
        note: note.trim() || undefined,
        tags: parseTagsInput(tagsText),
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Uloženie zlyhalo.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DialogShell title="Upraviť skladbu v banke hudby" onClose={onClose}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Interpret</label>
          <input className="input text-sm py-2" value={artist} onChange={(e) => setArtist(e.target.value)} />
        </div>
        <div>
          <label className="label">Skladba</label>
          <input className="input text-sm py-2" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
      </div>
      <AudioUrlField value={audioUrl} onChange={setAudioUrl} />
      <div>
        <label className="label">Tagy (jazyk, štýl, dekáda…)</label>
        <input className="input text-sm py-2" value={tagsText} onChange={(e) => setTagsText(e.target.value)} />
      </div>
      <div>
        <label className="label">Poznámka</label>
        <input className="input text-sm py-2" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onClose} className="btn-outline text-sm py-2 flex-1">
          Zrušiť
        </button>
        <button type="button" disabled={submitting} onClick={save} className="btn-primary text-sm py-2 flex-1">
          {submitting ? "Ukladám…" : "Uložiť"}
        </button>
      </div>
    </DialogShell>
  );
}
