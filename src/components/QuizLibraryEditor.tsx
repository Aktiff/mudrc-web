"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, Fragment } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, GripVertical, MonitorPlay, Plus, RotateCcw, Save, Trash2, X } from "lucide-react";
import type { QuizEvent } from "@/lib/data";
import { playbackMediaSrc } from "@/lib/media-url";
import {
  collectUsedBankQuestionIdsFromQuiz,
  collectUsedQuestionBodyKeys,
  countFilledQuizQuestions,
  normalizeLibraryQuiz,
  quizQuestionBodyKey,
  type QuizLibraryItem,
  type QuizQuestionItem,
  type QuizQuestionKind,
} from "@/lib/quiz-library";
import QuizPromoEditor from "@/components/admin/QuizPromoEditor";
import { inferBankTheme } from "@/lib/bank-themes";
import { findBankQuestionById, findRawBankQuestionById } from "@/lib/quiz-question-bank";
import {
  applyMatchColumnEdit,
  formatMatchBankAnswer,
  formatOrderAnswer,
  matchLetter,
  matchPairsFromQuiz,
  moveMatchColumn,
  orderItemsFromAnswer,
  ORDER_OPTION_MAX,
  shuffleMatchPairs,
  shuffleOrderItems,
  shuffleQuestionOptionsForBankInsert,
} from "@/lib/quiz-question-options";
import {
  addCustomBankQuestionAsync,
  fetchCustomBankQuestionsFromServer,
  isCustomBankQuestionId,
  readCustomBankQuestions,
  readDeletedCustomBankIds,
  updateCustomBankQuestionAsync,
  type CustomBankQuestion,
} from "@/lib/quiz-custom-bank";
import {
  buildStandardMudrcQuestions,
  describeQuizContent,
  insertQuestionAfter,
  reorderQuizRounds,
  moveQuestionByDirection,
  moveQuestionToRoundIndex,
  removeQuestion,
  roundLabels,
  sortQuizQuestions,
  displayQuestionNumber,
} from "@/lib/quiz-template";
import { buildPresentationSlides } from "@/lib/quiz-presentation";
import QuizAnswerKey from "@/components/QuizAnswerKey";
import QuizQuestionBankPanel from "@/components/QuizQuestionBankPanel";
import CustomBankQuestionForm from "@/components/CustomBankQuestionForm";
import MusicBankQuestionForm from "@/components/MusicBankQuestionForm";
import VideoBankQuestionForm from "@/components/VideoBankQuestionForm";
import AudioUrlField from "@/components/admin/AudioUrlField";
import VideoUrlField from "@/components/admin/VideoUrlField";
import { artistTitleFromAnswer, DEFAULT_MUSIC_QUESTION_BODY, musicBankInputFromReturnedAudio, type MusicBankItem } from "@/lib/music-bank";
import { addMusicBankItemAsync, fetchMusicBankFromServer } from "@/lib/music-bank-client";
import { DEFAULT_SOUND_QUESTION_BODY, type SoundBankItem } from "@/lib/sound-bank";
import { addSoundBankItemAsync, fetchSoundBankFromServer } from "@/lib/sound-bank-client";
import { DEFAULT_VIDEO_QUESTION_BODY, type VideoBankItem } from "@/lib/video-bank";
import { addVideoBankItemAsync, fetchVideoBankFromServer } from "@/lib/video-bank-client";
import QuizTagStats from "@/components/QuizTagStats";
import ImageUrlField from "@/components/admin/ImageUrlField";
import { optionLetter } from "@/lib/quiz-question-options";
import TagSuggestInput from "@/components/TagSuggestInput";
import { formatTagsInput, parseTagsInput } from "@/lib/quiz-question-tags";
import {
  clearQuizDraft,
  parseQuizPayload,
  readQuizDraft,
  readQuizLocalBackup,
  writeQuizDraft,
} from "@/lib/quiz-editor-draft";

type Props = {
  quizId: string;
  initialQuiz?: QuizLibraryItem | null;
};

function questionsInRound(questions: QuizQuestionItem[], round: number) {
  return sortQuizQuestions(questions.filter((q) => q.roundNumber === round));
}

const NORMAL_MEDIA_CHOICES = [
  { id: "none", label: "Žiadne" },
  { id: "image", label: "Obrázok" },
  { id: "audio", label: "Nahrávka" },
  { id: "video", label: "Video" },
] as const;

const CLEARED_VIDEO_PLACEMENT = {
  videoBeforeQuestion: false,
  videoDuringQuestion: false,
  videoOnNextSlide: false,
  videoOnAnswerSlide: false,
  videoBeforeAnswer: false,
  videoAfterAnswer: false,
} as const;

function videoUrlPatch(current: QuizQuestionItem, url: string): Partial<QuizQuestionItem> {
  const trimmed = url.trim();
  if (!trimmed) return { videoUrl: "", videoQuestionSeconds: undefined, videoQuestionAudioOnly: undefined, ...CLEARED_VIDEO_PLACEMENT };
  if (current.videoUrl?.trim()) return { videoUrl: trimmed };
  return {
    videoUrl: trimmed,
    videoBeforeQuestion: false,
    videoDuringQuestion: true,
    videoOnNextSlide: false,
    videoOnAnswerSlide: false,
    videoBeforeAnswer: false,
    videoAfterAnswer: false,
  };
}

function VideoQuestionClipField({
  url,
  seconds,
  onChange,
}: {
  url: string;
  seconds: number | undefined;
  onChange: (seconds: number | undefined) => void;
}) {
  const [duration, setDuration] = useState<number | null>(null);

  useEffect(() => {
    const src = playbackMediaSrc(url);
    if (!src) {
      setDuration(null);
      return;
    }
    const video = document.createElement("video");
    video.preload = "metadata";
    const onMeta = () => {
      if (Number.isFinite(video.duration) && video.duration > 0) setDuration(Math.round(video.duration));
    };
    video.addEventListener("loadedmetadata", onMeta);
    video.src = src;
    return () => {
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeAttribute("src");
      video.load();
    };
  }, [url]);

  return (
    <div className="space-y-1.5">
      <label className="label">V otázke pustiť len začiatok</label>
      <div className="flex items-center gap-2 max-w-xs">
        <input
          className="input"
          type="number"
          min={1}
          step={1}
          inputMode="numeric"
          placeholder="celé"
          value={seconds ?? ""}
          onChange={(e) => {
            const raw = e.target.value.trim().replace(",", ".");
            if (!raw) {
              onChange(undefined);
              return;
            }
            const next = Number(raw);
            onChange(Number.isFinite(next) && next > 0 ? Math.round(next * 10) / 10 : undefined);
          }}
        />
        <span className="text-sm text-brand-muted shrink-0">sekúnd</span>
      </div>
      <p className="text-brand-muted text-xs leading-relaxed">
        Napríklad 17 z tridsaťsekundovej scény. Pri správnych odpovediach ide ukážka celá od začiatku.
        {duration ? ` Celá ukážka má ${duration} s.` : ""}
        {" "}Prázdne pole znamená, že aj v otázke pôjde celé video.
      </p>
    </div>
  );
}

function MediaPlacementFields({
  title,
  noun,
  beforeQuestion,
  during,
  onNext,
  onAnswer,
  beforeAnswer,
  afterAnswer,
  coupleAnswer = true,
  onChange,
}: {
  title: string;
  noun: "fotka" | "video";
  beforeQuestion: boolean;
  during: boolean;
  onNext: boolean;
  onAnswer: boolean;
  beforeAnswer: boolean;
  afterAnswer: boolean;
  /** Pri fotke zostáva odpoveď zviazaná s otázkou. Pri videu sa volí samostatne. */
  coupleAnswer?: boolean;
  onChange: (patch: {
    beforeQuestion?: boolean;
    during?: boolean;
    onNext?: boolean;
    onAnswer?: boolean;
    beforeAnswer?: boolean;
    afterAnswer?: boolean;
  }) => void;
}) {
  const answerLocked = coupleAnswer && during;
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-brand-muted uppercase tracking-wider">{title}</p>
      <label className="flex items-center gap-2 text-sm text-brand-text cursor-pointer">
        <input
          type="checkbox"
          checked={beforeQuestion}
          onChange={(e) => onChange({ beforeQuestion: e.target.checked })}
          className="rounded border-brand-border"
        />
        Slide pred otázkou (fullscreen {noun})
      </label>
      <label className="flex items-center gap-2 text-sm text-brand-text cursor-pointer">
        <input
          type="checkbox"
          checked={during}
          onChange={(e) =>
            onChange({
              during: e.target.checked,
              ...(coupleAnswer && e.target.checked ? { onAnswer: true } : {}),
            })
          }
          className="rounded border-brand-border"
        />
        {coupleAnswer ? "Na slide s otázkou a odpoveďou (spolu s textom)" : "Na slide s otázkou (spolu s textom)"}
      </label>
      <label className="flex items-center gap-2 text-sm text-brand-text cursor-pointer">
        <input
          type="checkbox"
          checked={onNext}
          onChange={(e) => onChange({ onNext: e.target.checked })}
          className="rounded border-brand-border"
        />
        Slide po otázke (fullscreen {noun})
      </label>
      <label className={`flex items-center gap-2 text-sm cursor-pointer ${answerLocked ? "text-brand-muted" : "text-brand-text"}`}>
        <input
          type="checkbox"
          checked={answerLocked || onAnswer}
          disabled={answerLocked}
          onChange={(e) => onChange({ onAnswer: e.target.checked })}
          className="rounded border-brand-border disabled:opacity-60"
        />
        {coupleAnswer
          ? `Pri správnej odpovedi (automaticky zapnuté ak je ${noun} pri otázke)`
          : "Pri správnej odpovedi (spolu s textom)"}
      </label>
      <p className="text-xs font-semibold text-brand-muted uppercase tracking-wider pt-2">
        Pri správnych odpovediach (separátne fullscreen)
      </p>
      <label className="flex items-center gap-2 text-sm text-brand-text cursor-pointer">
        <input
          type="checkbox"
          checked={beforeAnswer}
          onChange={(e) =>
            onChange({
              beforeAnswer: e.target.checked,
              ...(coupleAnswer && e.target.checked && !during ? { onAnswer: false } : {}),
            })
          }
          className="rounded border-brand-border"
        />
        Slide pred správnou odpoveďou (fullscreen {noun})
      </label>
      <label className="flex items-center gap-2 text-sm text-brand-text cursor-pointer">
        <input
          type="checkbox"
          checked={afterAnswer}
          onChange={(e) =>
            onChange({
              afterAnswer: e.target.checked,
              ...(coupleAnswer && e.target.checked && !during ? { onAnswer: false } : {}),
            })
          }
          className="rounded border-brand-border"
        />
        Slide po správnej odpovedi (fullscreen {noun})
      </label>
    </div>
  );
}

