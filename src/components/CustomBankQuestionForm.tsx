"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Plus } from "lucide-react";
import ImageUrlField from "@/components/admin/ImageUrlField";
import { addCustomBankQuestionAsync } from "@/lib/quiz-custom-bank";
import { parseTagsInput } from "@/lib/quiz-question-tags";

const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"] as const;

type QuestionMode = "choice" | "open";

type Props = {
  onAdded?: () => void;
};

export default function CustomBankQuestionForm({ onAdded }: Props) {
  const [open, setOpen] = useState(true);
  const [questionMode, setQuestionMode] = useState<QuestionMode>("choice");
  const [body, setBody] = useState("");
  const [options, setOptions] = useState(["", "", "", "", "", ""]);
  const [openAnswer, setOpenAnswer] = useState("");
  const [correctIndex, setCorrectIndex] = useState(0);
  const [note, setNote] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [difficulty, setDifficulty] = useState(5);
  const [isImageQuestion, setIsImageQuestion] = useState(false);
  const [suggestedImageUrl, setSuggestedImageUrl] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setBody("");
    setOptions(["", "", "", "", "", ""]);
    setOpenAnswer("");
    setCorrectIndex(0);
    setNote("");
    setTagsText("");
    setDifficulty(5);
    setIsImageQuestion(false);
    setSuggestedImageUrl("");
  };

  const handleSubmit = async () => {
    setError("");
    setSuccess("");
    const trimmedBody = body.trim();
    if (!trimmedBody) {
      setError("Zadaj text otázky.");
      return;
    }

    if (questionMode === "open") {
      const answer = openAnswer.trim();
      if (!answer) {
        setError("Zadaj správnu odpoveď.");
        return;
      }
    } else {
      const filledOptions = options.map((o) => o.trim());
      if (!filledOptions[0] || !filledOptions[1]) {
        setError("Možnosti A a B sú povinné.");
        return;
      }
      if (!filledOptions[correctIndex]) {
        setError("Správna odpoveď musí mať vyplnený text v zvolenej možnosti.");
        return;
      }
    }

    setSubmitting(true);
    try {
      let created;
      if (questionMode === "open") {
        created = await addCustomBankQuestionAsync({
          body: trimmedBody,
          options: ["", "", "", "", "", ""],
          correctIndex: 0,
          answer: openAnswer.trim(),
          note: note.trim() || undefined,
          tags: parseTagsInput(tagsText),
          difficulty,
          isImageQuestion,
          isOpenQuestion: true,
          suggestedImageUrl: suggestedImageUrl.trim() || undefined,
        });
      } else {
        const filledOptions = options.map((o) => o.trim());
        created = await addCustomBankQuestionAsync({
          body: trimmedBody,
          options: filledOptions,
          correctIndex,
          note: note.trim() || undefined,
          tags: parseTagsInput(tagsText),
          difficulty,
          isImageQuestion,
          isOpenQuestion: false,
          suggestedImageUrl: suggestedImageUrl.trim() || undefined,
        });
      }

      resetForm();
      setSuccess(
        `Otázka uložená do banky (aj na serveri). Tagy: ${created.tags.join(", ")}${tagsText.trim() ? "" : " (doplnené automaticky)"}.`
      );
      onAdded?.();
      window.setTimeout(() => setSuccess(""), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Uloženie zlyhalo.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-brand-card border border-brand-orange/25 rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 sm:px-6 sm:py-5 text-left hover:bg-brand-warm/50 transition-colors"
      >
        <div>
          <p className="font-semibold text-brand-text text-sm">Pridať vlastnú otázku do banky</p>
          <p className="text-brand-muted text-xs mt-0.5">
            Tvoje otázky sa ukladajú na server — zostanú aj po obnovení stránky.
          </p>
        </div>
        {open ? <ChevronUp className="w-5 h-5 text-brand-muted shrink-0" /> : <ChevronDown className="w-5 h-5 text-brand-muted shrink-0" />}
      </button>

      {open && (
        <div className="px-5 py-5 sm:px-6 sm:py-6 space-y-5 border-t border-brand-border">
          <div>
            <p className="label mb-2.5">Typ otázky</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setQuestionMode("choice")}
                className={`text-sm font-semibold px-4 py-2 rounded-xl border transition-colors ${
                  questionMode === "choice"
                    ? "bg-brand-orange text-brand-btn-fg border-brand-orange"
                    : "border-brand-border text-brand-muted hover:border-brand-orange"
                }`}
              >
                S možnosťami (A–F)
              </button>
              <button
                type="button"
                onClick={() => setQuestionMode("open")}
                className={`text-sm font-semibold px-4 py-2 rounded-xl border transition-colors ${
                  questionMode === "open"
                    ? "bg-brand-orange text-brand-btn-fg border-brand-orange"
                    : "border-brand-border text-brand-muted hover:border-brand-orange"
                }`}
              >
                Bez možností (otvorená)
              </button>
            </div>
          </div>

          <div>
            <label className="label">Otázka</label>
            <textarea
              className="input min-h-[72px] resize-y text-sm"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Text otázky pre projektor…"
            />
          </div>

          {questionMode === "choice" ? (
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
                      placeholder={index < 2 ? "Povinné" : "Voliteľné"}
                    />
                  </div>
                ))}
              </div>
              <p className="text-brand-muted text-xs mt-1.5">
                Povinné sú A a B, C–F voliteľné. Označ kolieskom správnu možnosť.
              </p>
            </div>
          ) : (
            <div>
              <label className="label">Správna odpoveď</label>
              <input
                className="input text-sm py-2"
                value={openAnswer}
                onChange={(e) => setOpenAnswer(e.target.value)}
                placeholder="Očakávaná odpoveď tímu…"
              />
            </div>
          )}

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
                placeholder="Ak necháš prázdne, doplníme ich za teba"
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
            Foto otázka (pre sloty 5 a 10 v kole)
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

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="btn-primary text-sm py-2.5 px-5 inline-flex items-center gap-2 disabled:opacity-60"
          >
            <Plus className="w-4 h-4" />
            {submitting ? "Ukladám…" : "Pridať do banky"}
          </button>
        </div>
      )}
    </div>
  );
}
