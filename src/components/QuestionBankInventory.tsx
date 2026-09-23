"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, RefreshCw, Trash2 } from "lucide-react";
import {
  EditMusicTrackDialog,
  EditSoundClipDialog,
  EditVideoClipDialog,
} from "@/components/BankMediaEditDialogs";
import EditCustomBankQuestionDialog from "@/components/EditCustomBankQuestionDialog";
import {
  fetchCustomBankQuestionsFromServer,
  isCustomBankQuestionId,
  removeCustomBankQuestionAsync,
  type CustomBankQuestion,
} from "@/lib/quiz-custom-bank";
import { formatMusicBankTagsLabel, type MusicBankItem } from "@/lib/music-bank";
import { fetchMusicBankFromServer, removeMusicBankItemAsync } from "@/lib/music-bank-client";
import type { SoundBankItem } from "@/lib/sound-bank";
import { fetchSoundBankFromServer, removeSoundBankItemAsync } from "@/lib/sound-bank-client";
import type { VideoBankItem } from "@/lib/video-bank";
import { fetchVideoBankFromServer, removeVideoBankItemAsync } from "@/lib/video-bank-client";

type Tab = "questions" | "sound" | "video" | "music";

type Props = {
  refreshKey?: number;
  onChanged?: () => void;
};

