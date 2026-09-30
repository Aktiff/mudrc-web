"use client";

import { useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import AudioUrlField from "@/components/admin/AudioUrlField";
import VideoUrlField from "@/components/admin/VideoUrlField";
import { splitClipIntoArtistTitle, type MusicBankItem } from "@/lib/music-bank";
import { addMusicBankItemAsync, refreshMusicTrackAutoTagsAsync, removeMusicBankItemAsync, updateMusicBankItemAsync } from "@/lib/music-bank-client";
import { composeMusicTags, MANUAL_MUSIC_DECADE_TAGS, musicTrackMetaFields } from "@/lib/music-bank-filters";
import { MUSIC_LANGUAGE_TAGS, MUSIC_STYLE_TAGS } from "@/lib/music-track-metadata";
import type { SoundBankItem } from "@/lib/sound-bank";
import { addSoundBankItemAsync, removeSoundBankItemAsync, updateSoundBankItemAsync } from "@/lib/sound-bank-client";
import type { VideoBankItem } from "@/lib/video-bank";
import { updateVideoBankItemAsync } from "@/lib/video-bank-client";

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
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-brand-border bg-brand-card shadow-2xl p-5 space-y-4"
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

type AudioKind = "music" | "other";

function withCurrentOption(options: readonly string[], current: string): string[] {
  const list = [...options];
  if (current && !list.includes(current)) list.unshift(current);
  return list;
}

function AudioKindSwitch({
  kind,
  onChange,
}: {
  kind: AudioKind;
  onChange: (next: AudioKind) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {(
        [
          ["music", "Hudobná ukážka"],
          ["other", "Iná ukážka"],
        ] as const
      ).map(([key, label]) => (
        <button
          key={key}
          type="button"
          aria-pressed={kind === key}
          onClick={() => onChange(key)}
          className={`text-xs font-semibold px-3 py-2 rounded-lg border transition-colors ${
            kind === key
              ? "bg-sky-700 text-white border-sky-700"
              : "border-brand-border text-brand-muted hover:border-sky-400"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function MusicTagFields({
  language,
  style,
  decade,
  onLanguage,
  onStyle,
  onDecade,
}: {
  language: string;
  style: string;
  decade: string;
  onLanguage: (value: string) => void;
  onStyle: (value: string) => void;
  onDecade: (value: string) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div>
        <label className="label">Jazyk</label>
        <select className="input text-sm py-2 w-full" value={language} onChange={(e) => onLanguage(e.target.value)}>
          <option value="">—</option>
          {withCurrentOption(MUSIC_LANGUAGE_TAGS, language).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Štýl</label>
        <select className="input text-sm py-2 w-full" value={style} onChange={(e) => onStyle(e.target.value)}>
          <option value="">—</option>
          {withCurrentOption(MUSIC_STYLE_TAGS, style).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Dekáda</label>
        <select className="input text-sm py-2 w-full" value={decade} onChange={(e) => onDecade(e.target.value)}>
          <option value="">—</option>
          {withCurrentOption(MANUAL_MUSIC_DECADE_TAGS, decade).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function AudioBankEditForm({
  sourceId,
  sourceKind,
  initialLabel,
  initialAnswer,
  initialArtist,
  initialTitle,
  initialAudioUrl,
  initialNote,
  initialLanguage,
  initialStyle,
  initialDecade,
  onClose,
  onSaved,
}: {
  sourceId: string;
  sourceKind: AudioKind;
  initialLabel: string;
  initialAnswer: string;
  initialArtist: string;
  initialTitle: string;
  initialAudioUrl: string;
  initialNote: string;
  initialLanguage: string;
  initialStyle: string;
  initialDecade: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [kind, setKind] = useState<AudioKind>(sourceKind);
  const [label, setLabel] = useState(initialLabel);
  const [answer, setAnswer] = useState(initialAnswer);
  const [artist, setArtist] = useState(initialArtist);
  const [title, setTitle] = useState(initialTitle);
  const [audioUrl, setAudioUrl] = useState(initialAudioUrl);
  const [note, setNote] = useState(initialNote);
  const [language, setLanguage] = useState(initialLanguage);
  const [style, setStyle] = useState(initialStyle);
  const [decade, setDecade] = useState(initialDecade);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [refreshingTags, setRefreshingTags] = useState(false);

  const switchKind = (next: AudioKind) => {
    if (next === kind) return;
    if (next === "music") {
      const split = splitClipIntoArtistTitle(label, answer);
      setArtist(split.artist);
      setTitle(split.title);
    } else {
      setLabel(artist);
      setAnswer(title);
    }
    setKind(next);
  };

  const refreshTags = async () => {
    if (sourceKind !== "music") return;
    setError("");
    setRefreshingTags(true);
    try {
      const updated = await refreshMusicTrackAutoTagsAsync(sourceId);
      const meta = musicTrackMetaFields(updated.tags);
      setLanguage(meta.language === "nezistený" ? "" : meta.language);
      setStyle(meta.style === "nezistený" ? "" : meta.style);
      setDecade(meta.decade === "nezistená" ? "" : meta.decade);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Obnova tagov zlyhala.");
    } finally {
      setRefreshingTags(false);
    }
  };

  const save = async () => {
    setError("");
    const url = audioUrl.trim();
    if (!url) {
      setError("Nahraj alebo vlož URL audio.");
      return;
    }
    setSubmitting(true);
    try {
      if (kind === "music") {
        const nextArtist = artist.trim();
        const nextTitle = title.trim();
        if (!nextArtist || !nextTitle) {
          setError("Vyplň interpreta a názov skladby.");
          setSubmitting(false);
          return;
        }
        const tags = composeMusicTags({ language, style, decade });
        if (sourceKind === "music") {
          await updateMusicBankItemAsync(sourceId, {
            artist: nextArtist,
            title: nextTitle,
            audioUrl: url,
            note: note.trim() || undefined,
            tags,
          });
        } else {
          await addMusicBankItemAsync({
            artist: nextArtist,
            title: nextTitle,
            audioUrl: url,
            note: note.trim() || undefined,
            tags,
          });
          await removeSoundBankItemAsync(sourceId);
        }
      } else {
        const nextLabel = label.trim();
        const nextAnswer = answer.trim();
        if (!nextLabel || !nextAnswer) {
          setError("Vyplň popis a správnu odpoveď.");
          setSubmitting(false);
          return;
        }
        if (sourceKind === "other") {
          await updateSoundBankItemAsync(sourceId, {
            label: nextLabel,
            answer: nextAnswer,
            audioUrl: url,
            note: note.trim() || undefined,
          });
        } else {
          await addSoundBankItemAsync({
            label: nextLabel,
            answer: nextAnswer,
            audioUrl: url,
            note: note.trim() || undefined,
          });
          await removeMusicBankItemAsync(sourceId);
        }
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Uloženie zlyhalo.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DialogShell title="Upraviť ukážku" onClose={onClose}>
      <AudioKindSwitch kind={kind} onChange={switchKind} />
      {kind === "music" ? (
        <>
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
          <MusicTagFields
            language={language}
            style={style}
            decade={decade}
            onLanguage={setLanguage}
            onStyle={setStyle}
            onDecade={setDecade}
          />
          {sourceKind === "music" && (
            <button
              type="button"
              disabled={refreshingTags || submitting}
              onClick={() => void refreshTags()}
              className="text-xs font-semibold text-brand-orange-readable hover:underline text-left"
            >
              {refreshingTags ? "Hľadám online…" : "Doplniť jazyk, štýl a dekádu online"}
            </button>
          )}
        </>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Popis</label>
            <input className="input text-sm py-2" value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div>
            <label className="label">Odpoveď</label>
            <input className="input text-sm py-2" value={answer} onChange={(e) => setAnswer(e.target.value)} />
          </div>
        </div>
      )}
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
        <button type="button" disabled={submitting} onClick={() => void save()} className="btn-primary text-sm py-2 flex-1">
          {submitting ? "Ukladám…" : "Uložiť"}
        </button>
      </div>
    </DialogShell>
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
  if (!clip) return null;
  const split = splitClipIntoArtistTitle(clip.label, clip.answer);
  return (
    <AudioBankEditForm
      key={clip.id}
      sourceId={clip.id}
      sourceKind="other"
      initialLabel={clip.label}
      initialAnswer={clip.answer}
      initialArtist={split.artist}
      initialTitle={split.title}
      initialAudioUrl={clip.audioUrl}
      initialNote={clip.note ?? ""}
      initialLanguage=""
      initialStyle=""
      initialDecade=""
      onClose={onClose}
      onSaved={onSaved}
    />
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
  if (!track) return null;
  const meta = musicTrackMetaFields(track.tags);
  return (
    <AudioBankEditForm
      key={track.id}
      sourceId={track.id}
      sourceKind="music"
      initialLabel={track.artist}
      initialAnswer={track.title}
      initialArtist={track.artist}
      initialTitle={track.title}
      initialAudioUrl={track.audioUrl}
      initialNote={track.note ?? ""}
      initialLanguage={meta.language === "nezistený" ? "" : meta.language}
      initialStyle={meta.style === "nezistený" ? "" : meta.style}
      initialDecade={meta.decade === "nezistená" ? "" : meta.decade}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}
