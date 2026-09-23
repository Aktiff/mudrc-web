"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import MusicBankTagFilters from "@/components/MusicBankTagFilters";
import {
  EditMusicTrackDialog,
  EditSoundClipDialog,
  EditVideoClipDialog,
} from "@/components/BankMediaEditDialogs";
import EditCustomBankQuestionDialog from "@/components/EditCustomBankQuestionDialog";
import {
  countTextBankSources,
  filterTextBankBySource,
  getFullTextBankQuestions,
  type TextBankSourceFilter,
} from "@/lib/quiz-bank-text";
import {
  fetchCustomBankQuestionsFromServer,
  isCustomBankQuestionId,
  isGeneratedBankQuestion,
  removeCustomBankQuestionAsync,
  type CustomBankQuestion,
} from "@/lib/quiz-custom-bank";
import {
  readHiddenBankQuestionIds,
  writeHiddenBankQuestionIds,
} from "@/lib/quiz-question-bank";
import { formatMusicBankTagsLabel, type MusicBankItem } from "@/lib/music-bank";
import {
  EMPTY_MUSIC_BANK_TAG_FILTERS,
  filterMusicBankTracks,
  musicTagFiltersActive,
} from "@/lib/music-bank-filters";
import {
  fetchMusicBankFromServer,
  refreshMusicTrackAutoTagsAsync,
  removeMusicBankItemAsync,
} from "@/lib/music-bank-client";
import type { SoundBankItem } from "@/lib/sound-bank";
import { fetchSoundBankFromServer, removeSoundBankItemAsync } from "@/lib/sound-bank-client";
import type { VideoBankItem } from "@/lib/video-bank";
import { fetchVideoBankFromServer, removeVideoBankItemAsync } from "@/lib/video-bank-client";

type Tab = "questions" | "sound" | "video" | "music";

type Props = {
  refreshKey?: number;
  onChanged?: () => void;
  /** Keď je rodič sticky panel (celá výška), zoznam sa roztiahne a scrolluje vo vnútri. */
  fillHeight?: boolean;
};

