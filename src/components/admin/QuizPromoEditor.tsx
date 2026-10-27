"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import ImageUrlField from "@/components/admin/ImageUrlField";
import type { QuizPromoSlide } from "@/lib/quiz-library";

function newPromoId(): string {
  return `promo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export default function QuizPromoEditor({
  promos,
  rounds,
  onChange,
}: {
  promos: QuizPromoSlide[];
  rounds: number[];
  onChange: (promos: QuizPromoSlide[]) => void;
}) {
  const [uploadError, setUploadError] = useState("");
  const update = (id: string, patch: Partial<QuizPromoSlide>) => {
    onChange(promos.map((promo) => (promo.id === id ? { ...promo, ...patch } : promo)));
  };

  const move = (index: number, direction: -1 | 1) => {
    const next = index + direction;
    if (next < 0 || next >= promos.length) return;
    const copy = promos.slice();
    const [item] = copy.splice(index, 1);
    copy.splice(next, 0, item);
    onChange(copy);
  };

  return (
    <section className="rounded-2xl border border-brand-border bg-brand-card p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl text-brand-text">Promo v prezentácii</h2>
          <p className="text-brand-muted text-sm mt-1 leading-relaxed">
            Slide s logom a textom, napríklad sponzor cien. Objaví sa po správnych odpovediach vybraného kola.
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            onChange([
              ...promos,
              {
                id: newPromoId(),
                afterRound: rounds.length ? rounds[rounds.length - 1] : 0,
                title: "",
                text: "",
              },
            ])
          }
          className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl border border-brand-border text-brand-text"
        >
          <Plus className="w-4 h-4" />
          Pridať slide
        </button>
      </div>

      {promos.length === 0 ? (
        <p className="text-brand-muted text-sm">Zatiaľ žiadne promo. Pridaj slide, nahraj logo a napíš text.</p>
      ) : (
        <div className="space-y-4">
          {promos.map((promo, index) => (
            <div key={promo.id} className="rounded-xl border border-brand-border p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-brand-muted uppercase tracking-wider">Slide {index + 1}</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                    className="p-2 rounded-lg border border-brand-border text-brand-text disabled:opacity-40"
                    title="Vyššie"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={index === promos.length - 1}
                    onClick={() => move(index, 1)}
                    className="p-2 rounded-lg border border-brand-border text-brand-text disabled:opacity-40"
                    title="Nižšie"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange(promos.filter((item) => item.id !== promo.id))}
                    className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl border border-red-200 dark:border-red-900 text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                    Zmazať
                  </button>
                </div>
              </div>

              <div>
                <label className="label">Kedy ho ukázať</label>
                <select
                  className="input"
                  value={promo.afterRound}
                  onChange={(event) => update(promo.id, { afterRound: Number(event.target.value) })}
                >
                  {!rounds.includes(promo.afterRound) && promo.afterRound !== 0 ? (
                    <option value={promo.afterRound}>Po správnych odpovediach {promo.afterRound}. kola</option>
                  ) : null}
                  {rounds.map((round) => (
                    <option key={round} value={round}>
                      Po správnych odpovediach {round}. kola
                    </option>
                  ))}
                  <option value={0}>Pred vyhodnotením</option>
                </select>
              </div>

              <div>
                <label className="label">Nadpis</label>
                <input
                  className="input"
                  value={promo.title}
                  onChange={(event) => update(promo.id, { title: event.target.value })}
                  placeholder="Sponzorom cien je"
                />
              </div>

              <div>
                <label className="label">Text</label>
                <textarea
                  className="input min-h-[88px] resize-y"
                  value={promo.text}
                  onChange={(event) => update(promo.id, { text: event.target.value })}
                  placeholder="Zlatníctvo Eva Nováková"
                />
              </div>

              <ImageUrlField
                label="Logo"
                value={promo.imageUrl ?? ""}
                onChange={(imageUrl) => update(promo.id, { imageUrl: imageUrl.trim() || undefined })}
                onUploadError={setUploadError}
                onUploadSuccess={() => setUploadError("")}
              />
              {uploadError ? <p className="text-sm text-red-500">{uploadError}</p> : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
