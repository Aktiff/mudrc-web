"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pencil, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import MusicBankTagFilters from "@/components/MusicBankTagFilters";
import {
  EditMusicTrackDialog,
  EditSoundClipDialog,
  EditVideoClipDialog,
} from "@/components/BankMediaEditDialogs";
import EditCustomBankQuestionDialog from "@/components/EditCustomBankQuestionDialog";
import BankMediaPreview from "@/components/BankMediaPreview";
import { BankThemeFilters } from "@/components/BankThemeControls";
import { bankQuestionTheme, DEFAULT_BANK_THEME, DEFAULT_BANK_THEMES, mergeBankThemes } from "@/lib/bank-themes";
import { sameQuizQuestionVariant } from "@/lib/quiz-library";
import { fetchBankThemes } from "@/lib/bank-themes-client";
import {
  countTextBankSources,
  excludeQuestionsUsedByBody,
  filterTextBankBySource,
  getInsertableTextBankQuestions,
  type TextBankSourceFilter,
} from "@/lib/quiz-bank-text";
import {
  fetchCustomBankQuestionsFromServer,
  isCustomBankQuestionId,
  isGeneratedBankQuestion,
  customQuestionHasPhoto,
  readDeletedCustomBankIds,
  removeCustomBankQuestionAsync,
  type CustomBankQuestion,
} from "@/lib/quiz-custom-bank";
import {
  readHiddenBankQuestionIds,
  writeHiddenBankQuestionIds,
} from "@/lib/quiz-question-bank";
import { type MusicBankItem } from "@/lib/music-bank";
import {
  EMPTY_MUSIC_BANK_TAG_FILTERS,
  filterMusicBankTracks,
  musicTagFiltersActive,
  musicTrackMetaFields,
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
  /** Práve uložená otázka — zobrazí sa hneď, aj keď neskoršie načítanie ešte nevie o nej. */
  addedQuestion?: CustomBankQuestion | null;
  addedNonce?: number;
  /** Keď je rodič sticky panel (celá výška), zoznam sa roztiahne a scrolluje vo vnútri. */
  fillHeight?: boolean;
};