export default function QuestionBankInventory({ refreshKey = 0, onChanged }: Props) {
  const [tab, setTab] = useState<Tab>("questions");
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<CustomBankQuestion[]>([]);
  const [sound, setSound] = useState<SoundBankItem[]>([]);
  const [video, setVideo] = useState<VideoBankItem[]>([]);
  const [music, setMusic] = useState<MusicBankItem[]>([]);

  const [editQuestion, setEditQuestion] = useState<CustomBankQuestion | null>(null);
  const [editSound, setEditSound] = useState<SoundBankItem | null>(null);
  const [editVideo, setEditVideo] = useState<VideoBankItem | null>(null);
  const [editMusic, setEditMusic] = useState<MusicBankItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [q, s, v, m] = await Promise.all([
      fetchCustomBankQuestionsFromServer(),
      fetchSoundBankFromServer(),
      fetchVideoBankFromServer(),
      fetchMusicBankFromServer(),
    ]);
    setQuestions(q.filter((item) => isCustomBankQuestionId(item.id)));
    setSound(s);
    setVideo(v);
    setMusic(m);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "questions", label: "Otázky", count: questions.length },
    { id: "sound", label: "Zvuk", count: sound.length },
    { id: "video", label: "Video", count: video.length },
    { id: "music", label: "Hudba", count: music.length },
  ];

  const afterEdit = () => {
    void load();
    onChanged?.();
  };

  const removeQuestion = async (id: string) => {
    if (!window.confirm("Odstrániť otázku z banky?")) return;
    await removeCustomBankQuestionAsync(id);
    afterEdit();
  };

  const removeSound = async (id: string) => {
    if (!window.confirm("Odstrániť zvuk z banky?")) return;
    await removeSoundBankItemAsync(id);
    afterEdit();
  };

  const removeVideo = async (id: string) => {
    if (!window.confirm("Odstrániť video z banky?")) return;
    await removeVideoBankItemAsync(id);
    afterEdit();
  };

  const removeMusic = async (id: string) => {
    if (!window.confirm("Odstrániť skladbu z banky?")) return;
    await removeMusicBankItemAsync(id);
    afterEdit();
  };

  return (
    <div className="bg-brand-card border border-brand-border rounded-2xl overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-brand-border">
        <div>
          <p className="font-semibold text-brand-text">Obsah banky</p>
          <p className="text-brand-muted text-xs mt-0.5">Prehľad a úpravy uložených položiek</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="btn-outline text-xs py-2 px-3 inline-flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Obnoviť
        </button>
      </div>

      <div className="flex flex-wrap gap-1 p-2 border-b border-brand-border bg-brand-warm/40">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`text-xs font-semibold px-3 py-2 rounded-lg transition-colors ${
              tab === t.id
                ? "bg-brand-orange text-brand-btn-fg"
                : "text-brand-muted hover:bg-brand-card"
            }`}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      <div className="p-4 sm:p-5 max-h-[min(520px,55vh)] overflow-y-auto">
        {loading ? (
          <p className="text-sm text-brand-muted text-center py-8">Načítavam…</p>
        ) : tab === "questions" ? (
          questions.length === 0 ? (
            <p className="text-sm text-brand-muted text-center py-8">Zatiaľ žiadne vlastné otázky.</p>
          ) : (
            <ul className="space-y-3">
              {questions.map((q) => (
                <li key={q.id} className="rounded-xl border border-brand-border bg-brand-surface/50 p-3 space-y-2">
                  <p className="text-sm font-semibold text-brand-text leading-snug">{q.body}</p>
                  {q.tags.length > 0 && (
                    <p className="text-[11px] text-brand-muted">{q.tags.join(" · ")}</p>
                  )}
                  <p className="text-xs text-brand-muted">
                    {q.isOpenQuestion ? `Odpoveď: ${q.answer}` : `Správne: ${q.options[q.correctIndex] || q.answer}`}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditQuestion(q)}
                      className="btn-outline text-xs py-1.5 px-2 inline-flex items-center gap-1"
                    >
                      <Pencil className="w-3 h-3" /> Upraviť
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeQuestion(q.id)}
                      className="btn-outline text-xs py-1.5 px-2 text-red-600 border-red-200 inline-flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" /> Vymazať
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )
        ) : tab === "sound" ? (
          sound.length === 0 ? (
            <p className="text-sm text-brand-muted text-center py-8">Zatiaľ žiadny zvuk.</p>
          ) : (
            <ul className="space-y-3">
              {sound.map((clip) => (
                <li key={clip.id} className="rounded-xl border border-brand-border p-3 space-y-2">
                  <p className="text-sm font-semibold">{clip.label}</p>
                  <p className="text-xs text-brand-muted">Odpoveď: {clip.answer}</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setEditSound(clip)} className="btn-outline text-xs py-1.5 px-2 inline-flex items-center gap-1">
                      <Pencil className="w-3 h-3" /> Upraviť
                    </button>
                    <button type="button" onClick={() => void removeSound(clip.id)} className="btn-outline text-xs py-1.5 px-2 text-red-600 inline-flex items-center gap-1">
                      <Trash2 className="w-3 h-3" /> Vymazať
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )
        ) : tab === "video" ? (
          video.length === 0 ? (
            <p className="text-sm text-brand-muted text-center py-8">Zatiaľ žiadne video.</p>
          ) : (
            <ul className="space-y-3">
              {video.map((clip) => (
                <li key={clip.id} className="rounded-xl border border-brand-border p-3 space-y-2">
                  <p className="text-sm font-semibold">{clip.label}</p>
                  <p className="text-xs text-brand-muted">Odpoveď: {clip.answer}</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setEditVideo(clip)} className="btn-outline text-xs py-1.5 px-2 inline-flex items-center gap-1">
                      <Pencil className="w-3 h-3" /> Upraviť
                    </button>
                    <button type="button" onClick={() => void removeVideo(clip.id)} className="btn-outline text-xs py-1.5 px-2 text-red-600 inline-flex items-center gap-1">
                      <Trash2 className="w-3 h-3" /> Vymazať
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )
        ) : music.length === 0 ? (
          <p className="text-sm text-brand-muted text-center py-8">Zatiaľ žiadna hudba.</p>
        ) : (
          <ul className="space-y-3">
            {music.map((track) => (
              <li key={track.id} className="rounded-xl border border-brand-border p-3 space-y-2">
                <p className="text-sm font-semibold">
                  {track.artist} — {track.title}
                </p>
                {track.tags?.length ? (
                  <p className="text-[11px] text-violet-800 dark:text-violet-200">{formatMusicBankTagsLabel(track.tags)}</p>
                ) : null}
                <div className="flex gap-2">
                  <button type="button" onClick={() => setEditMusic(track)} className="btn-outline text-xs py-1.5 px-2 inline-flex items-center gap-1">
                    <Pencil className="w-3 h-3" /> Upraviť
                  </button>
                  <button type="button" onClick={() => void removeMusic(track.id)} className="btn-outline text-xs py-1.5 px-2 text-red-600 inline-flex items-center gap-1">
                    <Trash2 className="w-3 h-3" /> Vymazať
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <EditCustomBankQuestionDialog
        question={editQuestion}
        onClose={() => setEditQuestion(null)}
        onSaved={afterEdit}
      />
      <EditSoundClipDialog clip={editSound} onClose={() => setEditSound(null)} onSaved={afterEdit} />
      <EditVideoClipDialog clip={editVideo} onClose={() => setEditVideo(null)} onSaved={afterEdit} />
      <EditMusicTrackDialog track={editMusic} onClose={() => setEditMusic(null)} onSaved={afterEdit} />
    </div>
  );
}
