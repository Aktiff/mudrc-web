"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, GripVertical, MonitorPlay, Plus, RotateCcw, Save, X } from "lucide-react";
import type { QuizEvent } from "@/lib/data";
import type { QuizLibraryItem, QuizQuestionItem, QuizQuestionKind } from "@/lib/quiz-library";
import { collectUsedBankQuestionIdsFromQuiz } from "@/lib/quiz-library";
import { findBankQuestionById } from "@/lib/quiz-question-bank";
import { buildStandardMudrcQuestions, describeQuizContent, roundLabels } from "@/lib/quiz-template";
import { buildPresentationSlides } from "@/lib/quiz-presentation";
import QuizQuestionBankPanel from "@/components/QuizQuestionBankPanel";
import QuizTagStats from "@/components/QuizTagStats";
import { optionLetter } from "@/lib/quiz-question-options";
import { formatTagsInput, parseTagsInput } from "@/lib/quiz-question-tags";
import {
  clearQuizDraft,
  parseQuizPayload,
  readQuizDraft,
  writeQuizDraft,
} from "@/lib/quiz-editor-draft";

type Props = {
  quizId: string;
  initialQuiz?: QuizLibraryItem | null;
};

function questionsInRound(questions: QuizQuestionItem[], round: number) {
  return questions
    .filter((q) => q.roundNumber === round)
    .sort(
      (a, b) =>
        a.questionNumber - b.questionNumber || (a.kind === "music" ? 1 : 0) - (b.kind === "music" ? 1 : 0)
    );
}

function questionsInRoundKind(questions: QuizQuestionItem[], round: number, kind: QuizQuestionKind) {
  return questionsInRound(questions, round).filter((q) => q.kind === kind);
}

function sortAllQuestions(questions: QuizQuestionItem[]) {
  return [...questions].sort(
    (a, b) =>
      a.roundNumber - b.roundNumber ||
      a.questionNumber - b.questionNumber ||
      (a.kind === "music" ? 1 : 0) - (b.kind === "music" ? 1 : 0)
  );
}

function moveQuestionInGroup(
  questions: QuizQuestionItem[],
  questionId: string,
  direction: "up" | "down"
): QuizQuestionItem[] {
  const target = questions.find((q) => q.id === questionId);
  if (!target) return questions;

  const group = questionsInRoundKind(questions, target.roundNumber, target.kind);
  const index = group.findIndex((q) => q.id === questionId);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= group.length) return questions;

  const reordered = [...group];
  [reordered[index], reordered[swapIndex]] = [reordered[swapIndex], reordered[index]];
  const renumbered = reordered.map((q, i) => ({ ...q, questionNumber: i + 1 }));
  const rest = questions.filter(
    (q) => q.roundNumber !== target.roundNumber || q.kind !== target.kind
  );
  return sortAllQuestions([...rest, ...renumbered]);
}

