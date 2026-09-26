"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, Fragment } from "react";
import { ChevronDown, ChevronUp, GripVertical, MonitorPlay, Plus, RotateCcw, Save, Trash2, X } from "lucide-react";
import type { QuizEvent } from "@/lib/data";
import {
  collectUsedBankQuestionIdsFromQuiz,
  normalizeLibraryQuiz,
  type QuizLibraryItem,
  type QuizQuestionItem,
  type QuizQuestionKind,
} from "@/lib/quiz-library";
import { findBankQuestionById, findRawBankQuestionById } from "@/lib/quiz-question-bank";
import { shuffleQuestionOptionsForBankInsert } from "@/lib/quiz-question-options";
import {
  addCustomBankQuestionAsync,
  fetchCustomBankQuestionsFromServer,
  isCustomBankQuestionId,
  type CustomBankQuestion,
} from "@/lib/quiz-custom-bank";
import {
  buildStandardMudrcQuestions,
  describeQuizContent,
  insertQuestionAfter,
  isSameReorderGroup,
  questionRenumberGroupKey,
  questionsInSameReorderGroup,
  removeQuestion,
  roundLabels,
  sortQuizQuestions,
} from "@/lib/quiz-template";
import { buildPresentationSlides } from "@/lib/quiz-presentation";
import QuizQuestionBankPanel from "@/components/QuizQuestionBankPanel";
import CustomBankQuestionForm from "@/components/CustomBankQuestionForm";
import SoundBankQuestionForm from "@/components/SoundBankQuestionForm";
import VideoBankQuestionForm from "@/components/VideoBankQuestionForm";
import AudioUrlField from "@/components/admin/AudioUrlField";
import VideoUrlField from "@/components/admin/VideoUrlField";
import { type MusicBankItem } from "@/lib/music-bank";
import { fetchMusicBankFromServer } from "@/lib/music-bank-client";
import { DEFAULT_SOUND_QUESTION_BODY, type SoundBankItem } from "@/lib/sound-bank";
import { addSoundBankItemAsync, fetchSoundBankFromServer } from "@/lib/sound-bank-client";
import { DEFAULT_VIDEO_QUESTION_BODY, type VideoBankItem } from "@/lib/video-bank";
import { addVideoBankItemAsync, fetchVideoBankFromServer } from "@/lib/video-bank-client";
import QuizTagStats from "@/components/QuizTagStats";
import ImageUrlField from "@/components/admin/ImageUrlField";
import { optionLetter } from "@/lib/quiz-question-options";
import { formatTagsInput, parseTagsInput } from "@/lib/quiz-question-tags";
import {
  clearQuizDraft,
  parseQuizPayload,
  readQuizDraft,
  readQuizLocalBackup,
  writeQuizDraft,
} from "@/lib/quiz-editor-draft";

function countFilledQuizQuestions(questions: QuizQuestionItem[]): number {
  return questions.filter(
    (q) => q.body.trim() || q.answer.trim() || q.audioUrl?.trim() || q.videoUrl?.trim()
  ).length;
}

type Props = {
  quizId: string;
  initialQuiz?: QuizLibraryItem | null;
};

function questionsInRound(questions: QuizQuestionItem[], round: number) {
  return sortQuizQuestions(questions.filter((q) => q.roundNumber === round));
}

function moveQuestionInGroup(
  questions: QuizQuestionItem[],
  questionId: string,
  direction: "up" | "down"
): QuizQuestionItem[] {
  const target = questions.find((q) => q.id === questionId);
  if (!target) return questions;

  const group = questionsInSameReorderGroup(questions, target);
  const index = group.findIndex((q) => q.id === questionId);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= group.length) return questions;

  const reordered = [...group];
  [reordered[index], reordered[swapIndex]] = [reordered[swapIndex], reordered[index]];
  const renumbered = reordered.map((q, i) => ({ ...q, questionNumber: i + 1 }));
  const groupKey = questionRenumberGroupKey(target);
  const rest = questions.filter(
    (q) => q.roundNumber !== target.roundNumber || questionRenumberGroupKey(q) !== groupKey
  );
  return sortQuizQuestions([...rest, ...renumbered]);
}