export default function QuestionBankInventory({
  refreshKey = 0,
  onChanged,
  addedQuestion = null,
  addedNonce = 0,
  fillHeight = false,
}: Props) {
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
  const [usedIds, setUsedIds] = useState<string[]>([]);
  const [usedBodies, setUsedBodies] = useState<string[]>([]);
  const [questionSourceFilter, setQuestionSourceFilter] = useState<TextBankSourceFilter>("custom");
  const [customKind, setCustomKind] = useState<"text" | "photo">("text");
  const [questionTheme, setQuestionTheme] = useState<string>(DEFAULT_BANK_THEME);
  const [bankThemes, setBankThemes] = useState<string[]>([...DEFAULT_BANK_THEMES]);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const removedIdsRef = useRef(new Set<string>());
  const [pinned, setPinned] = useState<CustomBankQuestion[]>([]);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const pendingAdded = useRef<CustomBankQuestion[]>([]);
  const reinjected = useRef(new Set<string>());
  const loadSeq = useRef(0);
  const loadedOnce = useRef(false);

  useEffect(() => {
    setHiddenIds(readHiddenBankQuestionIds());
  }, []);

  const removedIdSet = useMemo(() => new Set(removedIds), [removedIds]);

  const sourceQuestions = useMemo(() => {
    const byId = new Map<string, CustomBankQuestion>();
    for (const item of questions) byId.set(item.id, item);
    for (const item of pinned) {
      if (!removedIdSet.has(item.id)) byId.set(item.id, item);
    }
    if (addedQuestion && !removedIdSet.has(addedQuestion.id)) byId.set(addedQuestion.id, addedQuestion);
    for (const id of removedIds) byId.delete(id);
    for (const id of readDeletedCustomBankIds()) byId.delete(id);
    return Array.from(byId.values()).sort((a, b) => b.createdAt - a.createdAt);
  }, [questions, pinned, addedQuestion, removedIds, removedIdSet]);

  const usedIdSet = useMemo(() => new Set(usedIds), [usedIds]);

  const fullTextBank = useMemo(() => {
    const available = getInsertableTextBankQuestions(sourceQuestions, usedIds, hiddenIds);
    return excludeQuestionsUsedByBody(available, usedBodies);
  }, [sourceQuestions, hiddenIds, usedIds, usedBodies]);

  const availableSound = useMemo(
    () => sound.filter((clip) => !usedIdSet.has(clip.id)),
    [sound, usedIdSet]
  );
  const availableVideo = useMemo(
    () => video.filter((clip) => !usedIdSet.has(clip.id)),
    [video, usedIdSet]
  );
  const availableMusic = useMemo(
    () => music.filter((track) => !usedIdSet.has(track.id)),
    [music, usedIdSet]
  );

  const textBankCounts = useMemo(() => countTextBankSources(fullTextBank), [fullTextBank]);

  const visibleTextQuestions = useMemo(
    () => filterTextBankBySource(fullTextBank, questionSourceFilter),
    [fullTextBank, questionSourceFilter]
  );

  const themeChoices = useMemo(
    () => mergeBankThemes([...bankThemes, ...visibleTextQuestions.map((item) => bankQuestionTheme(item))]),
    [bankThemes, visibleTextQuestions]
  );
  const themeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const theme of themeChoices) counts[theme] = 0;
    for (const item of visibleTextQuestions) {
      const theme = bankQuestionTheme(item);
      counts[theme] = (counts[theme] ?? 0) + 1;
    }
    return counts;
  }, [themeChoices, visibleTextQuestions]);
  const themedTextQuestions = useMemo(
    () => visibleTextQuestions.filter((item) => bankQuestionTheme(item) === questionTheme),
    [visibleTextQuestions, questionTheme]
  );

  const shownTextQuestions = useMemo(() => {
    if (questionSourceFilter !== "custom") return themedTextQuestions;
    return themedTextQuestions.filter((item) =>
      customKind === "photo" ? customQuestionHasPhoto(item) : !customQuestionHasPhoto(item)
    );
  }, [themedTextQuestions, questionSourceFilter, customKind]);

  const customWithoutPhotoCount = useMemo(
    () =>
      questionSourceFilter === "custom"
        ? themedTextQuestions.filter((item) => !customQuestionHasPhoto(item)).length
        : 0,
    [themedTextQuestions, questionSourceFilter]
  );
  const customWithPhotoCount = useMemo(
    () =>
      questionSourceFilter === "custom"
        ? themedTextQuestions.filter((item) => customQuestionHasPhoto(item)).length
        : 0,
    [themedTextQuestions, questionSourceFilter]
  );

  const filteredMusic = useMemo(
    () => filterMusicBankTracks(availableMusic, musicFilters),
    [availableMusic, musicFilters]
  );

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    if (!loadedOnce.current) setLoading(true);
    const [q, s, v, m, quizRes, themes] = await Promise.all([
      fetchCustomBankQuestionsFromServer(),
      fetchSoundBankFromServer(),
      fetchVideoBankFromServer(),
      fetchMusicBankFromServer(),
      fetch(`/api/admin/quiz-library?usedKeys=1&_=${Date.now()}`, { cache: "no-store" }),
      fetchBankThemes(),
    ]);
    if (seq !== loadSeq.current) return;
    const used = quizRes.ok
      ? ((await quizRes.json()) as { usedBankQuestionIds?: unknown; usedBodies?: unknown })
      : {};
    const server = q.filter((item) => isCustomBankQuestionId(item.id) && !removedIdsRef.current.has(item.id));
    const serverIds = new Set(server.map((item) => item.id));
    const deletedNow = new Set(readDeletedCustomBankIds());
    const missing = pendingAdded.current.filter(
      (item) => !serverIds.has(item.id) && !removedIdsRef.current.has(item.id) && !deletedNow.has(item.id)
    );
    const toSave = missing.filter((item) => !reinjected.current.has(item.id));
    for (const item of toSave) reinjected.current.add(item.id);
    setQuestions([...missing, ...server.filter((item) => !missing.some((extra) => extra.id === item.id))]);
    setSound(s);
    setVideo(v);
    setMusic(m);
    setBankThemes(themes);
    setUsedIds(Array.isArray(used.usedBankQuestionIds) ? used.usedBankQuestionIds.filter((id) => typeof id === "string") : []);
    setUsedBodies(Array.isArray(used.usedBodies) ? used.usedBodies.filter((id) => typeof id === "string") : []);
    loadedOnce.current = true;
    setLoading(false);
    if (toSave.length > 0) {
      void fetch("/api/admin/custom-bank", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merge: true, questions: toSave }),
      });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  useEffect(() => {
    if (!addedNonce || !addedQuestion) return;
    pendingAdded.current = [
      addedQuestion,
      ...pendingAdded.current.filter((item) => item.id !== addedQuestion.id),
    ];
    setPinned((prev) => [addedQuestion, ...prev.filter((item) => item.id !== addedQuestion.id)]);
    setTab("questions");
    setQuestionSourceFilter("custom");
    setCustomKind(customQuestionHasPhoto(addedQuestion) ? "photo" : "text");
    setHighlightId(addedQuestion.id);
    setLoading(false);
    const timer = window.setTimeout(() => {
      document.getElementById(`bank-item-${addedQuestion.id}`)?.scrollIntoView({ block: "nearest" });
    }, 50);
    void load();
    return () => window.clearTimeout(timer);
  }, [addedNonce, addedQuestion, load]);

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "questions", label: "Otázky", count: textBankCounts.all },
    { id: "sound", label: "Iné ukážky", count: availableSound.length },
    { id: "video", label: "Video", count: availableVideo.length },
    { id: "music", label: "Hudobné ukážky", count: availableMusic.length },
  ];

  const afterEdit = () => {
    void load();
    onChanged?.();
  };

  const removeQuestion = async (id: string) => {
    if (!window.confirm("Odstrániť otázku z banky?")) return;
    const current = sourceQuestions.find((item) => item.id === id);
    const dropIds = sourceQuestions
      .filter((item) => item.id === id || (current ? sameQuizQuestionVariant(item, current) : false))
      .map((item) => item.id);
    if (!dropIds.includes(id)) dropIds.push(id);
    pendingAdded.current = pendingAdded.current.filter((item) => !dropIds.includes(item.id));
    for (const dropId of dropIds) reinjected.current.delete(dropId);
    for (const dropId of dropIds) removedIdsRef.current.add(dropId);
    setRemovedIds((prev) => Array.from(new Set([...prev, ...dropIds])));
    setPinned((prev) => prev.filter((item) => !dropIds.includes(item.id)));
    setQuestions((prev) => prev.filter((item) => !dropIds.includes(item.id)));
    try {
      await removeCustomBankQuestionAsync(id);
      afterEdit();
    } catch (error) {
      for (const dropId of dropIds) removedIdsRef.current.delete(dropId);
      setRemovedIds((prev) => prev.filter((item) => !dropIds.includes(item)));
      window.alert(error instanceof Error ? error.message : "Otázku sa nepodarilo vymazať.");
      afterEdit();
    }
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
          <p className="text-brand-muted text-xs mt-0.5">
            Otázka vrátená z kvízu je len tu. Otázka vložená z banky do kvízu sa tu skryje.
          </p>
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

      {tab === "questions" && (
        <div className="px-4 sm:px-5 py-3 border-b border-brand-border bg-brand-warm/20 shrink-0 space-y-2">
          <BankThemeFilters
            themes={themeChoices}
            value={questionTheme}
            counts={themeCounts}
            onChange={setQuestionTheme}
            onThemesChange={setBankThemes}
          />
          {textBankCounts.all > 0 && (
          <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ["text", "Otázky bez fotky", customWithoutPhotoCount],
                  ["photo", "Otázky s fotkou", customWithPhotoCount],
                ] as const
              ).map(([key, label, count]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setCustomKind(key)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                    customKind === key
                      ? "bg-sky-700 text-white border-sky-700"
                      : "border-brand-border text-brand-muted hover:border-sky-400"
                  }`}
                >
                  {label} ({count})
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "music" && availableMusic.length > 0 && (
        <div className="px-4 sm:px-5 py-3 border-b border-brand-border bg-brand-warm/20 shrink-0 space-y-2">
          <MusicBankTagFilters tracks={availableMusic} value={musicFilters} onChange={setMusicFilters} />
          {musicTagFiltersActive(musicFilters) && (
            <p className="text-[11px] text-brand-muted">
              Zobrazených {filteredMusic.length} z {availableMusic.length} skladieb
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
          ) : shownTextQuestions.length === 0 ? (
            <p className="text-sm text-brand-muted text-center py-8">
              {themedTextQuestions.length === 0
                ? `V téme ${questionTheme} zatiaľ nie sú voľné otázky.`
                : customKind === "photo"
                  ? "Žiadne otázky s fotkou."
                  : "Žiadne otázky bez fotky."}
            </p>
          ) : (
            <ul className="space-y-3">
              {shownTextQuestions.map((q) => {
                const isCustom = isCustomBankQuestionId(q.id);
                const isGenerated = isGeneratedBankQuestion(q);
                return (
                <li
                  key={q.id}
                  id={`bank-item-${q.id}`}
                  className={`rounded-xl border bg-brand-surface/50 p-3 space-y-2 ${
                    highlightId === q.id ? "border-brand-orange ring-2 ring-brand-orange/50" : "border-brand-border"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    {isCustom && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-brand-orange/15 text-brand-orange-readable border border-brand-orange/40">
                        {bankQuestionTheme(q)}
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
                  <p className="text-xs text-brand-muted whitespace-pre-line">
                    {q.isOrderQuestion || q.isMatchQuestion
                      ? q.answer
                      : q.isOpenQuestion
                        ? `Odpoveď: ${q.answer}`
                        : `Správne: ${q.options[q.correctIndex] || q.answer}`}
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
          availableSound.length === 0 ? (
            <p className="text-sm text-brand-muted text-center py-8">
              {sound.length === 0 ? "Zatiaľ žiadne iné ukážky." : "Všetky iné ukážky sú už použité v kvíze."}
            </p>
          ) : (
            <ul className="space-y-3">
              {availableSound.map((clip) => (
                <li key={clip.id} className="rounded-xl border border-brand-border p-3 space-y-2">
                  <p className="text-sm font-semibold">{clip.label}</p>
                  <p className="text-xs text-brand-muted">Odpoveď: {clip.answer}</p>
                  <BankMediaPreview src={clip.audioUrl} kind="audio" />
                  <div className="flex flex-wrap gap-2">
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
          availableVideo.length === 0 ? (
            <p className="text-sm text-brand-muted text-center py-8">
              {video.length === 0 ? "Zatiaľ žiadne video." : "Všetky videá sú už použité v kvíze."}
            </p>
          ) : (
            <ul className="space-y-3">
              {availableVideo.map((clip) => (
                <li key={clip.id} className="rounded-xl border border-brand-border p-3 space-y-2">
                  <p className="text-sm font-semibold">{clip.label}</p>
                  <p className="text-xs text-brand-muted">Odpoveď: {clip.answer}</p>
                  <BankMediaPreview src={clip.videoUrl} kind="video" />
                  <div className="flex flex-wrap gap-2">
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
        ) : availableMusic.length === 0 ? (
          <p className="text-sm text-brand-muted text-center py-8">
            {music.length === 0 ? "Zatiaľ žiadna hudobná ukážka." : "Všetky hudobné ukážky sú už použité v kvíze."}
          </p>
        ) : filteredMusic.length === 0 ? (
          <p className="text-sm text-brand-muted text-center py-8">Žiadna skladba nevyhovuje filtrom.</p>
        ) : (
          <ul className="space-y-3">
            {filteredMusic.map((track) => {
              const meta = musicTrackMetaFields(track.tags);
              return (
              <li key={track.id} className="rounded-xl border border-brand-border p-3 space-y-2">
                <p className="text-sm font-semibold">
                  {track.artist} — {track.title}
                </p>
                <p className="text-xs text-brand-muted">
                  Jazyk: <span className="text-brand-text">{meta.language}</span>
                  {" · "}
                  Štýl: <span className="text-brand-text">{meta.style}</span>
                  {" · "}
                  Dekáda: <span className="text-brand-text">{meta.decade}</span>
                </p>
                <BankMediaPreview src={track.audioUrl} kind="audio" />
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
              );
            })}
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