function reorderQuestionInGroup(
  questions: QuizQuestionItem[],
  questionId: string,
  toIndex: number
): QuizQuestionItem[] {
  const target = questions.find((q) => q.id === questionId);
  if (!target) return questions;

  const group = questionsInRoundKind(questions, target.roundNumber, target.kind);
  const fromIndex = group.findIndex((q) => q.id === questionId);
  if (fromIndex < 0 || toIndex < 0 || toIndex >= group.length || fromIndex === toIndex) return questions;

  const reordered = [...group];
  const [item] = reordered.splice(fromIndex, 1);
  reordered.splice(toIndex, 0, item);
  const renumbered = reordered.map((q, i) => ({ ...q, questionNumber: i + 1 }));
  const rest = questions.filter(
    (q) => q.roundNumber !== target.roundNumber || q.kind !== target.kind
  );
  return sortAllQuestions([...rest, ...renumbered]);
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
      if (draft) {
        setQuiz(draft);
        setDraftRestored(true);
      } else {
        setQuiz(serverQuiz);
        setDraftRestored(false);
      }
    } else if (draft) {
      setQuiz(draft);
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
  }, [load, refreshLibraryQuizzes]);

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
    setQuiz((prev) =>
      prev ? { ...prev, questions: moveQuestionInGroup(prev.questions, questionId, direction) } : prev
    );
  };

  const handleQuestionDrop = (targetId: string) => {
    if (!dragQuestionId || dragQuestionId === targetId) return;
    const dragged = questions.find((q) => q.id === dragQuestionId);
    const target = questions.find((q) => q.id === targetId);
    if (!dragged || !target) return;
    if (dragged.roundNumber !== target.roundNumber || dragged.kind !== target.kind) return;

    const group = questionsInRoundKind(questions, target.roundNumber, target.kind);
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
    hostNote?: string
  ) => {
    const target = questions.find((q) => q.id === targetQuestionId);
    const displacedBankId = target?.bankQuestionId;

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
                body,
                answer,
                options: options.length ? options : undefined,
                bankQuestionId: bankId,
                tags: tags.length ? tags : undefined,
                hostNote: hostNote?.trim() || undefined,
                ...(isImageQuestion
                  ? {
                      imageUrl: "",
                      imageDuringQuestion: true,
                      imageOnNextSlide: false,
                    }
                  : {}),
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

  const returnQuestionToBank = (questionId: string) => {
    const question = questions.find((q) => q.id === questionId);
    const bankId = question?.bankQuestionId;
    if (!bankId) return;
    if (!window.confirm("Vrátiť otázku do banky? Obsah otázky sa vymaže.")) return;

    setQuiz((prev) =>
      prev
        ? {
            ...prev,
            questions: prev.questions.map((q) =>
              q.id === questionId
                ? {
                    ...q,
                    body: "",
                    answer: "",
                    options: undefined,
                    bankQuestionId: undefined,
                    tags: undefined,
                    hostNote: undefined,
                    imageUrl: undefined,
                    imageDuringQuestion: false,
                    imageOnNextSlide: undefined,
                  }
                : q
            ),
            usedBankQuestionIds: (prev.usedBankQuestionIds ?? []).filter((id) => id !== bankId),
          }
        : prev
    );
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

  const regenerateTemplate = () => {
    if (!window.confirm("Vymazať obsah a vytvoriť prázdnu štruktúru 55 otázok (4 kolá)?")) return;
    setQuiz((prev) => (prev ? { ...prev, questions: buildStandardMudrcQuestions() } : prev));
    setMsg({ text: "Štruktúra pripravená — doplň otázky a odpovede.", ok: true });
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
    <div className="min-w-0 max-w-full overflow-x-hidden space-y-6">
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
        <div className="min-w-0 max-w-full overflow-x-hidden space-y-4">
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

          <div className="space-y-4">
        {roundQuestions.map((question) => {
          const group = questionsInRoundKind(questions, openRound, question.kind);
          const groupIndex = group.findIndex((q) => q.id === question.id);
          const canMoveUp = groupIndex > 0;
          const canMoveDown = groupIndex >= 0 && groupIndex < group.length - 1;

          return (
          <div
            key={question.id}
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
                    ? `Hudba ${question.questionNumber}`
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
              </div>
            </div>
            <div>
              <label className="label">Text otázky</label>
              <textarea
                className="input min-h-[80px] resize-y"
                value={question.body}
                onChange={(e) => updateQuestion(question.id, { body: e.target.value })}
                placeholder="Sem napíš otázku…"
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
            {question.kind === "normal" && (
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
              <div>
                <label className="label">Obrázok (URL)</label>
                <input
                  className="input"
                  value={question.imageUrl ?? ""}
                  onChange={(e) => updateQuestion(question.id, { imageUrl: e.target.value })}
                  placeholder="https://…"
                />
              </div>
              {question.kind === "music" && (
                <div>
                  <label className="label">Audio ukážka (URL)</label>
                  <input
                    className="input"
                    value={question.audioUrl ?? ""}
                    onChange={(e) => updateQuestion(question.id, { audioUrl: e.target.value })}
                    placeholder="https://…mp3"
                  />
                </div>
              )}
            </div>
            {question.imageUrl?.trim() && (
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-brand-text cursor-pointer">
                  <input
                    type="checkbox"
                    checked={question.imageDuringQuestion}
                    disabled={Boolean(question.imageOnNextSlide)}
                    onChange={(e) => updateQuestion(question.id, { imageDuringQuestion: e.target.checked })}
                    className="rounded border-brand-border disabled:opacity-50"
                  />
                  Zobraziť obrázok pri otázke (na tom istom slide)
                </label>
                <label className="flex items-center gap-2 text-sm text-brand-text cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(question.imageOnNextSlide)}
                    onChange={(e) => updateQuestion(question.id, { imageOnNextSlide: e.target.checked })}
                    className="rounded border-brand-border"
                  />
                  Ďalší slide — obrázok fullscreen po otázke (otázka bez obrázku)
                </label>
                {question.imageOnNextSlide && (
                  <p className="text-brand-muted text-xs">
                    Otázka bude bez obrázku, fullscreen fotka až na nasledujúcom slide.
                  </p>
                )}
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
                      ? findBankQuestionById(question.bankQuestionId)?.note
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
          );
        })}
          </div>
        </div>

        <div className="min-w-0 max-w-full overflow-x-hidden lg:sticky lg:top-24 lg:self-start">
          <QuizQuestionBankPanel
            roundQuestions={roundQuestions}
            allQuizQuestions={questions}
            usedBankQuestionIds={globalUsedBankQuestionIds}
            onInsert={insertFromBank}
          />
        </div>
      </div>
    </div>
  );
}
