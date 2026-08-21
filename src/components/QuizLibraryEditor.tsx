"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, GripVertical, MonitorPlay, Save } from "lucide-react";
import type { QuizEvent } from "@/lib/data";
import type { QuizLibraryItem, QuizQuestionItem, QuizQuestionKind } from "@/lib/quiz-library";
import { buildStandardMudrcQuestions, describeQuizContent, roundLabels } from "@/lib/quiz-template";
import { buildPresentationSlides } from "@/lib/quiz-presentation";

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

export default function QuizLibraryEditor({ quizId, initialQuiz = null }: Props) {
  const [quiz, setQuiz] = useState<QuizLibraryItem | null>(initialQuiz);
  const [loading, setLoading] = useState(!initialQuiz);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [events, setEvents] = useState<QuizEvent[]>([]);
  const [playEventSlug, setPlayEventSlug] = useState("");
  const [openRound, setOpenRound] = useState<number>(1);
  const [dragQuestionId, setDragQuestionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/quiz-library/${quizId}?_=${Date.now()}`, { cache: "no-store" });
    if (res.ok) setQuiz(await res.json());
    setLoading(false);
  }, [quizId]);

  useEffect(() => {
    if (!initialQuiz) load();
    fetch(`/api/admin/events?_=${Date.now()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setEvents(d.events ?? []));
  }, [initialQuiz, load]);

  const questions = useMemo(() => quiz?.questions ?? [], [quiz?.questions]);
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
        setQuiz(await res.json());
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
    <div className="space-y-6">
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

      <p className="text-brand-muted text-sm bg-brand-warm border border-brand-border rounded-xl px-4 py-3">
        Každá otázka má text a odpoveď na jednom mieste. Obrázok môžeš zobraziť pri otázke (zaškrtnuté) alebo len pri
        správnych odpovediach. Poradie otázok v kole meníš šípkami alebo pretiahnutím — čísla sa prepočítajú automaticky.
      </p>

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

      <div className="space-y-4">
        <h3 className="font-display text-xl text-brand-text">
          Kolo {openRound} — {roundLabels[openRound]}
        </h3>
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
            className={`bg-brand-card border border-brand-border rounded-2xl p-5 space-y-3 transition-shadow ${
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
            <div className="grid gap-3 sm:grid-cols-2">
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
              <label className="flex items-center gap-2 text-sm text-brand-text cursor-pointer">
                <input
                  type="checkbox"
                  checked={question.imageDuringQuestion}
                  onChange={(e) => updateQuestion(question.id, { imageDuringQuestion: e.target.checked })}
                  className="rounded border-brand-border"
                />
                Zobraziť obrázok aj počas otázky (inak len pri správnych odpovediach)
              </label>
            )}
          </div>
          );
        })}
      </div>
    </div>
  );
}