export default function QuestionBankInventory({ refreshKey = 0, onChanged, fillHeight = false }: Props) {
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
  const [musicFilters, setMusicFilters] = useState(EMPTY_MUSIC_BANK_TAG_FILTERS);
  const [refreshingTagId, setRefreshingTagId] = useState<string | null>(null);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [questionSourceFilter, setQuestionSourceFilter] = useState<TextBankSourceFilter>("all");

  useEffect(() => {
    setHiddenIds(readHiddenBankQuestionIds());
  }, []);

  const fullTextBank = useMemo(
    () => getFullTextBankQuestions(questions, hiddenIds),
    [questions, hiddenIds]
  );

  const textBankCounts = useMemo(() => countTextBankSources(fullTextBank), [fullTextBank]);

  const visibleTextQuestions = useMemo(
    () => filterTextBankBySource(fullTextBank, questionSourceFilter),
    [fullTextBank, questionSourceFilter]
  );

  const filteredMusic = useMemo(
    () => filterMusicBankTracks(music, musicFilters),
    [music, musicFilters]
  );

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
    { id: "questions", label: "Otázky", count: textBankCounts.all },
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

  const hideGeneratedQuestion = (bankId: string) => {
    if (!window.confirm("Skryť túto vygenerovanú otázku v banke? (Zmizne aj pri vkladaní kvízu.)")) return;
    const next = Array.from(new Set([...hiddenIds, bankId]));
    setHiddenIds(next);
    writeHiddenBankQuestionIds(next);
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

  const refreshMusicTags = async (id: string) => {
    setRefreshingTagId(id);
    try {
      await refreshMusicTrackAutoTagsAsync(id);
      afterEdit();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Obnova tagov zlyhala.");
    } finally {
      setRefreshingTagId(null);
    }
  };

  return (
    <div
      className={`bg-brand-card border border-brand-border rounded-2xl overflow-hidden min-w-0 max-w-full ${
        fillHeight ? "flex flex-col h-full min-h-[min(420px,55vh)] lg:min-h-0" : ""
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-brand-border shrink-0">
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

      <div className="flex flex-wrap gap-1 p-2 border-b border-brand-border bg-brand-warm/40 shrink-0">
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

      {tab === "questions" && textBankCounts.all > 0 && (
        <div className="px-4 sm:px-5 py-3 border-b border-brand-border bg-brand-warm/20 shrink-0 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["all", "Všetky", textBankCounts.all],
                ["custom", "Moje otázky", textBankCounts.custom],
                ["generated", "Vygenerované", textBankCounts.generated],
              ] as const
            ).map(([key, label, count]) => (
              <button
                key={key}
                type="button"
                onClick={() => setQuestionSourceFilter(key)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                  questionSourceFilter === key
                    ? "bg-brand-orange text-brand-btn-fg border-brand-orange"
                    : "border-brand-border text-brand-muted hover:border-brand-orange"
                }`}
              >
                {label} ({count})
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === "music" && music.length > 0 && (
        <div className="px-4 sm:px-5 py-3 border-b border-brand-border bg-brand-warm/20 shrink-0 space-y-2">
          <MusicBankTagFilters tracks={music} value={musicFilters} onChange={setMusicFilters} />
          {musicTagFiltersActive(musicFilters) && (
            <p className="text-[11px] text-brand-muted">
              Zobrazených {filteredMusic.length} z {music.length} skladieb
            </p>
          )}
        </div>
      )}

      <div
        className={`p-4 sm:p-5 overflow-y-auto ${
          fillHeight ? "flex-1 min-h-0" : "max-h-[min(520px,55vh)]"
        }`}
      >
        {loading ? (
          <p className="text-sm text-brand-muted text-center py-8">Načítavam…</p>
        ) : tab === "questions" ? (
          textBankCounts.all === 0 ? (
            <p className="text-sm text-brand-muted text-center py-8">V banke zatiaľ nie sú textové otázky.</p>
          ) : visibleTextQuestions.length === 0 ? (
            <p className="text-sm text-brand-muted text-center py-8">V tomto filtri nie sú otázky.</p>
          ) : (
            <ul className="space-y-3">
              {visibleTextQuestions.map((q) => {
                const isCustom = isCustomBankQuestionId(q.id);
                const isGenerated = isGeneratedBankQuestion(q);
                return (
                <li key={q.id} className="rounded-xl border border-brand-border bg-brand-surface/50 p-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {isCustom && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-brand-orange/15 text-brand-orange-readable border border-brand-orange/40">
                        moja otázka
                      </span>
                    )}
                    {isGenerated && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border border-brand-border bg-brand-card text-brand-muted">
                        vygenerovaná
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-brand-text leading-snug">{q.body}</p>
                  {q.tags.length > 0 && (
                    <p className="text-[11px] text-brand-muted">{q.tags.join(" · ")}</p>
                  )}
                  <p className="text-xs text-brand-muted">
                    {q.isOpenQuestion ? `Odpoveď: ${q.answer}` : `Správne: ${q.options[q.correctIndex] || q.answer}`}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {isCustom ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setEditQuestion(q as CustomBankQuestion)}
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
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => hideGeneratedQuestion(q.id)}
                        className="btn-outline text-xs py-1.5 px-2 text-red-600 border-red-200 inline-flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" /> Skryť
                      </button>
                    )}
                  </div>
                </li>
                );
              })}
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
        ) : filteredMusic.length === 0 ? (
          <p className="text-sm text-brand-muted text-center py-8">Žiadna skladba nevyhovuje filtrom.</p>
        ) : (
          <ul className="space-y-3">
            {filteredMusic.map((track) => (
              <li key={track.id} className="rounded-xl border border-brand-border p-3 space-y-2">
                <p className="text-sm font-semibold">
                  {track.artist} — {track.title}
                </p>
                {track.tags?.length ? (
                  <p className="text-[11px] text-violet-800 dark:text-violet-200">{formatMusicBankTagsLabel(track.tags)}</p>
                ) : (
                  <p className="text-[11px] text-amber-700 dark:text-amber-300">Tagy chýbajú alebo sú neúplné</p>
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={refreshingTagId === track.id}
                    onClick={() => void refreshMusicTags(track.id)}
                    className="btn-outline text-xs py-1.5 px-2 inline-flex items-center gap-1"
                    title="Fuzzy vyhľadanie (iTunes, Deezer, MusicBrainz) — netreba presný názov"
                  >
                    <Sparkles className="w-3 h-3" />
                    {refreshingTagId === track.id ? "Hľadám…" : "Doplniť tagy"}
                  </button>
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
