"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  MonitorPlay,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import type { QuizLibraryItem, QuizSlide, QuizSlideType } from "@/lib/quiz-library";
import { createEmptySlide, createSlideId, slideTypeLabel } from "@/lib/quiz-deck";

const SLIDE_TYPES: QuizSlideType[] = ["title", "round", "question", "text", "scores"];

type Props = {
  quizId: string;
  initialQuiz?: QuizLibraryItem | null;
};

export default function QuizLibraryEditor({ quizId, initialQuiz = null }: Props) {
  const [quiz, setQuiz] = useState<QuizLibraryItem | null>(initialQuiz);
  const [loading, setLoading] = useState(!initialQuiz);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [addType, setAddType] = useState<QuizSlideType>("question");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/quiz-library/${quizId}?_=${Date.now()}`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setQuiz(data);
    }
    setLoading(false);
  }, [quizId]);

  useEffect(() => {
    if (!initialQuiz) load();
  }, [initialQuiz, load]);

  const slides = useMemo(() => quiz?.slides ?? [], [quiz?.slides]);

  const updateSlide = (id: string, patch: Partial<QuizSlide>) => {
    setQuiz((prev) =>
      prev
        ? {
            ...prev,
            slides: prev.slides.map((slide) => (slide.id === id ? { ...slide, ...patch } : slide)),
          }
        : prev
    );
  };

  const moveSlide = (index: number, direction: -1 | 1) => {
    setQuiz((prev) => {
      if (!prev) return prev;
      const next = [...prev.slides];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...prev, slides: next };
    });
  };

  const duplicateSlide = (slide: QuizSlide) => {
    setQuiz((prev) =>
      prev ? { ...prev, slides: [...prev.slides, { ...slide, id: createSlideId() }] } : prev
    );
  };

  const removeSlide = (id: string) => {
    setQuiz((prev) => (prev ? { ...prev, slides: prev.slides.filter((slide) => slide.id !== id) } : prev));
  };

  const addSlide = () => {
    setQuiz((prev) => (prev ? { ...prev, slides: [...prev.slides, createEmptySlide(addType)] } : prev));
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

  if (loading) {
    return <p className="text-brand-muted text-sm">Načítavam slidy…</p>;
  }

  if (!quiz) {
    return <p className="text-red-500 text-sm">Kvíz sa nepodarilo načítať.</p>;
  }

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
          <label className="label">Poznámka (voliteľné)</label>
          <input
            className="input"
            value={quiz.notes ?? ""}
            onChange={(e) => setQuiz({ ...quiz, notes: e.target.value })}
            placeholder="Téma, obtiažnosť, poznámky…"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-brand-muted text-sm">{slides.length} slidov</p>
          {msg && (
            <p className={`text-sm mt-1 ${msg.ok ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
              {msg.text}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/admin/hotove-kvizy/${quizId}/prehrat`}
            className="btn-primary text-sm py-2.5 px-4 inline-flex items-center gap-2"
          >
            <MonitorPlay className="w-4 h-4" />
            Spustiť na projektor
          </Link>
          <button type="button" onClick={save} disabled={saving} className="btn-outline text-sm py-2.5 px-4 inline-flex items-center gap-2">
            <Save className="w-4 h-4" />
            {saving ? "Ukladám…" : "Uložiť"}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {slides.map((slide, index) => (
          <div key={slide.id} className="bg-brand-card border border-brand-border rounded-2xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs font-bold uppercase tracking-wider text-brand-orange-readable bg-brand-tint px-2.5 py-1 rounded-lg">
                {index + 1}. {slideTypeLabel(slide.type)}
              </span>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => moveSlide(index, -1)} className="p-2 rounded-lg hover:bg-brand-hover text-brand-muted">
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => moveSlide(index, 1)} className="p-2 rounded-lg hover:bg-brand-hover text-brand-muted">
                  <ChevronDown className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => duplicateSlide(slide)} className="p-2 rounded-lg hover:bg-brand-hover text-brand-muted">
                  <Copy className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => removeSlide(slide.id)} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-red-500">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div>
              <label className="label">Nadpis</label>
              <input className="input" value={slide.title ?? ""} onChange={(e) => updateSlide(slide.id, { title: e.target.value })} />
            </div>

            {slide.type === "title" && (
              <div>
                <label className="label">Podnadpis</label>
                <input className="input" value={slide.subtitle ?? ""} onChange={(e) => updateSlide(slide.id, { subtitle: e.target.value })} />
              </div>
            )}

            {slide.type === "round" && (
              <div>
                <label className="label">Číslo kola</label>
                <input
                  className="input max-w-[8rem]"
                  type="number"
                  min={1}
                  value={slide.roundNumber ?? 1}
                  onChange={(e) => updateSlide(slide.id, { roundNumber: Number(e.target.value) || 1 })}
                />
              </div>
            )}

            {(slide.type === "question" || slide.type === "text" || slide.type === "scores") && (
              <div>
                <label className="label">{slide.type === "question" ? "Text otázky" : "Text na slide"}</label>
                <textarea
                  className="input min-h-[100px] resize-y"
                  value={slide.body ?? ""}
                  onChange={(e) => updateSlide(slide.id, { body: e.target.value })}
                />
              </div>
            )}

            {slide.type === "question" && (
              <>
                <div>
                  <label className="label">Správna odpoveď</label>
                  <input className="input" value={slide.answer ?? ""} onChange={(e) => updateSlide(slide.id, { answer: e.target.value })} />
                </div>
                <div>
                  <label className="label">Obrázok (URL)</label>
                  <input
                    className="input"
                    value={slide.imageUrl ?? ""}
                    onChange={(e) => updateSlide(slide.id, { imageUrl: e.target.value })}
                    placeholder="https://…"
                  />
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3 bg-brand-warm border border-brand-border rounded-2xl p-5">
        <div className="flex-1 min-w-[200px]">
          <label className="label">Pridať slide</label>
          <select className="input" value={addType} onChange={(e) => setAddType(e.target.value as QuizSlideType)}>
            {SLIDE_TYPES.map((type) => (
              <option key={type} value={type}>
                {slideTypeLabel(type)}
              </option>
            ))}
          </select>
        </div>
        <button type="button" onClick={addSlide} className="btn-outline text-sm py-2.5 px-4 inline-flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Pridať slide
        </button>
      </div>
    </div>
  );
}
