"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, Check, ClipboardCopy, Shuffle, Trash2 } from "lucide-react";
import type { QuizQuestionItem } from "@/lib/quiz-library";
import { findFirstEmptyMusicSlot, findFirstEmptyQuestionSlot, isQuestionSlotEmpty } from "@/lib/quiz-library";
import {
  applyBankQuestionOrder,
  bankQuestionTagScore,
  collectTagsFromBank,
  countTagUsageInQuestions,
  filterBankQuestionsByTags,
  shuffleBankQuestionsByTagBalance,
  sortBankQuestionsByTagBalance,
} from "@/lib/quiz-question-tags";
import {
  filterVisibleBankQuestions,
  formatBankQuestionBody,
  isImageQuestionSlot,
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
  isMusicBankId,
  type MusicBankItem,
} from "@/lib/music-bank";
import { fetchMusicBankFromServer, removeMusicBankItemAsync } from "@/lib/music-bank-client";

type BankSourceFilter = "all" | "custom" | "generated" | "music";

type Props = {
  roundQuestions: QuizQuestionItem[];
  allQuizQuestions: QuizQuestionItem[];
  usedBankQuestionIds: string[];
  customBankQuestions?: QuizBankQuestion[];
  musicBankTracks?: MusicBankItem[];
  openRound?: number;
  onCustomBankChange?: () => void;
  onMusicBankChange?: () => void;
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
};

