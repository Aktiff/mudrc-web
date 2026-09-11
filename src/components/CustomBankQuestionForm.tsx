"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Plus } from "lucide-react";
import ImageUrlField from "@/components/admin/ImageUrlField";
import { addCustomBankQuestion } from "@/lib/quiz-custom-bank";
import { parseTagsInput } from "@/lib/quiz-question-tags";

const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"] as const;

type Props = {
  onAdded?: () => void;
};

export default function CustomBankQuestionForm({ onAdded }: Props) {
  const [open, setOpen] = useState(true);
  const [body, setBody] = useState("");
  const [options, setOptions] = useState(["", "", "", "", "", ""]);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [note, setNote] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [difficulty, setDifficulty] = useState(5);
  const [isImageQuestion, setIsImageQuestion] = useState(false);
  const [suggestedImageUrl, setSuggestedImageUrl] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const resetForm = () => {
    setBody("");
    setOptions(["", "", "", "", "", ""]);
    setCorrectIndex(0);
    setNote("");
    setTagsText("");
    setDifficulty(5);
    setIsImageQuestion(false);
    setSuggestedImageUrl("");
  };

  const handleSubmit = () => {
    setError("");
    setSuccess("");
    const trimmedBody = body.trim();
    if (!trimmedBody) {
      setError("Zadaj text otázky.");
      return;
    }
    const filledOptions = options.map((o) => o.trim());
    const nonEmptyCount = filledOptions.filter(Boolean).length;
    if (nonEmptyCount < 4) {
      setError("Vyplň aspoň 4 možnosti (A–D).");
      return;
    }
    if (!filledOptions[correctIndex]) {
      setError("Správna odpoveď musí mať vyplnený text v zvolenej možnosti.");
      return;
    }

    addCustomBankQuestion({
      body: trimmedBody,
      options: filledOptions,
      correctIndex,
      note: note.trim() || undefined,
      tags: parseTagsInput(tagsText),
      difficulty,
      isImageQuestion,
      suggestedImageUrl: suggestedImageUrl.trim() || undefined,
    });

    resetForm();
    setSuccess("Otázka pridaná do banky — zobrazí sa navrchu medzi tvojimi otázkami.");
    onAdded?.();
    window.setTimeout(() => setSuccess(""), 4000);
  };

  return (
    <div className="bg-brand-card border border-brand-orange/25 rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-brand-warm/50 transition-colors"
      >
        <div>
          <p className="font-semibold text-brand-text text-sm">Pridať vlastnú otázku do banky</p>
          <p className="text-brand-muted text-xs mt-0.5">
            Tvoje otázky majú v banke vždy prioritu a zobrazia sa navrchu.
          </p>
        </div>
        {open ? <ChevronUp className="w-5 h-5 text-brand-muted shrink-0" /> : <ChevronDown className="w-5 h-5 text-brand-muted shrink-0" />}
      </button>

      {open && (
        <div className="px-5 pb-5 pt-0 space-y-4 border-t border-brand-border">
          <div>
            <label className="label">Otázka</label>
            <textarea
              className="input min-h-[72px] resize-y text-sm"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Text otázky pre projektor…"
            />
          </div>

          <div>
            <label className="label">Možnosti A–F</label>
            <div className="space-y-2">
              {OPTION_LETTERS.map((letter, index) => (
                <div key={letter} className="flex items-center gap-2">
                  <label className="flex items-center gap-2 shrink-0 w-24 cursor-pointer text-sm">
                    <input
                      type="radio"
                      name="custom-bank-correct"
                      checked={correctIndex === index}
                      onChange={() => setCorrectIndex(index)}
                      className="rounded-full border-brand-border"
                    />
                    <span className="font-mono font-semibold text-brand-muted">{letter})</span>
                  </label>
                  <input
                    className="input text-sm py-2 flex-1"
                    value={options[index]}
                    onChange={(e) =>
                      setOptions((prev) => {
                        const next = [...prev];
                        next[index] = e.target.value;
                        return next;
                      })
                    }
                    placeholder={index < 4 ? "Povinné" : "Voliteľné"}
                  />
                </div>
              ))}
            </div>
            <p className="text-brand-muted text-xs mt-1.5">Označ kolieskom správnu možnosť.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Obtiažnosť (1–10)</label>
              <input
                type="number"
                min={1}
                max={10}
                className="input text-sm py-2"
                value={difficulty}
                onChange={(e) => setDifficulty(Number(e.target.value) || 5)}
              />
            </div>
            <div>
              <label className="label">Tagy (voliteľné)</label>
              <input
                className="input text-sm py-2"
                value={tagsText}
                onChange={(e) => setTagsText(e.target.value)}
                placeholder="film, história…"
              />
            </div>
          </div>

          <div>
            <label className="label">Info pre teba (voliteľné)</label>
            <textarea
              className="input min-h-[56px] resize-y text-sm bg-brand-warm"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Poznámka, pasca, vysvetlenie…"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-brand-text cursor-pointer">
            <input
              type="checkbox"
              checked={isImageQuestion}
              onChange={(e) => setIsImageQuestion(e.target.checked)}
              className="rounded border-brand-border"
            />
            Foto otázka (pre sloty 5, 10, 15…)
          </label>

          {isImageQuestion && (
            <div>
              <label className="label">Obrázok (URL)</label>
              <ImageUrlField value={suggestedImageUrl} onChange={setSuggestedImageUrl} />
              <p className="text-brand-muted text-xs mt-1">
                Pri vložení do kvízu sa URL predvyplní — môžeš ho upraviť v editore slotu.
              </p>
            </div>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}
          {success && <p className="text-sm text-green-600 dark:text-green-400">{success}</p>}

          <button type="button" onClick={handleSubmit} className="btn-primary text-sm py-2.5 px-5 inline-flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Pridať do banky
          </button>
        </div>
      )}
    </div>
  );
}
