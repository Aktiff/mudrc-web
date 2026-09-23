"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, Check, ClipboardCopy, Shuffle, Trash2 } from "lucide-react";
import {
  findFirstEmptyContentSlot,
  isQuestionSlotEmpty,
  type QuizQuestionItem,
} from "@/lib/quiz-library";
import { compareQuizQuestions } from "@/lib/quiz-template";
import {
  applyBankQuestionOrder,
  bankQuestionTagScore,
  buildBankTagWeightMap,
  collectTagsFromBank,
  filterBankQuestionsByTags,
  shuffleBankQuestionsByTagBalance,
  sortBankQuestionsByTagBalance,
} from "@/lib/quiz-question-tags";
import {
  filterVisibleBankQuestions,
  formatBankQuestionBody,
  readHiddenBankQuestionIds,
  writeHiddenBankQuestionIds,
  type QuizBankQuestion,
} from "@/lib/quiz-question-bank";
import {
  fetchCustomBankQuestionsFromServer,
  isCustomBankQuestionId,
  isGeneratedBankQuestion,
  removeCustomBankQuestionAsync,
  type CustomBankQuestion,
} from "@/lib/quiz-custom-bank";
import { shuffleQuestionOptionsRandom } from "@/lib/quiz-question-options";
import {
  DEFAULT_MUSIC_QUESTION_BODY,
  formatMusicBankHostNote,
  formatMusicBankTagsLabel,
  isMusicBankId,
  type MusicBankItem,
} from "@/lib/music-bank";
import { fetchMusicBankFromServer, removeMusicBankItemAsync } from "@/lib/music-bank-client";
import {
  formatSoundBankHostNote,
  isSoundBankId,
  type SoundBankItem,
} from "@/lib/sound-bank";
import { fetchSoundBankFromServer, removeSoundBankItemAsync } from "@/lib/sound-bank-client";
import {
  formatVideoBankHostNote,
  isVideoBankId,
  type VideoBankItem,
} from "@/lib/video-bank";
import { fetchVideoBankFromServer, removeVideoBankItemAsync } from "@/lib/video-bank-client";

type BankSourceFilter = "all" | "custom" | "generated" | "sound" | "video";

const MEDIA_FILTERS = new Set<BankSourceFilter>(["sound", "video"]);

type Props = {
  roundQuestions: QuizQuestionItem[];
  allQuizQuestions: QuizQuestionItem[];
  usedBankQuestionIds: string[];
  customBankQuestions?: QuizBankQuestion[];
  musicBankTracks?: MusicBankItem[];
  soundBankClips?: SoundBankItem[];
  videoBankClips?: VideoBankItem[];
  openRound?: number;
  onCustomBankChange?: () => void;
  onMusicBankChange?: () => void;
  onSoundBankChange?: () => void;
  onVideoBankChange?: () => void;
  onInsert: (
    bankId: string,
    targetQuestionId: string,
    body: string,
    answer: string,
    options: string[],
    tags: string[],
    isImageQuestion?: boolean,
    hostNote?: string,
    suggestedImageUrl?: string
  ) => void;
  onInsertMusic?: (
    bankId: string,
    targetQuestionId: string,
    artist: string,
    title: string,
    audioUrl: string,
    hostNote?: string
  ) => void;
  onInsertSound?: (
    bankId: string,
    targetQuestionId: string,
    label: string,
    answer: string,
    audioUrl: string,
    hostNote?: string,
    tags?: string[]
  ) => void;
  onInsertVideo?: (
    bankId: string,
    targetQuestionId: string,
    label: string,
    answer: string,
    videoUrl: string,
    hostNote?: string
  ) => void;
};

const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"] as const;

function contentSlotLabel(q: QuizQuestionItem, openRound: number): string {
  const base =
    openRound === 4 && q.kind === "music"
      ? `Zvuk · koniec kola ${q.questionNumber}`
      : `Ot. ${q.questionNumber}`;
  const kindHint =
    q.kind === "sound" ? " · zvuk" : q.kind === "video" ? " · video" : q.kind === "music" ? "" : "";
  return `${base}${kindHint}${isQuestionSlotEmpty(q) ? " · prázdna" : " · obsadená"}`;
}