const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"] as const;

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
  openRound = 1,
  onCustomBankChange,
  onMusicBankChange,
  onInsert,
  onInsertMusic,
}: Props) {
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [targetByBankId, setTargetByBankId] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [excludedTags, setExcludedTags] = useState<string[]>([]);
  const [manualOrderIds, setManualOrderIds] = useState<string[] | null>(null);
  const [sourceFilter, setSourceFilter] = useState<BankSourceFilter>("all");
  const [localCustom, setLocalCustom] = useState<CustomBankQuestion[]>([]);
  const [localMusic, setLocalMusic] = useState<MusicBankItem[]>([]);

  const customBankQuestions = customBankQuestionsProp ?? localCustom;
  const musicBankTracks = musicBankTracksProp ?? localMusic;

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
    setHiddenIds(readHiddenBankQuestionIds());
  }, []);

  const tagCounts = useMemo(() => countTagUsageInQuestions(allQuizQuestions), [allQuizQuestions]);

  const availableQuestions = useMemo(
    () => filterVisibleBankQuestions(usedBankQuestionIds, hiddenIds, customBankQuestions),
    [usedBankQuestionIds, hiddenIds, customBankQuestions]
  );

  const sourceCounts = useMemo(() => {
    const custom = availableQuestions.filter((q) => isCustomBankQuestionId(q.id)).length;
    const generated = availableQuestions.filter((q) => isGeneratedBankQuestion(q)).length;
    const music = musicBankTracks.filter(
      (t) => isMusicBankId(t.id) && !usedBankQuestionIds.includes(t.id)
    ).length;
    const musicTotal = musicBankTracks.length;
    return { all: availableQuestions.length, custom, generated, music, musicTotal };
  }, [availableQuestions, musicBankTracks, usedBankQuestionIds]);

  const bankTags = useMemo(() => collectTagsFromBank(availableQuestions), [availableQuestions]);

  const normalQuestions = useMemo(
    () =>
      roundQuestions
        .filter((q) => q.kind === "normal")
        .sort((a, b) => a.questionNumber - b.questionNumber),
    [roundQuestions]
  );

  const musicQuestionsInRound = useMemo(
    () =>
      roundQuestions
        .filter((q) => q.kind === "music")
        .sort((a, b) => a.questionNumber - b.questionNumber),
    [roundQuestions]
  );

  const defaultMusicTargetId = useMemo(
    () => findFirstEmptyMusicSlot(musicQuestionsInRound)?.id ?? musicQuestionsInRound[0]?.id ?? "",
    [musicQuestionsInRound]
  );

  const visibleMusicTracks = useMemo(() => {
    return musicBankTracks.filter((track) => isMusicBankId(track.id));
  }, [musicBankTracks]);

  const getMusicTargetId = (bankId: string) => {
    const manual = targetByBankId[bankId];
    if (manual) return manual;
    return defaultMusicTargetId;
  };

  const handleInsertMusic = (track: MusicBankItem) => {
    if (!onInsertMusic) return;
    const targetId = getMusicTargetId(track.id);
    if (!targetId) return;
    onInsertMusic(
      track.id,
      targetId,
      track.artist,
      track.title,
      track.audioUrl,
      formatMusicBankHostNote(track)
    );
    setTargetByBankId((prev) => {
      const next = { ...prev };
      delete next[track.id];
      return next;
    });
  };

  const dismissMusicTrack = (id: string) => {
    if (!window.confirm("Odstrániť túto skladbu z banky hudby?")) return;
    void removeMusicBankItemAsync(id).then(() => onMusicBankChange?.());
  };

  const defaultTargetId = useMemo(
    () => findFirstEmptyQuestionSlot(normalQuestions)?.id ?? normalQuestions[0]?.id ?? "",
    [normalQuestions]
  );

  const defaultTargetQuestion = useMemo(
    () => normalQuestions.find((question) => question.id === defaultTargetId),
    [normalQuestions, defaultTargetId]
  );

  const prioritizeImageQuestions = useMemo(() => {
    if (!defaultTargetQuestion) return false;
    return (
      isQuestionSlotEmpty(defaultTargetQuestion) &&
      isImageQuestionSlot(defaultTargetQuestion.questionNumber)
    );
  }, [defaultTargetQuestion]);

  useEffect(() => {
    setManualOrderIds(null);
  }, [excludedTags, usedBankQuestionIds, hiddenIds, sourceFilter, customBankQuestions]);

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
    const generatedSorted = sortBankQuestionsByTagBalance(generated, tagCounts, { prioritizeImageQuestions });
    return [...customSorted, ...generatedSorted];
  };

  const visibleQuestions = useMemo(() => {
    if (sourceFilter === "music") return [];
    if (manualOrderIds) {
      const ordered = applyBankQuestionOrder(filteredQuestions, manualOrderIds);
      if (sourceFilter === "generated") {
        return sortBankQuestionsByTagBalance(ordered, tagCounts, { prioritizeImageQuestions });
      }
      return sortWithCustomPriority(ordered);
    }
    return sortWithCustomPriority(filteredQuestions);
  }, [filteredQuestions, manualOrderIds, tagCounts, prioritizeImageQuestions, sourceFilter]);

  const toggleTagExclusion = (tag: string) => {
    setExcludedTags((prev) =>
      prev.includes(tag) ? prev.filter((entry) => entry !== tag) : [...prev, tag]
    );
  };

  const shuffleQuestions = () => {
    const custom = filteredQuestions.filter((item) => isCustomBankQuestionId(item.id));
    const generated = filteredQuestions.filter((item) => isGeneratedBankQuestion(item));
    const mixedGenerated = shuffleBankQuestionsByTagBalance(generated, tagCounts, {
      prioritizeImageQuestions,
    });
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
      setTargetByBankId((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
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
    setTargetByBankId((prev) => {
      const next = { ...prev };
      delete next[item.id];
      return next;
    });
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
      <div className="px-4 py-4 border-b border-brand-border shrink-0 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-tint flex items-center justify-center shrink-0">
            <BookOpen className="w-4 h-4 text-brand-orange" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-brand-text text-sm leading-snug">Banka otázok</p>
            <p className="text-brand-muted text-xs mt-0.5 leading-relaxed">
              {sourceFilter === "music"
                ? `${visibleMusicTracks.length} skladieb v banke hudby${openRound === 4 ? " · ciel: hudobné sloty v 4. kole" : " · prepni na kolo 4 pre vloženie"}`
                : `${visibleQuestions.length} textových otázok k dispozícii`}
              {sourceFilter !== "all" && sourceFilter !== "music"
                ? ` · filter: ${sourceFilter === "custom" ? "moje" : "vygenerované"}`
                : ""}
              {sourceFilter !== "music" && manualOrderIds
                ? " · premiešané podľa tagov"
                : sourceFilter !== "music" && prioritizeImageQuestions
                  ? ` · foto otázky navrchu (ot. ${defaultTargetQuestion?.questionNumber} čaká na fotku)`
                  : sourceFilter !== "music" && customBankQuestions.some((q) => !usedBankQuestionIds.includes(q.id))
                    ? " · tvoje otázky navrchu"
                    : sourceFilter !== "music"
                      ? " · zoradené podľa najmenej použitých tagov"
                      : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={shuffleQuestions}
            disabled={sourceFilter === "music" || filteredQuestions.length < 2}
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
              ["music", "Hudba", sourceCounts.musicTotal],
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

        {sourceFilter === "music" && (
          <p className="text-xs font-semibold text-violet-800 dark:text-violet-200 bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 rounded-lg px-3 py-2 leading-relaxed">
            Každá ukážka = 1 bod za interpreta + 1 bod za názov skladby. Vlož do slotov „Hudba 1–5“ v 4. kole.
          </p>
        )}

        {prioritizeImageQuestions && sourceFilter !== "music" && (
          <p className="text-xs font-semibold text-brand-orange-readable bg-brand-tint border border-brand-orange/30 rounded-lg px-3 py-2 leading-relaxed">
            Práve plníš otázku č. {defaultTargetQuestion?.questionNumber} — vo formáte Mudrc sú s fotkou
            otázky 5 a 10. Vyber otázku z banky a doplni URL obrázka v editore.
          </p>
        )}

        {bankTags.length > 0 && sourceFilter !== "music" && (
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

      <div className="flex-1 overflow-y-auto overscroll-y-contain px-4 py-3 space-y-3 min-h-0">
        {sourceFilter === "music" ? (
          visibleMusicTracks.length === 0 ? (
            <p className="text-brand-muted text-sm text-center py-8">
              Banka hudby je prázdna. Nahraj skladby cez formulár „Pridať skladbu do banky hudby“ hore v editore.
            </p>
          ) : (
            visibleMusicTracks.map((track) => {
              const targetId = getMusicTargetId(track.id);
              const inUse = usedBankQuestionIds.includes(track.id);
              return (
                <div key={track.id} className="rounded-xl border border-violet-200 dark:border-violet-900 bg-brand-surface/50 p-3 space-y-2.5">
                  <div className="flex flex-wrap items-center gap-1.5 mb-1">
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-900 border border-violet-200 dark:bg-violet-950/40 dark:text-violet-200">
                      hudba
                    </span>
                    {inUse && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-brand-card border border-brand-border text-brand-muted">
                        už v kvíze
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-brand-text">{track.artist}</p>
                  <p className="text-sm text-brand-muted">{track.title}</p>
                  {track.audioUrl && <audio controls src={track.audioUrl} className="w-full max-w-md" preload="metadata" />}
                  <p className="text-xs text-brand-muted">{formatMusicBankHostNote(track)}</p>
                  {musicQuestionsInRound.length > 0 && onInsertMusic ? (
                    <div className="flex gap-2">
                      <select
                        className="input text-xs py-2 flex-1 min-w-0"
                        value={targetId}
                        onChange={(e) => setTargetByBankId((prev) => ({ ...prev, [track.id]: e.target.value }))}
                      >
                        {musicQuestionsInRound.map((q) => (
                          <option key={q.id} value={q.id}>
                            Hudba {q.questionNumber}
                            {isQuestionSlotEmpty(q) ? " · prázdna" : " · obsadená"}
                          </option>
                        ))}
                      </select>
                      <button type="button" onClick={() => handleInsertMusic(track)} className="btn-primary text-xs py-2 px-3 shrink-0">
                        Vložiť
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-amber-700 dark:text-amber-300">Pre vloženie prepni na kolo 4.</p>
                  )}
                  <button
                    type="button"
                    onClick={() => dismissMusicTrack(track.id)}
                    className="btn-outline text-xs py-1.5 px-2 inline-flex items-center gap-1 text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-950/30"
                  >
                    <Trash2 className="w-3 h-3" />
                    Vymazať
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
                  {normalQuestions.length > 0 && (
                    <div className="flex gap-2">
                      <select
                        className="input text-xs py-2 flex-1 min-w-0"
                        value={targetId}
                        onChange={(e) =>
                          setTargetByBankId((prev) => ({ ...prev, [item.id]: e.target.value }))
                        }
                      >
                        {normalQuestions.map((q) => (
                          <option key={q.id} value={q.id}>
                            Ot. {q.questionNumber}
                            {isQuestionSlotEmpty(q) ? " · prázdna" : " · obsadená"}
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