function reorderQuestionInGroup(
  questions: QuizQuestionItem[],
  questionId: string,
  toIndex: number
): QuizQuestionItem[] {
  const target = questions.find((q) => q.id === questionId);
  if (!target) return questions;

  const group = questionsInSameReorderGroup(questions, target);
  const fromIndex = group.findIndex((q) => q.id === questionId);
  if (fromIndex < 0 || toIndex < 0 || toIndex >= group.length || fromIndex === toIndex) return questions;

  const reordered = [...group];
  const [item] = reordered.splice(fromIndex, 1);
  reordered.splice(toIndex, 0, item);
  const renumbered = reordered.map((q, i) => ({ ...q, questionNumber: i + 1 }));
  const groupKey = questionRenumberGroupKey(target);
  const rest = questions.filter(
    (q) => q.roundNumber !== target.roundNumber || questionRenumberGroupKey(q) !== groupKey
  );
  return sortQuizQuestions([...rest, ...renumbered]);
}

export default function QuizLibraryEditor({ quizId }: Props) {
  const [quiz, setQuiz] = useState<QuizLibraryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [draftRestored, setDraftRestored] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [events, setEvents] = useState<QuizEvent[]>([]);
  const [playEventSlug, setPlayEventSlug] = useState("");
  const [openRound, setOpenRound] = useState<number>(1);
  const [dragQuestionId, setDragQuestionId] = useState<string | null>(null);
  const [libraryQuizzes, setLibraryQuizzes] = useState<QuizLibraryItem[]>([]);
  const [customBankQuestions, setCustomBankQuestions] = useState<CustomBankQuestion[]>([]);
  const [musicBankTracks, setMusicBankTracks] = useState<MusicBankItem[]>([]);
  const [soundBankClips, setSoundBankClips] = useState<SoundBankItem[]>([]);
  const [videoBankClips, setVideoBankClips] = useState<VideoBankItem[]>([]);
  const [serverBackupFilled, setServerBackupFilled] = useState<number | null>(null);

  const refreshMusicBank = useCallback(async () => {
    setMusicBankTracks(await fetchMusicBankFromServer());
  }, []);

  const refreshSoundBank = useCallback(async () => {
    setSoundBankClips(await fetchSoundBankFromServer());
  }, []);

  const refreshVideoBank = useCallback(async () => {
    setVideoBankClips(await fetchVideoBankFromServer());
  }, []);

  const refreshCustomBank = useCallback(async () => {
    const questions = await fetchCustomBankQuestionsFromServer();
    setCustomBankQuestions(questions);
  }, []);

  useEffect(() => {
    refreshCustomBank();
    refreshMusicBank();
    refreshSoundBank();
    refreshVideoBank();
    window.addEventListener("mudrc-custom-bank-updated", refreshCustomBank);
    return () => window.removeEventListener("mudrc-custom-bank-updated", refreshCustomBank);
  }, [refreshCustomBank, refreshMusicBank, refreshSoundBank, refreshVideoBank]);

  const refreshLibraryQuizzes = useCallback(async () => {
    const res = await fetch(`/api/admin/quiz-library?_=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setLibraryQuizzes((data.quizzes ?? []).map((entry: unknown) => parseQuizPayload(entry)));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const draft = readQuizDraft(quizId);
    const res = await fetch(`/api/admin/quiz-library/${quizId}?_=${Date.now()}`, { cache: "no-store" });

    if (res.ok) {
      const serverQuiz = parseQuizPayload(await res.json());
      const active = draft ? normalizeLibraryQuiz(draft) : serverQuiz;
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
    refreshLibraryQuizzes();
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
  }, [load, refreshLibraryQuizzes, quizId]);

  useEffect(() => {
    if (!quiz || loading) return;
    writeQuizDraft(quiz);
  }, [quiz, loading]);

  useEffect(() => {
    if (!draftRestored) return;
    setMsg({
      text: "Obnovený neuložený koncept — zmeny zostávajú, kým neuložíš alebo neobnovíš stránku po uložení.",
      ok: true,
    });
  }, [draftRestored]);

  const questions = useMemo(() => quiz?.questions ?? [], [quiz?.questions]);
  const globalUsedBankQuestionIds = useMemo(() => {
    const fromOthers = libraryQuizzes
      .filter((entry) => entry.id !== quizId)
      .flatMap(collectUsedBankQuestionIdsFromQuiz);
    const fromCurrent = quiz ? collectUsedBankQuestionIdsFromQuiz(quiz) : [];
    return Array.from(new Set([...fromOthers, ...fromCurrent]));
  }, [libraryQuizzes, quiz, quizId]);
  const presentationCount = useMemo(
    () => (questions.length ? buildPresentationSlides(questions).length : 0),
    [questions]
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
      const nextQuestions = moveQuestionInGroup(prev.questions, questionId, direction);
      if (nextQuestions === prev.questions) return prev;
      return { ...prev, questions: nextQuestions };
    });
  };

  const handleQuestionDrop = (targetId: string) => {
    if (!dragQuestionId || dragQuestionId === targetId) return;
    const dragged = questions.find((q) => q.id === dragQuestionId);
    const target = questions.find((q) => q.id === targetId);
    if (!dragged || !target) return;
    if (!isSameReorderGroup(dragged, target)) return;

    const group = questionsInSameReorderGroup(questions, target);
    const toIndex = group.findIndex((q) => q.id === targetId);
    setQuiz((prev) =>
      prev ? { ...prev, questions: reorderQuestionInGroup(prev.questions, dragQuestionId, toIndex) } : prev
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

    const rawBank = findRawBankQuestionById(bankId, customBankQuestions);
    const sourceOptions = rawBank?.options?.length ? [...rawBank.options] : options;
    const hasChoices = sourceOptions.some((o) => o.trim());
    if (rawBank && hasChoices && !rawBank.isOpenQuestion) {
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
            ? "Foto otázka vložená — doplni URL obrázka. Predchádzajúca otázka z banky je znova dostupná — nezabudni uložiť."
            : "Otázka vložená. Predchádzajúca otázka z banky je znova dostupná v banke — nezabudni uložiť."
          : isImageQuestion
            ? "Foto otázka vložená — doplni URL obrázka v editore. Nezabudni uložiť."
            : "Otázka vložená a odstránená z banky pre tento kvíz — nezabudni uložiť.",
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
    insertFromSoundBank(bankId, targetQuestionId, label, label, audioUrl, hostNote, tags);
    void refreshMusicBank();
  };

  const insertFromSoundBank = (
    bankId: string,
    targetQuestionId: string,
    label: string,
    answer: string,
    audioUrl: string,
    hostNote?: string,
    bankTags?: string[]
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
                body: DEFAULT_SOUND_QUESTION_BODY,
                answer,
                mediaLabel: label,
                musicArtist: undefined,
                musicTitle: undefined,
                audioUrl,
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
      if (restoreToBank) {
        try {
          await addSoundBankItemAsync(restoreToBank);
        } catch {
          /* duplicita */
        }
      }
      await refreshSoundBank();
    })();

    setMsg({ text: "Zvuková ukážka vložená — nezabudni uložiť kvíz.", ok: true });
  };

  const insertFromVideoBank = (
    bankId: string,
    targetQuestionId: string,
    label: string,
    answer: string,
    videoUrl: string,
    hostNote?: string
  ) => {
    const target = questions.find((q) => q.id === targetQuestionId);
    if (!target) return;
    const displacedBankId = target.bankQuestionId;
    const slotIsMusicTail = target.kind === "music";

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
                kind: slotIsMusicTail ? "music" : "video",
                body: DEFAULT_VIDEO_QUESTION_BODY,
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
                tags: ["video"],
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

    setMsg({ text: "Video ukážka vložená — nezabudni uložiť kvíz.", ok: true });
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
            label:
              question.mediaLabel?.trim() ||
              (question.musicArtist?.trim() && question.musicTitle?.trim()
                ? `${question.musicArtist.trim()} — ${question.musicTitle.trim()}`
                : question.answer.trim()),
            answer: question.answer.trim(),
            audioUrl: question.audioUrl.trim(),
            note: question.hostNote?.trim() || undefined,
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
          }
        : null;

    const customRestore =
      question &&
      isCustomBankQuestionId(bankId) &&
      question.body.trim() &&
      question.answer.trim()
        ? (() => {
            const options = [...(question.options ?? [])];
            while (options.length < 6) options.push("");
            const hasChoices = options.some((o) => o.trim());
            const correctIndex = hasChoices
              ? Math.max(0, options.findIndex((o) => o.trim() === question.answer.trim()))
              : 0;
            return {
              body: question.body.trim(),
              options: options.slice(0, 6),
              correctIndex,
              answer: question.answer.trim(),
              note: question.hostNote?.trim() || undefined,
              tags: question.tags,
              isOpenQuestion: !hasChoices,
              isImageQuestion: Boolean(question.imageUrl?.trim() || question.imageDuringQuestion),
              suggestedImageUrl: question.imageUrl?.trim() || undefined,
            };
          })()
        : null;

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
                    videoUrl: undefined,
                    mediaLabel: undefined,
                    options: undefined,
                    bankQuestionId: undefined,
                    tags: undefined,
                    hostNote: undefined,
                    imageUrl: undefined,
                    imageBeforeQuestion: undefined,
                    imageDuringQuestion: false,
                    imageOnNextSlide: undefined,
                    imageOnAnswerSlide: undefined,
                  }
                : q
            ),
            usedBankQuestionIds: (prev.usedBankQuestionIds ?? []).filter((id) => id !== bankId),
          }
        : prev
    );

    if (soundRestore) {
      void addSoundBankItemAsync(soundRestore)
        .then(() => refreshSoundBank())
        .catch(() => {
          setMsg({ text: "Slot vyprázdnený, zvuk sa nepodarilo vrátiť do banky.", ok: false });
        });
    } else if (videoRestore) {
      void addVideoBankItemAsync(videoRestore)
        .then(() => refreshVideoBank())
        .catch(() => {
          setMsg({ text: "Slot vyprázdnený, video sa nepodarilo vrátiť do banky.", ok: false });
        });
    } else if (customRestore) {
      void addCustomBankQuestionAsync(customRestore)
        .then(() => refreshCustomBank())
        .catch(() => {
          setMsg({ text: "Slot vyprázdnený, ale otázku sa nepodarilo vrátiť do banky.", ok: false });
        });
    }

    setMsg({ text: "Otázka vrátená do banky — nezabudni uložiť.", ok: true });
  };

  const updateQuestionOptions = (id: string, options: string[]) => {
    const cleaned = options.map((option) => option.trim()).filter(Boolean).slice(0, 6);
    updateQuestion(id, { options: cleaned.length ? cleaned : undefined });
  };

  const addQuestionOption = (id: string) => {
    const question = questions.find((q) => q.id === id);
    if (!question) return;
    const current = question.options ?? [];
    if (current.length >= 6) return;
    updateQuestion(id, { options: [...current, ""] });
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

  const insertEmptyQuestion = (afterQuestionNumber: number, kind: QuizQuestionKind) => {
    setQuiz((prev) =>
      prev
        ? {
            ...prev,
            questions: insertQuestionAfter(prev.questions, openRound, kind, afterQuestionNumber),
          }
        : prev
    );
    setMsg({
      text: `Prázdna otázka vložená za č. ${afterQuestionNumber} — doplni ju z banky alebo ručne.`,
      ok: true,
    });
  };

  const deleteQuestion = (questionId: string) => {
    const question = questions.find((q) => q.id === questionId);
    if (!question) return;

    const label =
      question.kind === "music"
        ? `zvukovú ukážku (koniec kola) ${question.questionNumber}`
        : question.kind === "sound"
          ? `zvukovú ukážku ${question.questionNumber}`
          : question.kind === "video"
            ? `video ukážku ${question.questionNumber}`
            : `otázku ${question.questionNumber}`;
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
    setMsg({ text: "Otázka zmazaná — nezabudni uložiť.", ok: true });
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

  const save = async () => {
    if (!quiz) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/quiz-library/${quizId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(quiz),
      });
      if (res.ok) {
        const saved = parseQuizPayload(await res.json());
        clearQuizDraft(quizId);
        setQuiz(saved);
        setDraftRestored(false);
        await refreshLibraryQuizzes();
        setMsg({ text: "Kvíz uložený.", ok: true });
      } else {
        const err = await res.json().catch(() => ({}));
        setMsg({ text: err.error ?? "Chyba pri ukladaní.", ok: false });
      }
    } catch {
      setMsg({ text: "Sieťová chyba.", ok: false });
    } finally {
      setSaving(false);
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

      <CustomBankQuestionForm onAdded={refreshCustomBank} />
      <SoundBankQuestionForm onAdded={refreshSoundBank} onMessage={(text, ok) => setMsg({ text, ok })} />
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
          <Link
            href={`/admin/hotove-kvizy/${quizId}/prehrat${playEventSlug ? `?event=${playEventSlug}` : ""}`}
            className="btn-primary text-sm py-2.5 px-4 inline-flex items-center gap-2"
          >
            <MonitorPlay className="w-4 h-4" />
            Spustiť
          </Link>
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
            {saving ? "Ukladám…" : "Uložiť"}
          </button>
        </div>
      </div>

      <QuizTagStats questions={questions} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-w-0 max-w-full">
        <div className="min-w-0 max-w-full space-y-4">
          <div className="flex gap-2 flex-wrap">
            {[1, 2, 3, 4].map((round) => (
              <button
                key={round}
                type="button"
                onClick={() => setOpenRound(round)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                  openRound === round
                    ? "bg-brand-orange text-brand-btn-fg border-brand-orange"
                    : "border-brand-border text-brand-muted hover:border-brand-orange"
                }`}
              >
                Kolo {round}
              </button>
            ))}
          </div>

          <h3 className="font-display text-xl text-brand-text">
            Kolo {openRound} — {roundLabels[openRound]}
          </h3>

          <div className="space-y-1">
        {roundQuestionSections.map((section) => (
          <Fragment key={section.key}>
            {section.title && (
              <p className="text-xs font-bold uppercase tracking-wider text-brand-muted pt-3 pb-1 px-1">
                {section.title}
              </p>
            )}
        {section.items.map((question) => {
          const group = questionsInSameReorderGroup(questions, question);
          const groupIndex = group.findIndex((q) => q.id === question.id);
          const canMoveUp = groupIndex > 0;
          const canMoveDown = groupIndex >= 0 && groupIndex < group.length - 1;

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
                  {question.kind === "music"
                    ? `Zvuk · koniec kola ${question.questionNumber}`
                    : question.kind === "sound"
                      ? `Zvuk ${question.questionNumber}`
                      : question.kind === "video"
                        ? `Video ${question.questionNumber}`
                        : `Otázka ${question.questionNumber}`}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {question.bankQuestionId && (
                  <button
                    type="button"
                    onClick={() => returnQuestionToBank(question.id)}
                    className="px-2.5 py-1.5 rounded-lg border border-brand-border text-xs font-semibold text-brand-muted hover:text-brand-orange-readable hover:border-brand-orange inline-flex items-center gap-1 transition-colors"
                    title="Vrátiť otázku do banky"
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
                  question.kind === "music" || question.kind === "sound"
                    ? DEFAULT_SOUND_QUESTION_BODY
                    : question.kind === "video"
                      ? DEFAULT_VIDEO_QUESTION_BODY
                      : "Sem napíš otázku…"
                }
              />
            </div>
            <div>
              <label className="label">Správna odpoveď</label>
              <input
                className="input"
                value={question.answer}
                onChange={(e) => updateQuestion(question.id, { answer: e.target.value })}
                placeholder="Správna odpoveď"
              />
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
                <input
                  className="input"
                  value={formatTagsInput(question.tags)}
                  onChange={(e) => updateQuestion(question.id, { tags: parseTagsInput(e.target.value) })}
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
            {(question.kind === "normal" || question.kind === "video") && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="label mb-0">Možnosti (voliteľné)</label>
                  {(question.options?.length ?? 0) < 6 && (
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
                {(question.options ?? []).length === 0 ? (
                  <p className="text-brand-muted text-xs">Bez možností — otázka sa zobrazí len ako text.</p>
                ) : (
                  <div className="space-y-2">
                    {(question.options ?? []).map((option, optionIndex) => (
                      <div key={optionIndex} className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-brand-muted w-6 shrink-0">
                          {optionLetter(optionIndex)})
                        </span>
                        <input
                          className="input flex-1 min-w-0"
                          value={option}
                          onChange={(e) => setQuestionOption(question.id, optionIndex, e.target.value)}
                          placeholder={`Možnosť ${optionLetter(optionIndex)}`}
                          onBlur={() => updateQuestionOptions(question.id, question.options ?? [])}
                        />
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
            <div className="grid gap-3 grid-cols-1">
              {question.kind === "normal" && (
              <ImageUrlField
                value={question.imageUrl ?? ""}
                onChange={(url) => updateQuestion(question.id, { imageUrl: url })}
                onUploadError={(text) => setMsg({ text, ok: false })}
                onUploadSuccess={(text) => setMsg({ text, ok: true })}
              />
              )}
              {(question.kind === "music" || question.kind === "sound") && (
                <AudioUrlField
                  value={question.audioUrl ?? ""}
                  onChange={(url) => updateQuestion(question.id, { audioUrl: url })}
                  onUploadError={(text) => setMsg({ text, ok: false })}
                  onUploadSuccess={(text) => setMsg({ text, ok: true })}
                />
              )}
              {question.kind === "video" && (
                <VideoUrlField
                  value={question.videoUrl ?? ""}
                  onChange={(url) => updateQuestion(question.id, { videoUrl: url })}
                  onUploadError={(text) => setMsg({ text, ok: false })}
                  onUploadSuccess={(text) => setMsg({ text, ok: true })}
                />
              )}
            </div>
            {question.kind === "normal" && question.imageUrl?.trim() && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-brand-muted uppercase tracking-wider">Kde zobraziť obrázok</p>
                <label className="flex items-center gap-2 text-sm text-brand-text cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(question.imageBeforeQuestion)}
                    onChange={(e) =>
                      updateQuestion(question.id, { imageBeforeQuestion: e.target.checked })
                    }
                    className="rounded border-brand-border"
                  />
                  Slide pred otázkou (fullscreen fotka)
                </label>
                <label className="flex items-center gap-2 text-sm text-brand-text cursor-pointer">
                  <input
                    type="checkbox"
                    checked={question.imageDuringQuestion}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      updateQuestion(question.id, {
                        imageDuringQuestion: checked,
                        ...(checked ? { imageOnAnswerSlide: true } : {}),
                      });
                    }}
                    className="rounded border-brand-border"
                  />
                  Na slide s otázkou a odpoveďou (spolu s textom)
                </label>
                <label className="flex items-center gap-2 text-sm text-brand-text cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(question.imageOnNextSlide)}
                    onChange={(e) => updateQuestion(question.id, { imageOnNextSlide: e.target.checked })}
                    className="rounded border-brand-border"
                  />
                  Slide po otázke (fullscreen fotka)
                </label>
                <label
                  className={`flex items-center gap-2 text-sm cursor-pointer ${
                    question.imageDuringQuestion ? "text-brand-muted" : "text-brand-text"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={Boolean(question.imageOnAnswerSlide || question.imageDuringQuestion)}
                    disabled={question.imageDuringQuestion}
                    onChange={(e) =>
                      updateQuestion(question.id, { imageOnAnswerSlide: e.target.checked })
                    }
                    className="rounded border-brand-border disabled:opacity-60"
                  />
                  Pri správnej odpovedi (automaticky zapnuté ak je fotka pri otázke)
                </label>
              </div>
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
              onClick={() => insertEmptyQuestion(question.questionNumber, question.kind)}
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
    </div>
  );
}