function NormalQuestionMedia({
  question,
  choice,
  onChoice,
  onImage,
  onAudio,
  onVideo,
  onUploadError,
  onUploadSuccess,
}: {
  question: QuizQuestionItem;
  choice: (typeof NORMAL_MEDIA_CHOICES)[number]["id"];
  onChoice: (choice: (typeof NORMAL_MEDIA_CHOICES)[number]["id"]) => void;
  onImage: (url: string) => void;
  onAudio: (url: string) => void;
  onVideo: (url: string) => void;
  onUploadError: (text: string) => void;
  onUploadSuccess: (text: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="label">Vloženie</p>
        <div className="flex flex-wrap gap-1.5">
          {NORMAL_MEDIA_CHOICES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onChoice(item.id)}
              className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-colors ${
                choice === item.id
                  ? "bg-brand-orange text-brand-btn-fg border-brand-orange"
                  : "btn-outline"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      {choice === "image" && (
        <ImageUrlField
          value={question.imageUrl ?? ""}
          onChange={onImage}
          onUploadError={onUploadError}
          onUploadSuccess={onUploadSuccess}
        />
      )}
      {choice === "audio" && (
        <AudioUrlField
          label="Nahrávka"
          value={question.audioUrl ?? ""}
          onChange={onAudio}
          onUploadError={onUploadError}
          onUploadSuccess={onUploadSuccess}
        />
      )}
      {choice === "video" && (
        <VideoUrlField
          label="Video"
          value={question.videoUrl ?? ""}
          onChange={onVideo}
          onUploadError={onUploadError}
          onUploadSuccess={onUploadSuccess}
        />
      )}
    </div>
  );
}

export default function QuizLibraryEditor({ quizId, initialQuiz = null }: Props) {
  const [quiz, setQuiz] = useState<QuizLibraryItem | null>(initialQuiz);
  const [loading, setLoading] = useState(!initialQuiz);
  const [draftRestored, setDraftRestored] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [normalMediaChoice, setNormalMediaChoice] = useState<
    Record<string, "none" | "image" | "audio" | "video">
  >({});
  const [events, setEvents] = useState<QuizEvent[]>([]);
  const [playEventSlug, setPlayEventSlug] = useState("");
  const [answerKeyOpen, setAnswerKeyOpen] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [openRound, setOpenRound] = useState<number>(1);
  const [dragRound, setDragRound] = useState<number | null>(null);
  const [dragQuestionId, setDragQuestionId] = useState<string | null>(null);
  const [otherUsedIds, setOtherUsedIds] = useState<string[]>([]);
  const [otherUsedBodies, setOtherUsedBodies] = useState<string[]>([]);
  const [customBankQuestions, setCustomBankQuestions] = useState<CustomBankQuestion[]>([]);
  const [musicBankTracks, setMusicBankTracks] = useState<MusicBankItem[]>([]);
  const [soundBankClips, setSoundBankClips] = useState<SoundBankItem[]>([]);
  const [videoBankClips, setVideoBankClips] = useState<VideoBankItem[]>([]);
  const [serverBackupFilled, setServerBackupFilled] = useState<number | null>(null);
  const quizRef = useRef<QuizLibraryItem | null>(null);
  const lastSavedJson = useRef("");
  const saveSeq = useRef(0);
  const recentCustomBank = useRef<CustomBankQuestion[]>([]);
  quizRef.current = quiz;

  const refreshMusicBank = useCallback(async () => {
    setMusicBankTracks(await fetchMusicBankFromServer());
  }, []);

  const refreshSoundBank = useCallback(async () => {
    setSoundBankClips(await fetchSoundBankFromServer());
  }, []);

  const restoreAudioClip = useCallback(
    async (input: {
      bankQuestionId?: string;
      label: string;
      answer: string;
      audioUrl: string;
      hostNote?: string;
      tags?: string[];
      presentationFade?: boolean;
    }) => {
      const music = musicBankInputFromReturnedAudio(input);
      if (music) {
        try {
          await addMusicBankItemAsync(music, quizRef.current?.id);
        } catch {
          /* skladba už v banke je */
        }
        await refreshMusicBank();
        return;
      }
      try {
        await addSoundBankItemAsync({
          label: input.label,
          answer: input.answer,
          audioUrl: input.audioUrl,
          note: input.hostNote,
        });
      } catch {
        /* duplicita */
      }
      await refreshSoundBank();
    },
    [refreshMusicBank, refreshSoundBank]
  );

  const refreshVideoBank = useCallback(async () => {
    setVideoBankClips(await fetchVideoBankFromServer());
  }, []);

  const refreshCustomBank = useCallback(async () => {
    const questions = await fetchCustomBankQuestionsFromServer();
    const ids = new Set(questions.map((item) => item.id));
    const deleted = new Set(readDeletedCustomBankIds());
    const localIds = new Set(readCustomBankQuestions().map((item) => item.id));
    recentCustomBank.current = recentCustomBank.current.filter(
      (item) => !deleted.has(item.id) && (ids.has(item.id) || localIds.has(item.id))
    );
    const extra = recentCustomBank.current.filter((item) => !ids.has(item.id));
    setCustomBankQuestions([...extra, ...questions]);
  }, []);

  useEffect(() => {
    const loadOne = (load: () => Promise<void>) => {
      void load().catch(() => {
        window.setTimeout(() => void load().catch(() => undefined), 800);
      });
    };
    loadOne(refreshCustomBank);
    loadOne(refreshMusicBank);
    loadOne(refreshSoundBank);
    loadOne(refreshVideoBank);
    window.addEventListener("mudrc-custom-bank-updated", refreshCustomBank);
    return () => window.removeEventListener("mudrc-custom-bank-updated", refreshCustomBank);
  }, [refreshCustomBank, refreshMusicBank, refreshSoundBank, refreshVideoBank]);

  const load = useCallback(async () => {
    const started = quizRef.current;
    if (!started) setLoading(true);
    const draft = readQuizDraft(quizId);
    const res = await fetch(`/api/admin/quiz-library/${quizId}?_=${Date.now()}`, { cache: "no-store" });

    if (res.ok) {
      const serverQuiz = parseQuizPayload(await res.json());
      if (started && quizRef.current !== started) {
        setLoading(false);
        return;
      }
      const active = draft ? normalizeLibraryQuiz(draft) : serverQuiz;
      lastSavedJson.current = JSON.stringify(serverQuiz);
      if (draft) {
        setQuiz(active);
        setDraftRestored(true);
      } else {
        setQuiz(serverQuiz);
        setDraftRestored(false);
      }
      const local = readQuizLocalBackup(quizId);
      const filledNow = countFilledQuizQuestions(active.questions);
      const filledLocal = local ? countFilledQuizQuestions(local.questions) : 0;
      if (filledLocal >= filledNow + 5) {
        setMsg({
          text: `V prehliadači je záloha s ${filledLocal} vyplnenými otázkami (teraz ${filledNow}). Skús „Obnoviť zálohu z prehliadača“.`,
          ok: false,
        });
      }
    } else if (draft) {
      setQuiz(normalizeLibraryQuiz(draft));
      setDraftRestored(true);
    } else {
      setQuiz(null);
      setDraftRestored(false);
    }

    setLoading(false);
  }, [quizId]);

  useEffect(() => {
    load();
    fetch(`/api/admin/events?_=${Date.now()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setEvents(d.events ?? []));
    void fetch(`/api/admin/quiz-library/${quizId}/backup`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { filledCount?: number }) => {
        if (typeof d.filledCount === "number" && d.filledCount > 0) {
          setServerBackupFilled(d.filledCount);
        }
      })
      .catch(() => {});
  }, [load, quizId]);

  useEffect(() => {
    if (!quiz || loading) return;
    writeQuizDraft(quiz);
  }, [quiz, loading]);

  useEffect(() => {
    if (!draftRestored) return;
    setMsg({
      text: "Obnovený koncept sa ukladá.",
      ok: true,
    });
  }, [draftRestored]);

  const questions = useMemo(() => quiz?.questions ?? [], [quiz?.questions]);
  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/admin/quiz-library?usedKeys=1&exclude=${encodeURIComponent(quizId)}&_=${Date.now()}`, {
      cache: "no-store",
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { usedBankQuestionIds?: unknown; usedBodies?: unknown } | null) => {
        if (cancelled || !data) return;
        setOtherUsedIds(
          Array.isArray(data.usedBankQuestionIds)
            ? data.usedBankQuestionIds.filter((id): id is string => typeof id === "string")
            : []
        );
        setOtherUsedBodies(
          Array.isArray(data.usedBodies) ? data.usedBodies.filter((id): id is string => typeof id === "string") : []
        );
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [quizId]);

  const globalUsedBankQuestionIds = useMemo(() => {
    const fromCurrent = quiz ? collectUsedBankQuestionIdsFromQuiz(quiz) : [];
    return Array.from(new Set([...otherUsedIds, ...fromCurrent]));
  }, [otherUsedIds, quiz]);
  const usedQuestionBodies = useMemo(() => {
    const current = quiz ? collectUsedQuestionBodyKeys([quiz]) : [];
    return Array.from(new Set([...otherUsedBodies, ...current]));
  }, [otherUsedBodies, quiz]);
  const presentationCount = useMemo(
    () => (questions.length ? buildPresentationSlides(questions, quiz?.promos ?? []).length : 0),
    [questions, quiz?.promos]
  );

  const updateQuestion = (id: string, patch: Partial<QuizQuestionItem>) => {
    setQuiz((prev) =>
      prev
        ? {
            ...prev,
            questions: prev.questions.map((q) => (q.id === id ? { ...q, ...patch } : q)),
          }
        : prev
    );
  };

  const moveQuestion = (questionId: string, direction: "up" | "down") => {
    setQuiz((prev) => {
      if (!prev) return prev;
      const nextQuestions = moveQuestionByDirection(prev.questions, questionId, direction);
      if (nextQuestions === prev.questions) return prev;
      return { ...prev, questions: nextQuestions };
    });
  };

  const handleQuestionDrop = (targetId: string) => {
    if (!dragQuestionId || dragQuestionId === targetId) return;
    const dragged = questions.find((q) => q.id === dragQuestionId);
    const target = questions.find((q) => q.id === targetId);
    if (!dragged || !target || dragged.roundNumber !== target.roundNumber) return;

    const round = questionsInRound(questions, target.roundNumber);
    const toIndex = round.findIndex((q) => q.id === targetId);
    setQuiz((prev) =>
      prev ? { ...prev, questions: moveQuestionToRoundIndex(prev.questions, dragQuestionId, toIndex) } : prev
    );
    setDragQuestionId(null);
  };

  const insertFromBank = (
    bankId: string,
    targetQuestionId: string,
    body: string,
    answer: string,
    options: string[],
    tags: string[],
    isImageQuestion?: boolean,
    hostNote?: string,
    suggestedImageUrl?: string
  ) => {
    const target = questions.find((q) => q.id === targetQuestionId);
    if (!target) return;
    const displacedBankId = target.bankQuestionId;

    let finalBody = body;
    let finalAnswer = answer;
    let finalOptions = options;
    let optionsShuffledFromBank = false;
    let isOrderQuestion = false;
    let isMatchQuestion = false;
    let finalRight: string[] | undefined;

    const rawBank = findRawBankQuestionById(bankId, customBankQuestions);
    const sourceOptions = rawBank?.options?.length ? [...rawBank.options] : options;
    const hasChoices = sourceOptions.some((o) => o.trim());
    if (rawBank?.isMatchQuestion) {
      const mixed = shuffleMatchPairs(rawBank.options ?? [], rawBank.matchRight ?? []);
      finalBody = rawBank.body;
      finalAnswer = mixed.answer;
      finalOptions = mixed.left;
      finalRight = mixed.right;
      optionsShuffledFromBank = mixed.left.length >= 2;
      isMatchQuestion = true;
    } else if (rawBank?.isOrderQuestion) {
      const ordered = sourceOptions.map((option) => option.trim()).filter(Boolean);
      finalBody = rawBank.body;
      finalAnswer = rawBank.answer.trim() || formatOrderAnswer(ordered);
      finalOptions = shuffleOrderItems(ordered);
      optionsShuffledFromBank = finalOptions.length >= 2;
      isOrderQuestion = true;
    } else if (rawBank && hasChoices && !rawBank.isOpenQuestion) {
      const shuffled = shuffleQuestionOptionsForBankInsert({
        options: sourceOptions,
        correctIndex: rawBank.correctIndex,
        answer: rawBank.answer,
      });
      finalBody = rawBank.body;
      finalAnswer = shuffled.answer;
      finalOptions = shuffled.options;
      optionsShuffledFromBank = shuffled.options.length >= 2;
    }

    setQuiz((prev) => {
      if (!prev) return prev;

      let usedIds = [...(prev.usedBankQuestionIds ?? [])];
      if (displacedBankId && displacedBankId !== bankId) {
        usedIds = usedIds.filter((id) => id !== displacedBankId);
      }
      usedIds = Array.from(new Set([...usedIds, bankId]));

      const nextKind = target.kind === "music" ? "music" : "normal";

      return {
        ...prev,
        questions: prev.questions.map((q) =>
          q.id === targetQuestionId
            ? {
                ...q,
                kind: nextKind,
                body: finalBody,
                answer: finalAnswer,
                options: finalOptions.length ? finalOptions : undefined,
                optionsShuffledFromBank: optionsShuffledFromBank || undefined,
                isOrderQuestion: isOrderQuestion || undefined,
                isMatchQuestion: isMatchQuestion || undefined,
                matchRight: finalRight,
                bankQuestionId: bankId,
                tags: tags.length ? tags : undefined,
                hostNote: hostNote?.trim() || undefined,
                audioUrl: undefined,
                videoUrl: undefined,
                mediaLabel: undefined,
                ...(isImageQuestion
                  ? {
                      imageUrl: suggestedImageUrl?.trim() ?? "",
                      imageBeforeQuestion: false,
                      imageDuringQuestion: true,
                      imageOnNextSlide: false,
                      imageOnAnswerSlide: true,
                    }
                  : {
                      imageUrl: undefined,
                      imageDuringQuestion: false,
                      imageBeforeQuestion: undefined,
                      imageOnNextSlide: undefined,
                      imageOnAnswerSlide: undefined,
                    }),
              }
            : q
        ),
        usedBankQuestionIds: usedIds,
      };
    });

    setMsg({
      text:
        displacedBankId && displacedBankId !== bankId
          ? isImageQuestion
            ? "Foto otázka vložená — doplni URL obrázka."
            : "Otázka vložená. Predchádzajúca otázka z banky je znova dostupná."
          : isImageQuestion
            ? "Foto otázka vložená — doplni URL obrázka v editore."
            : "Otázka vložená.",
      ok: true,
    });
  };

  const insertFromMusicBank = (
    bankId: string,
    targetQuestionId: string,
    artist: string,
    title: string,
    audioUrl: string,
    hostNote?: string,
    tags?: string[]
  ) => {
    const label = `${artist} — ${title}`;
    insertFromSoundBank(
      bankId,
      targetQuestionId,
      label,
      label,
      audioUrl,
      hostNote,
      tags,
      DEFAULT_MUSIC_QUESTION_BODY
    );
  };

  const insertFromSoundBank = (
    bankId: string,
    targetQuestionId: string,
    label: string,
    answer: string,
    audioUrl: string,
    hostNote?: string,
    bankTags?: string[],
    bodyOverride?: string,
    audioEdgeFade?: boolean
  ) => {
    const target = questions.find((q) => q.id === targetQuestionId);
    if (!target) return;
    const displacedBankId = target.bankQuestionId;
    const slotIsMusicTail = target.kind === "music";

    const restoreToBank =
      displacedBankId &&
      displacedBankId !== bankId &&
      target.answer?.trim() &&
      target.audioUrl?.trim()
        ? {
            label:
              target.mediaLabel?.trim() ||
              (target.musicArtist?.trim() && target.musicTitle?.trim()
                ? `${target.musicArtist.trim()} — ${target.musicTitle.trim()}`
                : target.answer.trim()),
            answer: target.answer.trim(),
            audioUrl: target.audioUrl.trim(),
            note: target.hostNote?.trim() || undefined,
            tags: target.tags,
            presentationFade: target.audioEdgeFade === true,
          }
        : null;

    setQuiz((prev) => {
      if (!prev) return prev;
      let usedIds = [...(prev.usedBankQuestionIds ?? [])];
      if (displacedBankId && displacedBankId !== bankId) {
        usedIds = usedIds.filter((id) => id !== displacedBankId);
      }
      usedIds = Array.from(new Set([...usedIds, bankId]));
      return {
        ...prev,
        questions: prev.questions.map((q) =>
          q.id === targetQuestionId
            ? {
                ...q,
                kind: slotIsMusicTail ? "music" : "sound",
                body: bodyOverride ?? (slotIsMusicTail ? DEFAULT_MUSIC_QUESTION_BODY : DEFAULT_SOUND_QUESTION_BODY),
                answer,
                mediaLabel: label,
                musicArtist: undefined,
                musicTitle: undefined,
                audioUrl,
                audioEdgeFade: audioEdgeFade ? true : undefined,
                videoUrl: undefined,
                bankQuestionId: bankId,
                hostNote: hostNote?.trim() || undefined,
                options: undefined,
                imageUrl: undefined,
                imageDuringQuestion: false,
                imageBeforeQuestion: undefined,
                imageOnNextSlide: undefined,
                imageOnAnswerSlide: undefined,
                tags: bankTags?.length
                  ? Array.from(new Set([...bankTags, slotIsMusicTail ? "hudba" : "zvuk"]))
                  : [slotIsMusicTail ? "hudba" : "zvuk"],
              }
            : q
        ),
        usedBankQuestionIds: usedIds,
      };
    });

    void (async () => {
      if (restoreToBank && displacedBankId) {
        await restoreAudioClip({
          bankQuestionId: displacedBankId,
          label: restoreToBank.label,
          answer: restoreToBank.answer,
          audioUrl: restoreToBank.audioUrl,
          hostNote: restoreToBank.note,
          tags: restoreToBank.tags,
          presentationFade: restoreToBank.presentationFade,
        });
        return;
      }
      await refreshSoundBank();
    })();

    setMsg({ text: "Zvuková ukážka vložená.", ok: true });
  };

  const insertFromVideoBank = (
    bankId: string,
    targetQuestionId: string,
    label: string,
    answer: string,
    videoUrl: string,
    hostNote?: string,
    bankTags?: string[],
    bodyOverride?: string
  ) => {
    const target = questions.find((q) => q.id === targetQuestionId);
    if (!target) return;
    const displacedBankId = target.bankQuestionId;
    const slotIsMusicTail = target.kind === "music";
    const customBody = bodyOverride?.trim() || "";
    const keepAsNormalQuestion = target.kind === "normal" && Boolean(customBody);

    const restoreToBank =
      displacedBankId &&
      displacedBankId !== bankId &&
      target.mediaLabel?.trim() &&
      target.answer?.trim() &&
      target.videoUrl?.trim()
        ? {
            label: target.mediaLabel.trim(),
            answer: target.answer.trim(),
            videoUrl: target.videoUrl.trim(),
            note: target.hostNote?.trim() || undefined,
            questionBody: target.body.trim() || undefined,
            tags: target.tags,
          }
        : null;

    setQuiz((prev) => {
      if (!prev) return prev;
      let usedIds = [...(prev.usedBankQuestionIds ?? [])];
      if (displacedBankId && displacedBankId !== bankId) {
        usedIds = usedIds.filter((id) => id !== displacedBankId);
      }
      usedIds = Array.from(new Set([...usedIds, bankId]));
      return {
        ...prev,
        questions: prev.questions.map((q) =>
          q.id === targetQuestionId
            ? {
                ...q,
                kind: slotIsMusicTail ? "music" : keepAsNormalQuestion ? "normal" : "video",
                body: customBody || DEFAULT_VIDEO_QUESTION_BODY,
                answer,
                mediaLabel: label,
                videoUrl,
                audioUrl: undefined,
                musicArtist: undefined,
                musicTitle: undefined,
                bankQuestionId: bankId,
                hostNote: hostNote?.trim() || undefined,
                options: undefined,
                imageUrl: undefined,
                imageDuringQuestion: false,
                imageBeforeQuestion: undefined,
                imageOnNextSlide: undefined,
                imageOnAnswerSlide: undefined,
                videoBeforeQuestion: false,
                videoDuringQuestion: true,
                videoOnNextSlide: false,
                videoOnAnswerSlide: false,
                videoBeforeAnswer: false,
                videoAfterAnswer: false,
                tags: bankTags?.length ? Array.from(new Set([...bankTags, "video"])) : ["video"],
              }
            : q
        ),
        usedBankQuestionIds: usedIds,
      };
    });

    void (async () => {
      if (restoreToBank) {
        try {
          await addVideoBankItemAsync(restoreToBank);
        } catch {
          /* duplicita */
        }
      }
      await refreshVideoBank();
    })();

    setMsg({ text: "Video ukážka vložená.", ok: true });
  };

  const takeQuestionOutOfQuiz = (questionId: string, bankId?: string) => {
    setQuiz((prev) =>
      prev
        ? {
            ...prev,
            questions: prev.questions.map((q) =>
              q.id === questionId
                ? {
                    ...q,
                    kind: "normal",
                    body: "",
                    answer: "",
                    musicArtist: undefined,
                    musicTitle: undefined,
                    audioUrl: undefined,
                    audioEdgeFade: undefined,
                    videoUrl: undefined,
                    mediaLabel: undefined,
                    options: undefined,
                    optionsShuffledFromBank: undefined,
                    isOrderQuestion: undefined,
                    isMatchQuestion: undefined,
                    matchRight: undefined,
                    bankQuestionId: undefined,
                    tags: undefined,
                    hostNote: undefined,
                    imageUrl: undefined,
                    imageBeforeQuestion: undefined,
                    imageDuringQuestion: false,
                    imageOnNextSlide: undefined,
                    imageOnAnswerSlide: undefined,
                    ...CLEARED_VIDEO_PLACEMENT,
                    videoQuestionSeconds: undefined,
                    videoQuestionAudioOnly: undefined,
                  }
                : q
            ),
            usedBankQuestionIds: bankId
              ? (prev.usedBankQuestionIds ?? []).filter((id) => id !== bankId)
              : prev.usedBankQuestionIds,
          }
        : prev
    );
  };

  const returnQuestionToBank = (questionId: string) => {
    const question = questions.find((q) => q.id === questionId);
    const bankId = question?.bankQuestionId;
    if (!bankId) return;
    if (!window.confirm("Vrátiť otázku do banky? Obsah otázky sa vymaže.")) return;

    const soundRestore =
      (question?.kind === "sound" || question?.kind === "music") &&
      question.answer?.trim() &&
      question.audioUrl?.trim()
        ? {
            bankQuestionId: bankId,
            label:
              question.mediaLabel?.trim() ||
              (question.musicArtist?.trim() && question.musicTitle?.trim()
                ? `${question.musicArtist.trim()} — ${question.musicTitle.trim()}`
                : question.answer.trim()),
            answer: question.answer.trim(),
            audioUrl: question.audioUrl.trim(),
            hostNote: question.hostNote?.trim() || undefined,
            tags: question.tags,
            presentationFade: question.audioEdgeFade === true,
          }
        : null;

    const videoRestore =
      question?.kind === "video" &&
      question.answer?.trim() &&
      question.videoUrl?.trim()
        ? {
            label: question.mediaLabel?.trim() || question.answer.trim(),
            answer: question.answer.trim(),
            videoUrl: question.videoUrl.trim(),
            note: question.hostNote?.trim() || undefined,
            questionBody: question.body.trim() || undefined,
            tags: question.tags,
          }
        : null;

    const customRestore =
      question &&
      isCustomBankQuestionId(bankId) &&
      question.body.trim() &&
      question.answer.trim()
        ? (() => {
            if (question.isMatchQuestion) {
              const pairs = matchPairsFromQuiz(question.options ?? [], question.matchRight ?? [], question.answer);
              return {
                body: question.body.trim(),
                options: pairs.map((pair) => pair.left),
                matchRight: pairs.map((pair) => pair.right),
                correctIndex: 0,
                answer: formatMatchBankAnswer(pairs),
                note: question.hostNote?.trim() || undefined,
                tags: question.tags,
                isOpenQuestion: false,
                isOrderQuestion: false,
                isMatchQuestion: true,
                isImageQuestion: Boolean(question.imageUrl?.trim() || question.imageDuringQuestion),
                suggestedImageUrl: question.imageUrl?.trim() || undefined,
                theme: inferBankTheme({
                  tags: question.tags,
                  body: question.body,
                  note: question.hostNote,
                  hint: quizRef.current?.title,
                }),
              };
            }
            const ordered = question.isOrderQuestion ? orderItemsFromAnswer(question.answer) : [];
            const options = ordered.length >= 2 ? ordered : [...(question.options ?? [])];
            while (!question.isOrderQuestion && options.length < 6) options.push("");
            const hasChoices = options.some((o) => o.trim());
            const correctIndex = hasChoices
              ? Math.max(0, options.findIndex((o) => o.trim() === question.answer.trim()))
              : 0;
            return {
              body: question.body.trim(),
              options: question.isOrderQuestion ? options.filter((option) => option.trim()) : options.slice(0, 6),
              correctIndex: question.isOrderQuestion ? 0 : correctIndex,
              answer: question.isOrderQuestion
                ? question.answer.trim() || formatOrderAnswer(options)
                : question.answer.trim(),
              note: question.hostNote?.trim() || undefined,
              tags: question.tags,
              isOpenQuestion: question.isOrderQuestion ? false : !hasChoices,
              isOrderQuestion: question.isOrderQuestion === true,
              isMatchQuestion: false,
              isImageQuestion: Boolean(question.imageUrl?.trim() || question.imageDuringQuestion),
              suggestedImageUrl: question.imageUrl?.trim() || undefined,
              theme: inferBankTheme({
                tags: question.tags,
                body: question.body,
                note: question.hostNote,
                hint: quizRef.current?.title,
              }),
            };
          })()
        : null;

    takeQuestionOutOfQuiz(questionId, bankId);

    if (soundRestore) {
      void restoreAudioClip(soundRestore).catch(() => {
        setMsg({ text: "Slot vyprázdnený, ukážku sa nepodarilo vrátiť do banky.", ok: false });
      });
    } else if (videoRestore) {
      void addVideoBankItemAsync(videoRestore)
        .then(() => refreshVideoBank())
        .catch(() => {
          setMsg({ text: "Slot vyprázdnený, video sa nepodarilo vrátiť do banky.", ok: false });
        });
    } else if (customRestore) {
      const bodyKey = quizQuestionBodyKey(customRestore.body);
      const alreadyThere =
        customBankQuestions.some(
          (item) => item.id === bankId || quizQuestionBodyKey(item.body) === bodyKey
        ) || recentCustomBank.current.some((item) => quizQuestionBodyKey(item.body) === bodyKey);
      window.dispatchEvent(
        new CustomEvent("mudrc-show-bank-question", {
          detail: { theme: customRestore.theme, photo: customRestore.isImageQuestion === true },
        })
      );
      if (!alreadyThere) {
        void addCustomBankQuestionAsync(customRestore)
          .then(() => refreshCustomBank())
          .catch(() => {
            setMsg({ text: "Slot vyprázdnený, ale otázku sa nepodarilo vrátiť do banky.", ok: false });
          });
      } else {
        void refreshCustomBank();
      }
    }

    setMsg({ text: "Otázka vrátená do banky.", ok: true });
  };

  const saveOwnQuestionToBank = (questionId: string) => {
    const question = questions.find((q) => q.id === questionId);
    if (!question?.body.trim() || !question.answer.trim()) {
      setMsg({ text: "Do banky treba text otázky aj správnu odpoveď.", ok: false });
      return;
    }

    const videoUrl = question.videoUrl?.trim() ?? "";
    if (videoUrl) {
      if (!window.confirm("Uložiť toto video medzi videá? V kvíze ostane, aj so súborom.")) return;
      void addVideoBankItemAsync({
        label: question.mediaLabel?.trim() || question.body.trim(),
        answer: question.answer.trim(),
        videoUrl,
        note: question.hostNote?.trim() || undefined,
        questionBody: question.body.trim(),
        tags: question.tags,
      })
        .then(() => {
          void refreshVideoBank();
          setMsg({ text: "Video je v banke medzi videami. V tomto kvíze ostalo.", ok: true });
        })
        .catch((err) =>
          setMsg({
            text: err instanceof Error ? err.message : "Video sa nepodarilo uložiť do banky.",
            ok: false,
          })
        );
      return;
    }

    const audioUrl = question.audioUrl?.trim() ?? "";
    if (audioUrl) {
      const song = artistTitleFromAnswer(question.answer);
      const namedSong =
        song ??
        (question.musicArtist?.trim() && question.musicTitle?.trim()
          ? { artist: question.musicArtist.trim(), title: question.musicTitle.trim() }
          : null);
      const where = namedSong ? "hudobné ukážky" : "iné ukážky";
      if (
        !window.confirm(
          namedSong
            ? "Uložiť túto skladbu medzi hudobné ukážky? V kvíze ostane."
            : "Uložiť túto ukážku medzi iné ukážky? V kvíze ostane."
        )
      ) {
        return;
      }
      const fail = (err: unknown) =>
        setMsg({
          text: err instanceof Error ? err.message : "Ukážku sa nepodarilo uložiť do banky.",
          ok: false,
        });
      if (namedSong) {
        void addMusicBankItemAsync(
          {
            artist: namedSong.artist,
            title: namedSong.title,
            audioUrl,
            note: question.hostNote?.trim() || undefined,
            tags: question.tags,
            presentationFade: question.audioEdgeFade === true ? true : undefined,
          },
          quizRef.current?.id
        )
          .then(() => {
            void refreshMusicBank();
            setMsg({ text: `Skladba je v banke medzi ${where}. V tomto kvíze ostala.`, ok: true });
          })
          .catch(fail);
        return;
      }
      void addSoundBankItemAsync({
        label: question.mediaLabel?.trim() || question.body.trim(),
        answer: question.answer.trim(),
        audioUrl,
        note: question.hostNote?.trim() || undefined,
        questionBody: question.body.trim(),
        tags: question.tags,
      })
        .then(() => {
          void refreshSoundBank();
          setMsg({ text: `Ukážka je v banke medzi ${where}. V tomto kvíze ostala.`, ok: true });
        })
        .catch(fail);
      return;
    }

    if (question.isMatchQuestion && matchPairsFromQuiz(question.options ?? [], question.matchRight ?? [], question.answer).length < 2) {
      setMsg({ text: "Priraďovacia otázka potrebuje aspoň dve dvojice.", ok: false });
      return;
    }

    if (
      !window.confirm(
        "Prehodiť otázku do banky? Z tohto kvízu zmizne a ostane len v banke."
      )
    ) {
      return;
    }

    const matchPairs = question.isMatchQuestion
      ? matchPairsFromQuiz(question.options ?? [], question.matchRight ?? [], question.answer)
      : [];
    const ordered = !question.isMatchQuestion && question.isOrderQuestion ? orderItemsFromAnswer(question.answer) : [];
    const options = question.isMatchQuestion
      ? matchPairs.map((pair) => pair.left)
      : ordered.length >= 2
        ? ordered
        : [...(question.options ?? [])];
    while (!question.isMatchQuestion && !question.isOrderQuestion && options.length < 6) options.push("");
    const hasChoices = options.some((option) => option.trim());
    const matched = hasChoices ? options.findIndex((option) => option.trim() === question.answer.trim()) : -1;
    const bodyKey = quizQuestionBodyKey(question.body);
    const existing = customBankQuestions.find(
      (item) => isCustomBankQuestionId(item.id) && quizQuestionBodyKey(item.body) === bodyKey
    );
    const input = {
      body: question.body.trim(),
      options: question.isMatchQuestion
        ? matchPairs.map((pair) => pair.left)
        : question.isOrderQuestion
          ? options.filter((option) => option.trim())
          : options.slice(0, 6),
      matchRight: question.isMatchQuestion ? matchPairs.map((pair) => pair.right) : undefined,
      correctIndex: question.isMatchQuestion || question.isOrderQuestion ? 0 : matched >= 0 ? matched : 0,
      answer: question.isMatchQuestion
        ? formatMatchBankAnswer(matchPairs)
        : question.isOrderQuestion
          ? question.answer.trim() || formatOrderAnswer(options)
          : question.answer.trim(),
      note: question.hostNote?.trim() || undefined,
      tags: question.tags,
      theme:
        existing?.theme ||
        inferBankTheme({
          tags: question.tags,
          body: question.body,
          note: question.hostNote,
          hint: quiz?.title,
        }),
      isOpenQuestion: question.isMatchQuestion || question.isOrderQuestion ? false : matched < 0,
      isOrderQuestion: question.isOrderQuestion === true && question.isMatchQuestion !== true,
      isMatchQuestion: question.isMatchQuestion === true,
      isImageQuestion: Boolean(question.imageUrl?.trim() || question.imageDuringQuestion),
      suggestedImageUrl: question.imageUrl?.trim() || undefined,
    };

    const finish = () => {
      takeQuestionOutOfQuiz(questionId);
      setMsg({ text: "Otázka je v banke a z tohto kvízu je preč.", ok: true });
      window.dispatchEvent(
        new CustomEvent("mudrc-show-bank-question", {
          detail: { theme: input.theme, photo: input.isImageQuestion === true },
        })
      );
      void refreshCustomBank();
    };

    if (existing) {
      void updateCustomBankQuestionAsync(existing.id, input)
        .then(() => finish())
        .catch(() => setMsg({ text: "Otázku sa nepodarilo uložiť do banky.", ok: false }));
      return;
    }

    void addCustomBankQuestionAsync(input)
      .then((created) => {
        recentCustomBank.current = [
          created,
          ...recentCustomBank.current.filter((item) => item.id !== created.id),
        ];
        finish();
      })
      .catch((err) =>
        setMsg({
          text: err instanceof Error ? err.message : "Otázku sa nepodarilo uložiť do banky.",
          ok: false,
        })
      );
  };

  const updateQuestionOptions = (id: string, options: string[]) => {
    const question = questions.find((q) => q.id === id);
    const cap = question?.isOrderQuestion ? ORDER_OPTION_MAX : 6;
    const cleaned = options.map((option) => option.trim()).filter(Boolean).slice(0, cap);
    updateQuestion(id, { options: cleaned.length ? cleaned : undefined });
  };

  const addQuestionOption = (id: string) => {
    const question = questions.find((q) => q.id === id);
    if (!question) return;
    const current = question.options ?? [];
    const cap = question.isOrderQuestion ? ORDER_OPTION_MAX : 6;
    if (current.length >= cap) return;
    updateQuestion(id, { options: [...current, ""] });
  };

  const moveQuestionOption = (id: string, index: number, direction: -1 | 1) => {
    const question = questions.find((q) => q.id === id);
    if (!question) return;
    const next = [...(question.options ?? [])];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    const current = next[index] ?? "";
    next[index] = next[target] ?? "";
    next[target] = current;
    updateQuestion(id, { options: next });
  };

  const removeQuestionOption = (id: string, index: number) => {
    const question = questions.find((q) => q.id === id);
    if (!question) return;
    const next = (question.options ?? []).filter((_, i) => i !== index);
    updateQuestion(id, { options: next.length ? next : undefined });
  };

  const setQuestionOption = (id: string, index: number, value: string) => {
    const question = questions.find((q) => q.id === id);
    if (!question) return;
    const next = [...(question.options ?? [])];
    next[index] = value;
    updateQuestion(id, { options: next });
  };

  const roundQuestions = useMemo(() => questionsInRound(questions, openRound), [questions, openRound]);
  const roundQuestionSections = useMemo(() => {
    return [{ key: "all", title: null as string | null, items: roundQuestions }];
  }, [roundQuestions]);

  const roundNumbers = useMemo(() => {
    const rounds = new Set<number>([1, 2, 3, 4]);
    for (const question of questions) {
      if (question.roundNumber >= 1) rounds.add(question.roundNumber);
    }
    return Array.from(rounds).sort((a, b) => a - b);
  }, [questions]);

  const moveRoundTo = (fromRound: number, toIndex: number) => {
    const fromIndex = roundNumbers.indexOf(fromRound);
    if (fromIndex < 0 || toIndex < 0 || toIndex >= roundNumbers.length || fromIndex === toIndex) return;
    const next = [...roundNumbers];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setQuiz((prev) => (prev ? { ...prev, questions: reorderQuizRounds(prev.questions, next) } : prev));
    setOpenRound(toIndex + 1);
    setMsg({ text: `Kolo presunuté na pozíciu ${toIndex + 1}.`, ok: true });
  };

  const addRound = () => {
    const next = Math.max(4, ...questions.map((question) => question.roundNumber), 0) + 1;
    setOpenRound(next);
    setQuiz((prev) =>
      prev
        ? {
            ...prev,
            questions: insertQuestionAfter(prev.questions, next, "normal", 0),
          }
        : prev
    );
    setMsg({ text: `Kolo ${next} pridané. Vlož doň otázky.`, ok: true });
  };

  const insertEmptyQuestion = (afterQuestionNumber: number, kind: QuizQuestionKind, afterLabel?: number) => {
    setQuiz((prev) =>
      prev
        ? {
            ...prev,
            questions: insertQuestionAfter(prev.questions, openRound, kind, afterQuestionNumber),
          }
        : prev
    );
    setMsg({
      text: afterLabel
        ? `Prázdna otázka vložená za otázku ${afterLabel} — doplni ju z banky alebo ručne.`
        : "Prázdna otázka vložená na začiatok kola — doplni ju z banky alebo ručne.",
      ok: true,
    });
  };

  const deleteQuestion = (questionId: string) => {
    const question = questions.find((q) => q.id === questionId);
    if (!question) return;

    const label = `otázku ${displayQuestionNumber(question)}`;
    const bankNote = question.bankQuestionId ? " Otázka z banky bude znova dostupná." : "";

    if (!window.confirm(`Naozaj zmazať ${label}?${bankNote}`)) return;

    setQuiz((prev) => {
      if (!prev) return prev;
      const bankId = question.bankQuestionId;
      return {
        ...prev,
        questions: removeQuestion(prev.questions, questionId),
        usedBankQuestionIds: bankId
          ? (prev.usedBankQuestionIds ?? []).filter((id) => id !== bankId)
          : prev.usedBankQuestionIds,
      };
    });
    setMsg({ text: "Otázka je preč. Novú pridáš cez Vložiť otázku.", ok: true });
  };

  const regenerateTemplate = () => {
    if (!window.confirm("Vymazať obsah a vytvoriť prázdnu štruktúru (klasické + zvuk + video + hudba)?")) return;
    setQuiz((prev) => (prev ? { ...prev, questions: buildStandardMudrcQuestions() } : prev));
    setMsg({ text: "Štruktúra pripravená — doplň otázky a odpovede.", ok: true });
  };

  const restoreFromLocalBackup = () => {
    const backup = readQuizLocalBackup(quizId);
    if (!backup) {
      setMsg({ text: "V prehliadači nie je žiadna záloha tohto kvízu.", ok: false });
      return;
    }
    const filled = countFilledQuizQuestions(backup.questions);
    if (
      !window.confirm(
        `Obnoviť kvíz zo zálohy v prehliadači? (${filled} vyplnených otázok — neuložené zmeny sa prepíšu.)`
      )
    ) {
      return;
    }
    setQuiz(normalizeLibraryQuiz(backup));
    setDraftRestored(true);
    setMsg({ text: "Záloha z prehliadača obnovená — skontroluj a ulož.", ok: true });
  };

  const restoreFromServerBackup = async () => {
    if (
      !window.confirm(
        "Obnoviť kvíz zo serverovej zálohy (stav tesne pred posledným úspešným uložením)?"
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/quiz-library/${quizId}/backup`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ text: data.error ?? "Záloha na serveri nie je k dispozícii.", ok: false });
        return;
      }
      const restored = parseQuizPayload(data);
      clearQuizDraft(quizId);
      setQuiz(restored);
      setDraftRestored(false);
      setMsg({ text: "Kvíz obnovený zo serverovej zálohy.", ok: true });
    } catch {
      setMsg({ text: "Obnova zo servera zlyhala.", ok: false });
    } finally {
      setSaving(false);
    }
  };

  const saveInflight = useRef(false);
  const saveQueued = useRef<QuizLibraryItem | null>(null);

  const persistQuizNow = useCallback(
    async (snapshot: QuizLibraryItem, seq: number) => {
      if (saveInflight.current) {
        saveQueued.current = snapshot;
        return;
      }
      saveInflight.current = true;
      setSaving(true);
      try {
        const res = await fetch(`/api/admin/quiz-library/${quizId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(snapshot),
          signal: AbortSignal.timeout(45000),
        });
        if (seq !== saveSeq.current) return;
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setMsg({ text: err.error ?? "Uloženie zlyhalo.", ok: false });
          return;
        }
        const saved = parseQuizPayload(await res.json());
        lastSavedJson.current = JSON.stringify(saved);
        clearQuizDraft(quizId);
        setDraftRestored(false);
        if (quizRef.current && JSON.stringify(quizRef.current) === JSON.stringify(snapshot)) {
          setQuiz(saved);
        }
        setMsg({ text: "Uložené.", ok: true });
      } catch (err) {
        const aborted = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
        if (aborted) saveQueued.current = null;
        if (seq === saveSeq.current) {
          setMsg({
            text: aborted
              ? "Ukladanie trvá dlhšie. Zmeny sú v tomto okne, počkaj a skús Uložiť ešte raz."
              : "Uloženie zlyhalo. Skús to znova.",
            ok: false,
          });
        }
      } finally {
        saveInflight.current = false;
        if (seq === saveSeq.current) setSaving(false);
        const next = saveQueued.current;
        saveQueued.current = null;
        if (next) void persistQuizNow(next, saveSeq.current);
      }
    },
    [quizId]
  );

  useEffect(() => {
    if (!quiz || loading) return;
    const json = JSON.stringify(quiz);
    if (json === lastSavedJson.current) return;
    writeQuizDraft(quiz);
    const seq = ++saveSeq.current;
    const snapshot = quiz;
    const timer = window.setTimeout(() => {
      void persistQuizNow(snapshot, seq);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [quiz, loading, persistQuizNow]);

  const save = async () => {
    const snapshot = quizRef.current;
    if (!snapshot) return;
    const seq = ++saveSeq.current;
    await persistQuizNow(snapshot, seq);
  };

  const exportPdf = async () => {
    const snapshot = quizRef.current;
    if (!snapshot || exportingPdf) return;
    setExportingPdf(true);
    setMsg(null);
    try {
      const { downloadQuizPdf } = await import("@/lib/quiz-pdf");
      await downloadQuizPdf(snapshot.title, snapshot.questions);
      setMsg({ text: "PDF je stiahnuté. Otázky sú v ňom ako obrázok, text sa nedá označiť.", ok: true });
    } catch (error) {
      setMsg({ text: error instanceof Error ? error.message : "PDF sa nepodarilo vytvoriť.", ok: false });
    } finally {
      setExportingPdf(false);
    }
  };

  if (loading) return <p className="text-brand-muted text-sm">Načítavam…</p>;
  if (!quiz) return <p className="text-red-500 text-sm">Kvíz sa nepodarilo načítať.</p>;

  return (
    <div className="min-w-0 max-w-full space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Názov kvízu</label>
          <input
            className="input"
            value={quiz.title}
            onChange={(e) => setQuiz({ ...quiz, title: e.target.value })}
            placeholder="napr. Kvíz #12 — Filmové klasiky"
          />
        </div>
        <div>
          <label className="label">Poznámka</label>
          <input
            className="input"
            value={quiz.notes ?? ""}
            onChange={(e) => setQuiz({ ...quiz, notes: e.target.value })}
            placeholder="Téma, obtiažnosť…"
          />
        </div>
      </div>

      <QuizPromoEditor
        promos={quiz.promos ?? []}
        rounds={Array.from(new Set(questions.map((question) => question.roundNumber)))
          .filter((round) => round >= 1)
          .sort((a, b) => a - b)}
        onChange={(promos) => setQuiz({ ...quiz, promos: promos.length ? promos : undefined })}
      />

      <CustomBankQuestionForm
        onAdded={(question) => {
          recentCustomBank.current = [
            question,
            ...recentCustomBank.current.filter((item) => item.id !== question.id),
          ];
          void refreshCustomBank();
        }}
      />
      <MusicBankQuestionForm
        onAdded={() => {
          void refreshMusicBank();
          void refreshSoundBank();
        }}
        onMessage={(text, ok) => setMsg({ text, ok })}
      />
      <VideoBankQuestionForm onAdded={refreshVideoBank} onMessage={(text, ok) => setMsg({ text, ok })} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-brand-muted text-sm">{describeQuizContent(questions)}</p>
          <p className="text-brand-muted text-xs mt-0.5">{presentationCount} slidov na projektore</p>
          {msg && (
            <p className={`text-sm mt-1 ${msg.ok ? "text-green-600" : "text-red-500"}`}>{msg.text}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <label className="label text-xs">Podnik (pravidlá)</label>
            <select className="input text-sm py-2 min-w-[180px]" value={playEventSlug} onChange={(e) => setPlayEventSlug(e.target.value)}>
              <option value="">Pri spustení vyberiem</option>
              {events.map((event) => (
                <option key={event.slug} value={event.slug}>
                  {event.venue}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => setAnswerKeyOpen(true)}
            className="btn-outline text-sm py-2.5 px-4"
          >
            Správne odpovede
          </button>
          <button
            type="button"
            onClick={() => void exportPdf()}
            disabled={exportingPdf}
            className="btn-outline text-sm py-2.5 px-4 disabled:opacity-60"
            title="Stiahne celý kvíz ako PDF, v ktorom sa otázky nedajú označiť ani skopírovať"
          >
            {exportingPdf ? "Pripravujem PDF…" : "PDF"}
          </button>
          <a
            href={`/admin/hotove-kvizy/${quizId}/prehrat${playEventSlug ? `?event=${playEventSlug}` : ""}`}
            className="btn-primary text-sm py-2.5 px-4 inline-flex items-center gap-2"
          >
            <MonitorPlay className="w-4 h-4" />
            Spustiť
          </a>
          <button type="button" onClick={restoreFromLocalBackup} className="btn-outline text-sm py-2.5 px-4">
            Obnoviť zálohu z prehliadača
          </button>
          {serverBackupFilled != null && serverBackupFilled > 0 && (
            <button
              type="button"
              onClick={() => void restoreFromServerBackup()}
              disabled={saving}
              className="btn-outline text-sm py-2.5 px-4"
            >
              Server ({serverBackupFilled} ot.)
            </button>
          )}
          <button type="button" onClick={regenerateTemplate} className="btn-outline text-sm py-2.5 px-4">
            Reset štruktúry
          </button>
          <button type="button" onClick={save} disabled={saving} className="btn-outline text-sm py-2.5 px-4 inline-flex items-center gap-2">
            <Save className="w-4 h-4" />
            {saving ? "Ukladám…" : "Uložené"}
          </button>
        </div>
      </div>

      <QuizTagStats questions={questions} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-w-0 max-w-full">
        <div className="min-w-0 max-w-full space-y-4">
          <div className="flex gap-2 flex-wrap">
            {roundNumbers.map((round, index) => (
              <div
                key={round}
                draggable
                onDragStart={() => setDragRound(round)}
                onDragEnd={() => setDragRound(null)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (dragRound != null) moveRoundTo(dragRound, index);
                  setDragRound(null);
                }}
                className={`inline-flex items-center rounded-xl border ${
                  openRound === round
                    ? "bg-brand-orange text-brand-btn-fg border-brand-orange"
                    : "border-brand-border text-brand-muted"
                } ${dragRound === round ? "opacity-60" : ""}`}
              >
                <button
                  type="button"
                  title="Posunúť kolo dopredu"
                  disabled={index === 0}
                  onClick={() => moveRoundTo(round, index - 1)}
                  className="px-1.5 py-2 disabled:opacity-30"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setOpenRound(round)}
                  className="px-1 py-2 text-sm font-semibold"
                  title="Potiahni sem iné kolo"
                >
                  Kolo {round}
                </button>
                <button
                  type="button"
                  title="Posunúť kolo dozadu"
                  disabled={index === roundNumbers.length - 1}
                  onClick={() => moveRoundTo(round, index + 1)}
                  className="px-1.5 py-2 disabled:opacity-30"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addRound}
              className="px-4 py-2 rounded-xl text-sm font-semibold border border-dashed border-brand-border text-brand-muted hover:border-brand-orange hover:text-brand-orange-readable"
            >
              + Pridať kolo
            </button>
          </div>

          <h3 className="font-display text-xl text-brand-text">
            Kolo {openRound}
            {roundLabels[openRound] ? ` — ${roundLabels[openRound]}` : ""}
          </h3>

          <div className="space-y-1">
        {roundQuestions.length === 0 && (
          <div className="flex items-center justify-center py-6">
            <button
              type="button"
              onClick={() => insertEmptyQuestion(0, "normal")}
              className="text-xs font-semibold text-brand-muted hover:text-brand-orange-readable inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-dashed border-brand-border hover:border-brand-orange bg-brand-card/50 hover:bg-brand-tint/40 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Vložiť otázku
            </button>
          </div>
        )}
        {roundQuestionSections.map((section) => (
          <Fragment key={section.key}>
            {section.title && (
              <p className="text-xs font-bold uppercase tracking-wider text-brand-muted pt-3 pb-1 px-1">
                {section.title}
              </p>
            )}
        {section.items.map((question) => {
          const roundIndex = roundQuestions.findIndex((item) => item.id === question.id);
          const canMoveUp = roundIndex > 0;
          const canMoveDown = roundIndex >= 0 && roundIndex < roundQuestions.length - 1;

          return (
          <Fragment key={question.id}>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              e.currentTarget.classList.add("ring-2", "ring-brand-orange/40");
            }}
            onDragLeave={(e) => {
              e.currentTarget.classList.remove("ring-2", "ring-brand-orange/40");
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.classList.remove("ring-2", "ring-brand-orange/40");
              handleQuestionDrop(question.id);
            }}
            className={`bg-brand-card border border-brand-border rounded-2xl p-4 sm:p-5 space-y-3 transition-shadow min-w-0 max-w-full overflow-hidden ${
              dragQuestionId === question.id ? "opacity-60" : ""
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  draggable
                  onDragStart={() => setDragQuestionId(question.id)}
                  onDragEnd={() => setDragQuestionId(null)}
                  className="p-1 rounded-md text-brand-muted hover:text-brand-text cursor-grab active:cursor-grabbing"
                  title="Presuň pretiahnutím"
                >
                  <GripVertical className="w-4 h-4 shrink-0" />
                </button>
                <span className="text-xs font-bold uppercase tracking-wider text-brand-orange-readable bg-brand-tint px-2.5 py-1 rounded-lg">
                  {`Otázka ${displayQuestionNumber(question)}`}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {(question.bankQuestionId ||
                  (question.kind === "normal" && question.body.trim() && question.answer.trim())) && (
                  <button
                    type="button"
                    onClick={() =>
                      question.bankQuestionId
                        ? returnQuestionToBank(question.id)
                        : saveOwnQuestionToBank(question.id)
                    }
                    className="px-2.5 py-1.5 rounded-lg border border-brand-border text-xs font-semibold text-brand-muted hover:text-brand-orange-readable hover:border-brand-orange inline-flex items-center gap-1 transition-colors"
                    title="Prehodí otázku do banky a z tohto kvízu ju vymaže"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Vrátiť do banky
                  </button>
                )}
                <button
                  type="button"
                  disabled={!canMoveUp}
                  onClick={() => moveQuestion(question.id, "up")}
                  className="p-1.5 rounded-lg border border-brand-border text-brand-muted hover:text-brand-text hover:border-brand-orange disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  title="Posunúť hore / vymeniť s predchádzajúcou"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={!canMoveDown}
                  onClick={() => moveQuestion(question.id, "down")}
                  className="p-1.5 rounded-lg border border-brand-border text-brand-muted hover:text-brand-text hover:border-brand-orange disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  title="Posunúť dole / vymeniť s nasledujúcou"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => deleteQuestion(question.id)}
                  className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                  title="Zmazať otázku"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div>
              <label className="label">Text otázky</label>
              <textarea
                className="input min-h-[80px] resize-y"
                value={question.body}
                onChange={(e) => updateQuestion(question.id, { body: e.target.value })}
                placeholder={
                  question.kind === "music"
                    ? DEFAULT_MUSIC_QUESTION_BODY
                    : question.kind === "sound"
                      ? DEFAULT_SOUND_QUESTION_BODY
                      : question.kind === "video"
                        ? DEFAULT_VIDEO_QUESTION_BODY
                        : "Sem napíš otázku…"
                }
              />
            </div>
            <div>
              <label className="label">
                {question.isMatchQuestion ? "Správne priradenie" : question.isOrderQuestion ? "Správne poradie" : "Správna odpoveď"}
              </label>
              {question.isMatchQuestion ? (
                <textarea
                  readOnly
                  className="input min-h-[96px] resize-y whitespace-pre-line"
                  value={question.answer}
                />
              ) : question.isOrderQuestion ? (
                <textarea
                  className="input min-h-[96px] resize-y"
                  value={question.answer}
                  onChange={(e) => updateQuestion(question.id, { answer: e.target.value })}
                  placeholder={"1. prvá\n2. druhá"}
                />
              ) : (
                <input
                  className="input"
                  value={question.answer}
                  onChange={(e) => updateQuestion(question.id, { answer: e.target.value })}
                  placeholder="Správna odpoveď"
                />
              )}
            </div>
            {(question.kind === "sound" || question.kind === "video" || question.kind === "music") && (
              <div>
                <label className="label">Popis ukážky (pre teba / banku)</label>
                <input
                  className="input"
                  value={question.mediaLabel ?? ""}
                  onChange={(e) => updateQuestion(question.id, { mediaLabel: e.target.value })}
                  placeholder="napr. Trump — prejav alebo Matrix lobby"
                />
              </div>
            )}
            {question.kind === "normal" && (
              <div>
                <label className="label">Tagy (oddelené čiarkou)</label>
                <TagSuggestInput
                  value={formatTagsInput(question.tags)}
                  onChange={(next) => updateQuestion(question.id, { tags: parseTagsInput(next) })}
                  placeholder="história, geografia, afrika"
                />
                {(question.tags?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {question.tags!.map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border border-brand-border bg-brand-card text-brand-muted"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
            {(question.kind === "normal" || question.kind === "video") && question.isMatchQuestion ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="label">Ľavá strana (čísla)</label>
                  <p className="text-brand-muted text-xs">Toto ide na plátno. Posun prepočíta odpoveď.</p>
                  {(question.options ?? []).map((option, optionIndex) => (
                    <div key={`left-${optionIndex}`} className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-brand-muted w-6 shrink-0">{optionIndex + 1}.</span>
                      <input
                        className="input flex-1 min-w-0"
                        value={option}
                        onChange={(event) => {
                          const next = applyMatchColumnEdit({
                            left: question.options ?? [],
                            right: question.matchRight ?? [],
                            answer: question.answer,
                            side: "left",
                            index: optionIndex,
                            value: event.target.value,
                          });
                          updateQuestion(question.id, { options: next.left, matchRight: next.right, answer: next.answer });
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const next = moveMatchColumn({
                            left: question.options ?? [],
                            right: question.matchRight ?? [],
                            answer: question.answer,
                            side: "left",
                            index: optionIndex,
                            direction: -1,
                          });
                          if (next) updateQuestion(question.id, { options: next.left, matchRight: next.right, answer: next.answer });
                        }}
                        disabled={optionIndex === 0}
                        className="p-2 rounded-lg border border-brand-border text-brand-muted disabled:opacity-30 shrink-0"
                        title="Vyššie"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const next = moveMatchColumn({
                            left: question.options ?? [],
                            right: question.matchRight ?? [],
                            answer: question.answer,
                            side: "left",
                            index: optionIndex,
                            direction: 1,
                          });
                          if (next) updateQuestion(question.id, { options: next.left, matchRight: next.right, answer: next.answer });
                        }}
                        disabled={optionIndex === (question.options?.length ?? 0) - 1}
                        className="p-2 rounded-lg border border-brand-border text-brand-muted disabled:opacity-30 shrink-0"
                        title="Nižšie"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <label className="label">Pravá strana (písmená)</label>
                  <p className="text-brand-muted text-xs">Písmená idú na plátno vedľa čísel.</p>
                  {(question.matchRight ?? []).map((option, optionIndex) => (
                    <div key={`right-${optionIndex}`} className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-brand-muted w-6 shrink-0">{matchLetter(optionIndex)}</span>
                      <input
                        className="input flex-1 min-w-0"
                        value={option}
                        onChange={(event) => {
                          const next = applyMatchColumnEdit({
                            left: question.options ?? [],
                            right: question.matchRight ?? [],
                            answer: question.answer,
                            side: "right",
                            index: optionIndex,
                            value: event.target.value,
                          });
                          updateQuestion(question.id, { options: next.left, matchRight: next.right, answer: next.answer });
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const next = moveMatchColumn({
                            left: question.options ?? [],
                            right: question.matchRight ?? [],
                            answer: question.answer,
                            side: "right",
                            index: optionIndex,
                            direction: -1,
                          });
                          if (next) updateQuestion(question.id, { options: next.left, matchRight: next.right, answer: next.answer });
                        }}
                        disabled={optionIndex === 0}
                        className="p-2 rounded-lg border border-brand-border text-brand-muted disabled:opacity-30 shrink-0"
                        title="Vyššie"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const next = moveMatchColumn({
                            left: question.options ?? [],
                            right: question.matchRight ?? [],
                            answer: question.answer,
                            side: "right",
                            index: optionIndex,
                            direction: 1,
                          });
                          if (next) updateQuestion(question.id, { options: next.left, matchRight: next.right, answer: next.answer });
                        }}
                        disabled={optionIndex === (question.matchRight?.length ?? 0) - 1}
                        className="p-2 rounded-lg border border-brand-border text-brand-muted disabled:opacity-30 shrink-0"
                        title="Nižšie"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {(question.kind === "normal" || question.kind === "video") && !question.isMatchQuestion && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="label mb-0">
                    {question.isOrderQuestion ? "Položky na plátne" : "Možnosti (voliteľné)"}
                  </label>
                  {(question.options?.length ?? 0) < (question.isOrderQuestion ? ORDER_OPTION_MAX : 6) && (
                    <button
                      type="button"
                      onClick={() => addQuestionOption(question.id)}
                      className="text-xs font-semibold text-brand-orange-readable hover:underline inline-flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Pridať možnosť
                    </button>
                  )}
                </div>
                {question.isOrderQuestion ? (
                  <p className="text-brand-muted text-xs">
                    Toto poradie ide na plátno. Správne poradie ostáva v odpovedi.
                  </p>
                ) : null}
                {(question.options ?? []).length === 0 ? (
                  <p className="text-brand-muted text-xs">Bez možností — otázka sa zobrazí len ako text.</p>
                ) : (
                  <div className="space-y-2">
                    {(question.options ?? []).map((option, optionIndex) => (
                      <div key={optionIndex} className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-brand-muted w-6 shrink-0">
                          {question.isOrderQuestion ? `${optionIndex + 1}.` : `${optionLetter(optionIndex)})`}
                        </span>
                        <input
                          className="input flex-1 min-w-0"
                          value={option}
                          onChange={(e) => setQuestionOption(question.id, optionIndex, e.target.value)}
                          placeholder={question.isOrderQuestion ? `Položka ${optionIndex + 1}` : `Možnosť ${optionLetter(optionIndex)}`}
                          onBlur={() => updateQuestionOptions(question.id, question.options ?? [])}
                        />
                        {question.isOrderQuestion ? (
                          <>
                            <button
                              type="button"
                              onClick={() => moveQuestionOption(question.id, optionIndex, -1)}
                              disabled={optionIndex === 0}
                              className="p-2 rounded-lg border border-brand-border text-brand-muted disabled:opacity-30 shrink-0"
                              title="Vyššie"
                            >
                              <ChevronUp className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveQuestionOption(question.id, optionIndex, 1)}
                              disabled={optionIndex === (question.options?.length ?? 0) - 1}
                              className="p-2 rounded-lg border border-brand-border text-brand-muted disabled:opacity-30 shrink-0"
                              title="Nižšie"
                            >
                              <ChevronDown className="w-4 h-4" />
                            </button>
                          </>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => removeQuestionOption(question.id, optionIndex)}
                          className="p-2 rounded-lg border border-brand-border text-brand-muted hover:text-red-600 hover:border-red-300 transition-colors shrink-0"
                          title="Odstrániť možnosť"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {question.kind === "normal" ? (
              <NormalQuestionMedia
                question={question}
                choice={
                  normalMediaChoice[question.id] ??
                  (question.videoUrl?.trim()
                    ? "video"
                    : question.audioUrl?.trim()
                      ? "audio"
                      : question.imageUrl?.trim()
                        ? "image"
                        : "none")
                }
                onChoice={(choice) => {
                  const current =
                    normalMediaChoice[question.id] ??
                    (question.videoUrl?.trim()
                      ? "video"
                      : question.audioUrl?.trim()
                        ? "audio"
                        : question.imageUrl?.trim()
                          ? "image"
                          : "none");
                  if (choice === current) return;
                  setNormalMediaChoice((prev) => ({ ...prev, [question.id]: choice }));
                  if (choice === "none") {
                    updateQuestion(question.id, { imageUrl: "", audioUrl: "", videoUrl: "", videoQuestionSeconds: undefined, videoQuestionAudioOnly: undefined, ...CLEARED_VIDEO_PLACEMENT });
                  } else if (choice === "image") {
                    updateQuestion(question.id, { audioUrl: "", videoUrl: "", videoQuestionSeconds: undefined, videoQuestionAudioOnly: undefined, ...CLEARED_VIDEO_PLACEMENT });
                  } else if (choice === "audio") {
                    updateQuestion(question.id, { imageUrl: "", videoUrl: "", videoQuestionSeconds: undefined, videoQuestionAudioOnly: undefined, ...CLEARED_VIDEO_PLACEMENT });
                  } else {
                    updateQuestion(question.id, { imageUrl: "", audioUrl: "" });
                  }
                }}
                onUploadError={(text) => setMsg({ text, ok: false })}
                onUploadSuccess={(text) => setMsg({ text, ok: true })}
                onImage={(url) => updateQuestion(question.id, { imageUrl: url })}
                onAudio={(url) => updateQuestion(question.id, { audioUrl: url })}
                onVideo={(url) => updateQuestion(question.id, videoUrlPatch(question, url))}
              />
            ) : (
              <div className="grid gap-3 grid-cols-1">
                {(question.kind === "music" || question.kind === "sound") && (
                  <AudioUrlField
                    value={question.audioUrl ?? ""}
                    onChange={(url, meta) =>
                      updateQuestion(question.id, {
                        audioUrl: url,
                        ...(question.kind === "music" && meta?.uploaded
                          ? { audioEdgeFade: true }
                          : url.trim()
                            ? {}
                            : { audioEdgeFade: undefined }),
                      })
                    }
                    onUploadError={(text) => setMsg({ text, ok: false })}
                    onUploadSuccess={(text) => setMsg({ text, ok: true })}
                  />
                )}
                {question.kind === "video" && (
                  <VideoUrlField
                    value={question.videoUrl ?? ""}
                    onChange={(url) => updateQuestion(question.id, videoUrlPatch(question, url))}
                    onUploadError={(text) => setMsg({ text, ok: false })}
                    onUploadSuccess={(text) => setMsg({ text, ok: true })}
                  />
                )}
              </div>
            )}
            {question.kind === "normal" && question.imageUrl?.trim() && (
              <MediaPlacementFields
                title="Kde zobraziť obrázok"
                noun="fotka"
                beforeQuestion={Boolean(question.imageBeforeQuestion)}
                during={question.imageDuringQuestion}
                onNext={Boolean(question.imageOnNextSlide)}
                onAnswer={Boolean(question.imageOnAnswerSlide)}
                beforeAnswer={Boolean(question.imageBeforeAnswer)}
                afterAnswer={Boolean(question.imageAfterAnswer)}
                onChange={(patch) =>
                  updateQuestion(question.id, {
                    ...(patch.beforeQuestion !== undefined ? { imageBeforeQuestion: patch.beforeQuestion } : {}),
                    ...(patch.during !== undefined ? { imageDuringQuestion: patch.during } : {}),
                    ...(patch.onNext !== undefined ? { imageOnNextSlide: patch.onNext } : {}),
                    ...(patch.onAnswer !== undefined ? { imageOnAnswerSlide: patch.onAnswer } : {}),
                    ...(patch.beforeAnswer !== undefined ? { imageBeforeAnswer: patch.beforeAnswer } : {}),
                    ...(patch.afterAnswer !== undefined ? { imageAfterAnswer: patch.afterAnswer } : {}),
                  })
                }
              />
            )}
            {question.videoUrl?.trim() && (question.kind === "video" || question.kind === "normal") && (
              <>
              <MediaPlacementFields
                title="Kde zobraziť video"
                noun="video"
                beforeQuestion={Boolean(question.videoBeforeQuestion)}
                during={Boolean(question.videoDuringQuestion)}
                onNext={Boolean(question.videoOnNextSlide)}
                onAnswer={Boolean(question.videoOnAnswerSlide)}
                beforeAnswer={Boolean(question.videoBeforeAnswer)}
                afterAnswer={Boolean(question.videoAfterAnswer)}
                coupleAnswer={false}
                onChange={(patch) =>
                  updateQuestion(question.id, {
                    ...(patch.beforeQuestion !== undefined ? { videoBeforeQuestion: patch.beforeQuestion } : {}),
                    ...(patch.during !== undefined ? { videoDuringQuestion: patch.during } : {}),
                    ...(patch.onNext !== undefined ? { videoOnNextSlide: patch.onNext } : {}),
                    ...(patch.onAnswer !== undefined ? { videoOnAnswerSlide: patch.onAnswer } : {}),
                    ...(patch.beforeAnswer !== undefined ? { videoBeforeAnswer: patch.beforeAnswer } : {}),
                    ...(patch.afterAnswer !== undefined ? { videoAfterAnswer: patch.afterAnswer } : {}),
                  })
                }
              />
              <VideoQuestionClipField
                url={question.videoUrl}
                seconds={question.videoQuestionSeconds}
                onChange={(videoQuestionSeconds) => updateQuestion(question.id, { videoQuestionSeconds })}
              />
              <label className="flex items-center gap-2 text-sm text-brand-text cursor-pointer">
                <input
                  type="checkbox"
                  checked={question.videoQuestionAudioOnly === true}
                  onChange={(e) =>
                    updateQuestion(question.id, { videoQuestionAudioOnly: e.target.checked ? true : undefined })
                  }
                  className="rounded border-brand-border"
                />
                Pustiť iba zvuk pri otázke
              </label>
              <p className="text-brand-muted text-xs leading-relaxed -mt-1">
                Pri otázke ide len hudba z videa, obraz sa neukáže. Pri správnych odpovediach ide video aj s obrazom.
                Zapni ho na slide s otázkou alebo pred ňou.
              </p>
              </>
            )}
            {(question.body.trim() || question.answer.trim() || question.hostNote || question.bankQuestionId) && (
              <div>
                <label className="label">Info pre teba (len admin)</label>
                <p className="text-brand-muted text-xs mb-1.5 leading-relaxed">
                  Neprehráva sa na projektore — pasce, fakty a zaujímavosti pri vedení kvízu.
                </p>
                <textarea
                  className="input min-h-[72px] resize-y text-sm bg-brand-warm border-brand-border"
                  value={
                    question.hostNote ??
                    (question.bankQuestionId
                      ? findBankQuestionById(question.bankQuestionId, customBankQuestions)?.note
                      : "") ??
                    ""
                  }
                  onChange={(e) =>
                    updateQuestion(question.id, { hostNote: e.target.value.trim() || undefined })
                  }
                  placeholder="Poznámka z banky alebo vlastné info…"
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-center py-2">
            <button
              type="button"
              onClick={() => insertEmptyQuestion(question.questionNumber, question.kind, displayQuestionNumber(question))}
              className="text-xs font-semibold text-brand-muted hover:text-brand-orange-readable inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-dashed border-brand-border hover:border-brand-orange bg-brand-card/50 hover:bg-brand-tint/40 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Vložiť otázku
            </button>
          </div>
          </Fragment>
          );
        })}
          </Fragment>
        ))}
          </div>
        </div>

        <div className="min-w-0 max-w-full hidden lg:block lg:sticky lg:top-24 lg:self-start lg:z-20 lg:h-[calc(100vh-7rem)]">
          <QuizQuestionBankPanel
            roundQuestions={roundQuestions}
            allQuizQuestions={questions}
            usedBankQuestionIds={globalUsedBankQuestionIds}
            usedQuestionBodies={usedQuestionBodies}
            customBankQuestions={customBankQuestions}
            musicBankTracks={musicBankTracks}
            soundBankClips={soundBankClips}
            videoBankClips={videoBankClips}
            openRound={openRound}
            onCustomBankChange={refreshCustomBank}
            onMusicBankChange={refreshMusicBank}
            onSoundBankChange={refreshSoundBank}
            onVideoBankChange={refreshVideoBank}
            onInsert={insertFromBank}
            onInsertMusic={insertFromMusicBank}
            onInsertSound={insertFromSoundBank}
            onInsertVideo={insertFromVideoBank}
          />
        </div>

        <div className="min-w-0 max-w-full lg:hidden">
          <QuizQuestionBankPanel
            roundQuestions={roundQuestions}
            allQuizQuestions={questions}
            usedBankQuestionIds={globalUsedBankQuestionIds}
            usedQuestionBodies={usedQuestionBodies}
            customBankQuestions={customBankQuestions}
            musicBankTracks={musicBankTracks}
            soundBankClips={soundBankClips}
            videoBankClips={videoBankClips}
            openRound={openRound}
            onCustomBankChange={refreshCustomBank}
            onMusicBankChange={refreshMusicBank}
            onSoundBankChange={refreshSoundBank}
            onVideoBankChange={refreshVideoBank}
            onInsert={insertFromBank}
            onInsertMusic={insertFromMusicBank}
            onInsertSound={insertFromSoundBank}
            onInsertVideo={insertFromVideoBank}
          />
        </div>
      </div>
      {answerKeyOpen ? (
        <QuizAnswerKey title={quiz.title} questions={questions} onClose={() => setAnswerKeyOpen(false)} />
      ) : null}
    </div>
  );
}
