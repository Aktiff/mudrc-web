"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  MonitorPlay,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import type { QuizDeck, QuizSlide, QuizSlideType } from "@/lib/quiz-deck";
import { createEmptySlide, createSlideId, slideTypeLabel } from "@/lib/quiz-deck";
import ImageUrlField from "@/components/admin/ImageUrlField";

const SLIDE_TYPES: QuizSlideType[] = ["title", "round", "question", "text", "scores"];

type Props = {
  eventSlug: string;
};

export default function QuizDeckEditor({ eventSlug }: Props) {
  const [deck, setDeck] = useState<QuizDeck | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [addType, setAddType] = useState<QuizSlideType>("question");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/events/${eventSlug}/deck?_=${Date.now()}`, { cache: "no-store" });
    if (res.ok) setDeck(await res.json());
    setLoading(false);
  }, [eventSlug]);

  useEffect(() => {
    load();
  }, [load]);

  const updateSlide = (id: string, patch: Partial<QuizSlide>) => {
    setDeck((prev) =>
      prev
        ? {
            ...prev,
            slides: prev.slides.map((slide) => (slide.id === id ? { ...slide, ...patch } : slide)),
          }
        : prev
    );
  };

  const moveSlide = (index: number, direction: -1 | 1) => {
    setDeck((prev) => {
      if (!prev) return prev;
      const next = [...prev.slides];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...prev, slides: next };
    });
  };

  const duplicateSlide = (slide: QuizSlide) => {
    setDeck((prev) =>
      prev
        ? {
            ...prev,
            slides: [...prev.slides, { ...slide, id: createSlideId() }],
          }
        : prev
    );
  };

  const removeSlide = (id: string) => {
    setDeck((prev) => (prev ? { ...prev, slides: prev.slides.filter((slide) => slide.id !== id) } : prev));
  };

  const addSlide = () => {
    setDeck((prev) => (prev ? { ...prev, slides: [...prev.slides, createEmptySlide(addType)] } : prev));
  };

  const save = async () => {
    if (!deck) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/events/${eventSlug}/deck`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(deck),
      });
      if (res.ok) {
        setDeck(await res.json());
        setMsg({ text: "Prezentácia uložená.", ok: true });
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

  if (!deck) {
    return <p className="text-red-500 text-sm">Prezentáciu sa nepodarilo načítať.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-brand-muted text-sm">
            {deck.slides.length} slidov · uložené v cloude pre <strong>{deck.venueTitle}</strong>
          </p>
          {msg && (
            <p className={`text-sm mt-1 ${msg.ok ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
              {msg.text}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/admin/udalosti/${eventSlug}/prezentacia-kvizu/prehrat`}
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
        {deck.slides.map((slide, index) => (
          <div key={slide.id} className="bg-brand-card border border-brand-border rounded-2xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold uppercase tracking-wider text-brand-orange-readable bg-brand-tint px-2.5 py-1 rounded-lg">
                  {index + 1}. {slideTypeLabel(slide.type)}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => moveSlide(index, -1)} className="p-2 rounded-lg hover:bg-brand-hover text-brand-muted" title="Posunúť hore">
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => moveSlide(index, 1)} className="p-2 rounded-lg hover:bg-brand-hover text-brand-muted" title="Posunúť dole">
                  <ChevronDown className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => duplicateSlide(slide)} className="p-2 rounded-lg hover:bg-brand-hover text-brand-muted" title="Duplikovať">
                  <Copy className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => removeSlide(slide.id)} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-red-500" title="Zmazať">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {(slide.type === "title" || slide.type === "round" || slide.type === "question" || slide.type === "text" || slide.type === "scores") && (
              <div>
                <label className="label">Nadpis</label>
                <input className="input" value={slide.title ?? ""} onChange={(e) => updateSlide(slide.id, { title: e.target.value })} />
              </div>
            )}

            {slide.type === "title" && (
              <div>
                <label className="label">Podnadpis (podnik / mesto)</label>
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
                  <label className="label">Správna odpoveď (odhalí sa klikom v projekcii)</label>
                  <input className="input" value={slide.answer ?? ""} onChange={(e) => updateSlide(slide.id, { answer: e.target.value })} />
                </div>
                <ImageUrlField
                  label="Obrázok (voliteľné)"
                  value={slide.imageUrl ?? ""}
                  onChange={(url) => updateSlide(slide.id, { imageUrl: url })}
                  onUploadError={(text) => setMsg({ text, ok: false })}
                  onUploadSuccess={(text) => setMsg({ text, ok: true })}
                />
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