function TagChip({
  tag,
  excluded = false,
}: {
  tag: string;
  excluded?: boolean;
}) {
  return (
    <span
      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${
        excluded
          ? "border-red-300 bg-red-50 text-red-700 line-through dark:bg-red-950/30 dark:text-red-300 dark:border-red-800"
          : "border-brand-border bg-brand-card text-brand-muted"
      }`}
    >
      {tag}
    </span>
  );
}

export default function QuizQuestionBankPanel({
  roundQuestions,
  allQuizQuestions,
  usedBankQuestionIds,
  customBankQuestions: customBankQuestionsProp,
  musicBankTracks: musicBankTracksProp,
  soundBankClips: soundBankClipsProp,
  videoBankClips: videoBankClipsProp,
  openRound = 1,
  onCustomBankChange,
  onMusicBankChange,
  onSoundBankChange,
  onVideoBankChange,
  onInsert,
  onInsertMusic,
  onInsertSound,
  onInsertVideo,
}: Props) {
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [targetByBankId, setTargetByBankId] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [excludedTags, setExcludedTags] = useState<string[]>([]);
  const [manualOrderIds, setManualOrderIds] = useState<string[] | null>(null);
  const [sourceFilter, setSourceFilter] = useState<BankSourceFilter>("all");
  const [localCustom, setLocalCustom] = useState<CustomBankQuestion[]>([]);
  const [localMusic, setLocalMusic] = useState<MusicBankItem[]>([]);
  const [localSound, setLocalSound] = useState<SoundBankItem[]>([]);
  const [localVideo, setLocalVideo] = useState<VideoBankItem[]>([]);

  const customBankQuestions = customBankQuestionsProp ?? localCustom;
  const musicBankTracks = musicBankTracksProp ?? localMusic;
  const soundBankClips = soundBankClipsProp ?? localSound;
  const videoBankClips = videoBankClipsProp ?? localVideo;

  useEffect(() => {
    if (customBankQuestionsProp) return;
    const sync = () => {
      void fetchCustomBankQuestionsFromServer().then(setLocalCustom);
    };
    sync();
    window.addEventListener("mudrc-custom-bank-updated", sync);
    return () => window.removeEventListener("mudrc-custom-bank-updated", sync);
  }, [customBankQuestionsProp]);

  useEffect(() => {
    if (musicBankTracksProp) return;
    void fetchMusicBankFromServer().then(setLocalMusic);
  }, [musicBankTracksProp]);

  useEffect(() => {
    if (soundBankClipsProp) return;
    void fetchSoundBankFromServer().then(setLocalSound);
  }, [soundBankClipsProp]);

  useEffect(() => {
    if (videoBankClipsProp) return;
    void fetchVideoBankFromServer().then(setLocalVideo);
  }, [videoBankClipsProp]);

  useEffect(() => {
    setHiddenIds(readHiddenBankQuestionIds());
  }, []);

  const usedBankKey = useMemo(
    () => [...usedBankQuestionIds].sort().join("\0"),
    [usedBankQuestionIds]
  );

  const customBankKey = useMemo(
    () => customBankQuestions.map((q) => q.id).sort().join("\0"),
    [customBankQuestions]
  );

  const availableQuestions = useMemo(
    () => filterVisibleBankQuestions(usedBankQuestionIds, hiddenIds, customBankQuestions),
    [usedBankQuestionIds, hiddenIds, customBankQuestions]
  );

  const sourceCounts = useMemo(() => {
    const custom = availableQuestions.filter((q) => isCustomBankQuestionId(q.id)).length;
    const generated = availableQuestions.filter((q) => isGeneratedBankQuestion(q)).length;
    const musicInSoundBank = musicBankTracks.filter(
      (t) => isMusicBankId(t.id) && !usedBankQuestionIds.includes(t.id)
    ).length;
    const soundOnly = soundBankClips.filter(
      (t) => isSoundBankId(t.id) && !usedBankQuestionIds.includes(t.id)
    ).length;
    const sound = soundOnly + musicInSoundBank;
    const soundTotal = soundBankClips.length + musicBankTracks.length;
    const video = videoBankClips.filter(
      (t) => isVideoBankId(t.id) && !usedBankQuestionIds.includes(t.id)
    ).length;
    const videoTotal = videoBankClips.length;
    return { all: availableQuestions.length, custom, generated, sound, soundTotal, video, videoTotal };
  }, [availableQuestions, musicBankTracks, soundBankClips, videoBankClips, usedBankQuestionIds]);

  const bankTags = useMemo(() => collectTagsFromBank(availableQuestions), [availableQuestions]);

  /** Všetky sloty v kole — vrátane konca 4. kola (bývalá hudba). */
  const bankTargetSlots = useMemo(
    () => [...roundQuestions].sort(compareQuizQuestions),
    [roundQuestions]
  );

  const defaultTargetId = useMemo(
    () => findFirstEmptyContentSlot(bankTargetSlots)?.id ?? bankTargetSlots[0]?.id ?? "",
    [bankTargetSlots]
  );

  const tagCounts = useMemo(
    () => buildBankTagWeightMap(allQuizQuestions, roundQuestions, defaultTargetId || undefined),
    [allQuizQuestions, roundQuestions, defaultTargetId]
  );

  const visibleMusicTracks = useMemo(() => {
    return musicBankTracks.filter(
      (track) => isMusicBankId(track.id) && !usedBankQuestionIds.includes(track.id)
    );
  }, [musicBankTracks, usedBankQuestionIds]);

  const defaultSoundTargetId = defaultTargetId;

  const visibleSoundClips = useMemo(
    () =>
      soundBankClips.filter(
        (clip) => isSoundBankId(clip.id) && !usedBankQuestionIds.includes(clip.id)
      ),
    [soundBankClips, usedBankQuestionIds]
  );

  const getSoundTargetId = (bankId: string) => targetByBankId[bankId] || defaultSoundTargetId;

  const handleInsertSound = (clip: SoundBankItem) => {
    if (!onInsertSound) return;
    const targetId = getSoundTargetId(clip.id);
    if (!targetId) return;
    onInsertSound(
      clip.id,
      targetId,
      clip.label,
      clip.answer,
      clip.audioUrl,
      formatSoundBankHostNote(clip)
    );
    void removeSoundBankItemAsync(clip.id).then(() => onSoundBankChange?.());
    setTargetByBankId((prev) => {
      const next = { ...prev };
      delete next[clip.id];
      return next;
    });
  };

  const dismissSoundClip = (id: string) => {
    if (!window.confirm("Odstrániť túto zvukovú ukážku z banky?")) return;
    void removeSoundBankItemAsync(id).then(() => onSoundBankChange?.());
  };

  const handleInsertMusicAsSound = (track: MusicBankItem) => {
    if (!onInsertSound) return;
    const targetId = getSoundTargetId(track.id);
    if (!targetId) return;
    const label = `${track.artist} — ${track.title}`;
    onInsertSound(
      track.id,
      targetId,
      label,
      label,
      track.audioUrl,
      formatMusicBankHostNote(track),
      track.tags
    );
    void removeMusicBankItemAsync(track.id).then(() => onMusicBankChange?.());
    setTargetByBankId((prev) => {
      const next = { ...prev };
      delete next[track.id];
      return next;
    });
  };

  const dismissMusicTrack = (id: string) => {
    if (!window.confirm("Odstrániť zo zvukových ukážok?")) return;
    void removeMusicBankItemAsync(id).then(() => onMusicBankChange?.());
  };

  const defaultVideoTargetId = defaultTargetId;

  const visibleVideoClips = useMemo(
    () =>
      videoBankClips.filter(
        (clip) => isVideoBankId(clip.id) && !usedBankQuestionIds.includes(clip.id)
      ),
    [videoBankClips, usedBankQuestionIds]
  );

  const getVideoTargetId = (bankId: string) => targetByBankId[bankId] || defaultVideoTargetId;

  const handleInsertVideo = (clip: VideoBankItem) => {
    if (!onInsertVideo) return;
    const targetId = getVideoTargetId(clip.id);
    if (!targetId) return;
    onInsertVideo(
      clip.id,
      targetId,
      clip.label,
      clip.answer,
      clip.videoUrl,
      formatVideoBankHostNote(clip)
    );
    void removeVideoBankItemAsync(clip.id).then(() => onVideoBankChange?.());
    setTargetByBankId((prev) => {
      const next = { ...prev };
      delete next[clip.id];
      return next;
    });
  };

  const dismissVideoClip = (id: string) => {
    if (!window.confirm("Odstrániť toto video z banky?")) return;
    void removeVideoBankItemAsync(id).then(() => onVideoBankChange?.());
  };

  useEffect(() => {
    setManualOrderIds(null);
  }, [excludedTags, sourceFilter, usedBankKey, customBankKey]);

  const filteredQuestions = useMemo(() => {
    let list = filterBankQuestionsByTags(availableQuestions, excludedTags);
    if (sourceFilter === "custom") {
      list = list.filter((item) => isCustomBankQuestionId(item.id));
    } else if (sourceFilter === "generated") {
      list = list.filter((item) => isGeneratedBankQuestion(item));
    }
    return list;
  }, [availableQuestions, excludedTags, sourceFilter]);

  const sortWithCustomPriority = (items: QuizBankQuestion[]) => {
    const custom = items.filter((item) => isCustomBankQuestionId(item.id));
    const generated = items.filter((item) => isGeneratedBankQuestion(item));
    const customSorted = [...custom].sort((a, b) => {
      const aTime = "createdAt" in a && typeof a.createdAt === "number" ? a.createdAt : 0;
      const bTime = "createdAt" in b && typeof b.createdAt === "number" ? b.createdAt : 0;
      return bTime - aTime;
    });
    const generatedSorted = sortBankQuestionsByTagBalance(generated, tagCounts);
    return [...customSorted, ...generatedSorted];
  };

  const visibleQuestions = useMemo(() => {
    if (MEDIA_FILTERS.has(sourceFilter)) return [];
    if (manualOrderIds?.length) {
      return applyBankQuestionOrder(filteredQuestions, manualOrderIds);
    }
    return sortWithCustomPriority(filteredQuestions);
  }, [filteredQuestions, manualOrderIds, tagCounts, sourceFilter]);

  const toggleTagExclusion = (tag: string) => {
    setExcludedTags((prev) =>
      prev.includes(tag) ? prev.filter((entry) => entry !== tag) : [...prev, tag]
    );
  };

  const shuffleQuestions = () => {
    const custom = filteredQuestions.filter((item) => isCustomBankQuestionId(item.id));
    const generated = filteredQuestions.filter((item) => isGeneratedBankQuestion(item));
    const mixedGenerated = shuffleBankQuestionsByTagBalance(generated, tagCounts);
    const customSorted = [...custom].sort((a, b) => {
      const aTime = "createdAt" in a && typeof a.createdAt === "number" ? a.createdAt : 0;
      const bTime = "createdAt" in b && typeof b.createdAt === "number" ? b.createdAt : 0;
      return bTime - aTime;
    });
    const mixed =
      sourceFilter === "generated"
        ? mixedGenerated
        : sourceFilter === "custom"
          ? customSorted
          : [...customSorted, ...mixedGenerated];
    setManualOrderIds(mixed.map((item) => item.id));
  };

  const copyText = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 2000);
    } catch {
      window.prompt("Skopíruj text:", text);
    }
  };

  const getTargetId = (bankId: string) => {
    const manual = targetByBankId[bankId];
    if (manual) return manual;
    return defaultTargetId;
  };

  const afterBankQuestionInserted = (bankId: string) => {
    setTargetByBankId((prev) => {
      const next = { ...prev };
      delete next[bankId];
      return next;
    });
    if (isCustomBankQuestionId(bankId)) {
      void removeCustomBankQuestionAsync(bankId).then(() => onCustomBankChange?.());
    }
  };

  const handleInsert = (item: QuizBankQuestion) => {
    const targetId = getTargetId(item.id);
    if (!targetId) return;

    if (item.isOpenQuestion) {
      const suggestedImageUrl =
        "suggestedImageUrl" in item && typeof item.suggestedImageUrl === "string"
          ? item.suggestedImageUrl
          : undefined;
      onInsert(
        item.id,
        targetId,
        item.body,
        item.answer,
        [],
        [...item.tags],
        item.isImageQuestion,
        item.note,
        suggestedImageUrl
      );
      afterBankQuestionInserted(item.id);
      return;
    }

    const activeOptions = item.options.map((option) => option.trim()).filter(Boolean);
    const activeSourceIndices = item.options
      .map((option, index) => (option.trim() ? index : -1))
      .filter((index) => index >= 0);
    let correctIndex = activeSourceIndices.indexOf(item.correctIndex);
    if (correctIndex < 0) correctIndex = 0;

    const mixed = shuffleQuestionOptionsRandom({
      ...item,
      options: activeOptions as QuizBankQuestion["options"],
      correctIndex,
      answer: activeOptions[correctIndex] ?? item.answer,
    });
    const optionList = mixed.options.map((option) => option.trim()).filter(Boolean);
    const suggestedImageUrl =
      "suggestedImageUrl" in item && typeof item.suggestedImageUrl === "string"
        ? item.suggestedImageUrl
        : undefined;
    onInsert(
      mixed.id,
      targetId,
      mixed.body,
      mixed.answer,
      optionList,
      [...mixed.tags],
      mixed.isImageQuestion,
      mixed.note,
      suggestedImageUrl
    );
    afterBankQuestionInserted(item.id);
  };

  const dismissQuestion = (bankId: string) => {
    if (isCustomBankQuestionId(bankId)) {
      if (!window.confirm("Odstrániť túto vlastnú otázku z banky?")) return;
      void removeCustomBankQuestionAsync(bankId).then(() => onCustomBankChange?.());
      return;
    }
    if (!window.confirm("Odstrániť túto otázku z banky? (Zmizne aj v iných kvízoch.)")) return;
    const next = Array.from(new Set([...hiddenIds, bankId]));
    setHiddenIds(next);
    writeHiddenBankQuestionIds(next);
  };

  return (
    <div className="bg-brand-card border border-brand-border rounded-2xl flex flex-col min-w-0 max-w-full h-full min-h-0 overflow-hidden">
      <div className="px-5 py-5 sm:px-6 border-b border-brand-border shrink-0 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-tint flex items-center justify-center shrink-0">
            <BookOpen className="w-4 h-4 text-brand-orange" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-brand-text text-sm leading-snug">Banka otázok</p>
            <p className="text-brand-muted text-xs mt-0.5 leading-relaxed">
              {sourceFilter === "sound"
                ? `${visibleSoundClips.length + visibleMusicTracks.length} zvukových ukážok · vlož do ľubovoľného slotu v kole (vrátane konca 4. kola)`
                : sourceFilter === "video"
                  ? `${visibleVideoClips.length} video ukážok · vlož do ľubovoľného slotu v kole`
                  : `${visibleQuestions.length} textových otázok k dispozícii`}
              {sourceFilter !== "all" && !MEDIA_FILTERS.has(sourceFilter)
                ? ` · filter: ${sourceFilter === "custom" ? "moje" : "vygenerované"}`
                : ""}
              {!MEDIA_FILTERS.has(sourceFilter) && manualOrderIds
                ? " · premiešané podľa tagov"
                : !MEDIA_FILTERS.has(sourceFilter) &&
                    customBankQuestions.some((q) => !usedBankQuestionIds.includes(q.id))
                  ? " · tvoje otázky navrchu"
                  : !MEDIA_FILTERS.has(sourceFilter)
                    ? " · zoradené podľa najmenej použitých tagov"
                    : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={shuffleQuestions}
            disabled={MEDIA_FILTERS.has(sourceFilter) || filteredQuestions.length < 2}
            className="btn-outline text-xs py-2 px-2.5 inline-flex items-center gap-1.5 shrink-0 disabled:opacity-40"
            title="Premieša poradie — menej použité tagy navrchu, rovnaké tagy nie hneď za sebou"
          >
            <Shuffle className="w-3.5 h-3.5" />
            Premiešať
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["all", "Všetky", sourceCounts.all],
              ["custom", "Moje otázky", sourceCounts.custom],
              ["generated", "Vygenerované", sourceCounts.generated],
              ["sound", "Zvukové ukážky", sourceCounts.soundTotal],
              ["video", "Video", sourceCounts.videoTotal],
            ] as const
          ).map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSourceFilter(key)}
              className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-colors ${
                sourceFilter === key
                  ? "bg-brand-orange text-brand-btn-fg border-brand-orange"
                  : "border-brand-border text-brand-muted hover:border-brand-orange"
              }`}
            >
              {label} ({count})
            </button>
          ))}
        </div>

        {sourceFilter === "sound" && (
          <p className="text-xs font-semibold text-sky-800 dark:text-sky-200 bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 rounded-lg px-3 py-2 leading-relaxed">
            Zvuková ukážka môže ísť kamkoľvek v aktuálnom kole — aj do slotov „Zvuk · koniec kola“ na konci 4. kola.
          </p>
        )}

        {sourceFilter === "video" && (
          <p className="text-xs font-semibold text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 leading-relaxed">
            Video môže ísť do ľubovoľného slotu otázky v kole — rovnako ako text alebo zvuk.
          </p>
        )}

        {bankTags.length > 0 && !MEDIA_FILTERS.has(sourceFilter) && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-muted mb-1.5">
              Skryť otázky s tagom
            </p>
            <div className="flex flex-wrap gap-1.5">
              {bankTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTagExclusion(tag)}
                  className="rounded-full"
                  title={excludedTags.includes(tag) ? "Znova zobraziť otázky s týmto tagom" : "Skryť otázky s týmto tagom"}
                >
                  <TagChip tag={tag} excluded={excludedTags.includes(tag)} />
                </button>
              ))}
              {excludedTags.length > 0 && (
                <button
                  type="button"
                  onClick={() => setExcludedTags([])}
                  className="text-[10px] font-semibold text-brand-muted hover:text-brand-text px-1.5"
                >
                  Zobraziť všetko
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto overscroll-y-contain px-5 py-4 sm:px-6 space-y-3 min-h-0">
        {sourceFilter === "sound" ? (
          visibleSoundClips.length === 0 && visibleMusicTracks.length === 0 ? (
            <p className="text-brand-muted text-sm text-center py-8">
              Banka zvukových ukážok je prázdna. Nahraj cez „Pridať zvukovú ukážku do banky“ hore v editore.
            </p>
          ) : (
            <>
              {visibleSoundClips.map((clip) => {
                const targetId = getSoundTargetId(clip.id);
                return (
                  <div key={clip.id} className="rounded-xl border border-sky-200 dark:border-sky-900 bg-brand-surface/50 p-3 space-y-2.5">
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-900 border border-sky-200">zvuk</span>
                    <p className="text-sm font-semibold text-brand-text">{clip.label}</p>
                    <p className="text-sm text-brand-muted">Odpoveď: {clip.answer}</p>
                    {clip.audioUrl && <audio controls src={clip.audioUrl} className="w-full max-w-md" preload="metadata" />}
                    <p className="text-xs text-brand-muted">{formatSoundBankHostNote(clip)}</p>
                    {bankTargetSlots.length > 0 && onInsertSound ? (
                      <div className="flex gap-2">
                        <select
                          className="input text-xs py-2 flex-1 min-w-0"
                          value={targetId}
                          onChange={(e) => setTargetByBankId((prev) => ({ ...prev, [clip.id]: e.target.value }))}
                        >
                          {bankTargetSlots.map((q) => (
                            <option key={q.id} value={q.id}>
                              {contentSlotLabel(q, openRound)}
                            </option>
                          ))}
                        </select>
                        <button type="button" onClick={() => handleInsertSound(clip)} className="btn-primary text-xs py-2 px-3 shrink-0">
                          Vložiť
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-amber-700 dark:text-amber-300">V tomto kole nie je kam vložiť.</p>
                    )}
                    <button type="button" onClick={() => dismissSoundClip(clip.id)} className="btn-outline text-xs py-1.5 px-2 text-red-600 border-red-200">
                      <Trash2 className="w-3 h-3 inline" /> Vymazať
                    </button>
                  </div>
                );
              })}
              {visibleMusicTracks.map((track) => {
                const targetId = getSoundTargetId(track.id);
                return (
                  <div key={track.id} className="rounded-xl border border-sky-200 dark:border-sky-900 bg-brand-surface/50 p-3 space-y-2.5">
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-900 border border-sky-200">zvuk</span>
                    <p className="text-sm font-semibold text-brand-text">{track.artist} — {track.title}</p>
                    {track.audioUrl && <audio controls src={track.audioUrl} className="w-full max-w-md" preload="metadata" />}
                    <p className="text-xs text-brand-muted">{formatMusicBankHostNote(track)}</p>
                    {track.tags && track.tags.length > 0 && (
                      <p className="text-[11px] text-violet-800 dark:text-violet-200 font-medium">
                        {formatMusicBankTagsLabel(track.tags)}
                      </p>
                    )}
                    {bankTargetSlots.length > 0 && onInsertSound ? (
                      <div className="flex gap-2">
                        <select
                          className="input text-xs py-2 flex-1 min-w-0"
                          value={targetId}
                          onChange={(e) => setTargetByBankId((prev) => ({ ...prev, [track.id]: e.target.value }))}
                        >
                          {bankTargetSlots.map((q) => (
                            <option key={q.id} value={q.id}>
                              {contentSlotLabel(q, openRound)}
                            </option>
                          ))}
                        </select>
                        <button type="button" onClick={() => handleInsertMusicAsSound(track)} className="btn-primary text-xs py-2 px-3 shrink-0">
                          Vložiť
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-amber-700 dark:text-amber-300">V tomto kole nie je kam vložiť.</p>
                    )}
                    <button type="button" onClick={() => dismissMusicTrack(track.id)} className="btn-outline text-xs py-1.5 px-2 text-red-600 border-red-200">
                      <Trash2 className="w-3 h-3 inline" /> Vymazať
                    </button>
                  </div>
                );
              })}
            </>
          )
        ) : sourceFilter === "video" ? (
          visibleVideoClips.length === 0 ? (
            <p className="text-brand-muted text-sm text-center py-8">
              Banka videa je prázdna. Nahraj ukážky cez „Pridať video ukážku do banky“ hore v editore.
            </p>
          ) : (
            visibleVideoClips.map((clip) => {
              const targetId = getVideoTargetId(clip.id);
              return (
                <div key={clip.id} className="rounded-xl border border-amber-200 dark:border-amber-900 bg-brand-surface/50 p-3 space-y-2.5">
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">video</span>
                  <p className="text-sm font-semibold text-brand-text">{clip.label}</p>
                  <p className="text-sm text-brand-muted">Odpoveď: {clip.answer}</p>
                  {clip.videoUrl && (
                    <video controls src={clip.videoUrl} className="w-full max-w-md rounded-lg border border-brand-border" preload="metadata" />
                  )}
                  <p className="text-xs text-brand-muted">{formatVideoBankHostNote(clip)}</p>
                  {bankTargetSlots.length > 0 && onInsertVideo ? (
                    <div className="flex gap-2">
                      <select
                        className="input text-xs py-2 flex-1 min-w-0"
                        value={targetId}
                        onChange={(e) => setTargetByBankId((prev) => ({ ...prev, [clip.id]: e.target.value }))}
                      >
                        {bankTargetSlots.map((q) => (
                          <option key={q.id} value={q.id}>
                            {contentSlotLabel(q, openRound)}
                          </option>
                        ))}
                      </select>
                      <button type="button" onClick={() => handleInsertVideo(clip)} className="btn-primary text-xs py-2 px-3 shrink-0">
                        Vložiť
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-amber-700 dark:text-amber-300">V tomto kole nie je kam vložiť.</p>
                  )}
                  <button type="button" onClick={() => dismissVideoClip(clip.id)} className="btn-outline text-xs py-1.5 px-2 text-red-600 border-red-200">
                    <Trash2 className="w-3 h-3 inline" /> Vymazať
                  </button>
                </div>
              );
            })
          )
        ) : visibleQuestions.length === 0 ? (
          <p className="text-brand-muted text-sm text-center py-8">
            {excludedTags.length
              ? "Po vylúčení zvolených tagov nie sú dostupné otázky."
              : "Všetky otázky z banky sú vložené alebo odstránené."}
          </p>
        ) : (
          visibleQuestions.map((item) => {
            const targetId = getTargetId(item.id);
            const tagScore = bankQuestionTagScore(item, tagCounts);

            return (
              <div key={item.id} className="rounded-xl border border-brand-border bg-brand-surface/50 p-3 space-y-2.5">
                <div>
                  <div className="flex flex-wrap items-center gap-1.5 mb-1">
                    {isCustomBankQuestionId(item.id) && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-brand-orange/15 text-brand-orange-readable border border-brand-orange/40">
                        moja otázka
                      </span>
                    )}
                    {item.isOpenQuestion && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-sky-50 text-sky-800 border border-sky-200 dark:bg-sky-950/30 dark:text-sky-200 dark:border-sky-800">
                        otvorená
                      </span>
                    )}
                    {item.isImageQuestion && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-800 border border-violet-200 dark:bg-violet-950/30 dark:text-violet-200 dark:border-violet-800">
                        foto otázka
                      </span>
                    )}
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-brand-card border border-brand-border text-brand-muted">
                      {item.difficulty}/10
                    </span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-50 text-green-800 border border-green-200 dark:bg-green-950/30 dark:text-green-200 dark:border-green-800">
                      {tagScore === 0 ? "žiadny tag zatiaľ nepoužitý" : `najpoužívanejší tag ×${tagScore}`}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-brand-text leading-snug break-words">{item.body}</p>
                  {item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {item.tags.map((tag) => (
                        <TagChip key={tag} tag={tag} />
                      ))}
                    </div>
                  )}
                </div>

                {item.isOpenQuestion ? (
                  <p className="text-xs px-2 py-1.5 rounded-md border border-green-500/50 bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-200 font-semibold">
                    Správna odpoveď: {item.answer}
                  </p>
                ) : (
                <ul className="space-y-1">
                  {item.options.map((option, optionIndex) => {
                    if (!option.trim()) return null;
                    return (
                    <li
                      key={optionIndex}
                      className={`text-xs px-2 py-1.5 rounded-md border leading-snug break-words ${
                        optionIndex === item.correctIndex
                          ? "border-green-500/50 bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-200 font-semibold"
                          : "border-brand-border text-brand-text bg-brand-card"
                      }`}
                    >
                      <span className="font-mono opacity-60 mr-1">{OPTION_LETTERS[optionIndex]})</span>
                      {option}
                    </li>
                    );
                  })}
                </ul>
                )}

                <p className="text-xs text-brand-muted leading-relaxed bg-brand-warm border border-brand-border rounded-lg px-2.5 py-2">
                  <span className="font-semibold text-brand-text">Info: </span>
                  {item.note}
                </p>

                <div className="flex flex-col gap-2">
                  {bankTargetSlots.length > 0 && (
                    <div className="flex gap-2">
                      <select
                        className="input text-xs py-2 flex-1 min-w-0"
                        value={targetId}
                        onChange={(e) =>
                          setTargetByBankId((prev) => ({ ...prev, [item.id]: e.target.value }))
                        }
                      >
                        {bankTargetSlots.map((q) => (
                          <option key={q.id} value={q.id}>
                            {contentSlotLabel(q, openRound)}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => handleInsert(item)}
                        className="btn-primary text-xs py-2 px-3 shrink-0"
                      >
                        Vložiť
                      </button>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => copyText(formatBankQuestionBody(item), `${item.id}-body`)}
                      className="btn-outline text-xs py-1.5 px-2 inline-flex items-center gap-1"
                    >
                      {copiedId === `${item.id}-body` ? <Check className="w-3 h-3" /> : <ClipboardCopy className="w-3 h-3" />}
                      Kopírovať
                    </button>
                    <button
                      type="button"
                      onClick={() => dismissQuestion(item.id)}
                      className="btn-outline text-xs py-1.5 px-2 inline-flex items-center gap-1 text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-950/30"
                    >
                      <Trash2 className="w-3 h-3" />
                      Vymazať
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
