"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import ImageUrlField from "@/components/admin/ImageUrlField";
import type { CustomBankQuestion } from "@/lib/quiz-custom-bank";
import { updateCustomBankQuestionAsync } from "@/lib/quiz-custom-bank";
import { formatTagsInput, parseTagsInput } from "@/lib/quiz-question-tags";

const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"] as const;

type Props = {
  question: CustomBankQuestion | null;
  onClose: () => void;
  onSaved: () => void;
};

export default function EditCustomBankQuestionDialog({ question, onClose, onSaved }: Props) {
  const [questionMode, setQuestionMode] = useState<"choice" | "open">("choice");
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
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!question) return;
    setQuestionMode(question.isOpenQuestion ? "open" : "choice");
    setBody(question.body);
    setOptions([...question.options]);
    setOpenAnswer(question.isOpenQuestion ? question.answer : "");
    setCorrectIndex(question.correctIndex);
    setNote(question.note ?? "");
    setTagsText(formatTagsInput(question.tags));
    setDifficulty(question.difficulty);
    setIsImageQuestion(Boolean(question.isImageQuestion));
    setSuggestedImageUrl(question.suggestedImageUrl ?? "");
    setError("");
  }, [question]);

  if (!question) return null;

  const handleSave = async () => {
    setError("");
    const trimmedBody = body.trim();
    if (!trimmedBody) {
      setError("Zadaj text otázky.");
      return;
    }

    if (questionMode === "open") {
      if (!openAnswer.trim()) {
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
        setError("Správna možnosť musí mať text.");
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload =
        questionMode === "open"
          ? {
              body: trimmedBody,
              options: ["", "", "", "", "", ""] as string[],
              correctIndex: 0,
              answer: openAnswer.trim(),
              note: note.trim() || undefined,
              tags: parseTagsInput(tagsText),
              difficulty,
              isImageQuestion,
              isOpenQuestion: true,
              suggestedImageUrl: suggestedImageUrl.trim() || undefined,
            }
          : {
              body: trimmedBody,
              options: options.map((o) => o.trim()),
              correctIndex,
              note: note.trim() || undefined,
              tags: parseTagsInput(tagsText),
              difficulty,
              isImageQuestion,
              isOpenQuestion: false,
              suggestedImageUrl: suggestedImageUrl.trim() || undefined,
            };

      await updateCustomBankQuestionAsync(question.id, payload);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Uloženie zlyhalo.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-brand-border bg-brand-card shadow-2xl p-5 sm:p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 p-2 rounded-lg hover:bg-brand-warm text-brand-muted"
          aria-label="Zavrieť"
        >
          <X className="w-5 h-5" />
        </button>
        <h2 className="font-semibold text-brand-text pr-8">Upraviť otázku v banke</h2>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setQuestionMode("choice")}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg border ${
              questionMode === "choice" ? "bg-brand-orange text-brand-btn-fg border-brand-orange" : "border-brand-border"
            }`}
          >
            S možnosťami
          </button>
          <button
            type="button"
            onClick={() => setQuestionMode("open")}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg border ${
              questionMode === "open" ? "bg-brand-orange text-brand-btn-fg border-brand-orange" : "border-brand-border"
            }`}
          >
            Otvorená
          </button>
        </div>

        <div>
          <label className="label">Otázka</label>
          <textarea className="input min-h-[72px] text-sm" value={body} onChange={(e) => setBody(e.target.value)} />
        </div>

        {questionMode === "choice" ? (
          <div className="space-y-2">
            {OPTION_LETTERS.map((letter, index) => (
              <div key={letter} className="flex items-center gap-2">
                <label className="flex items-center gap-1 shrink-0 w-20 cursor-pointer text-sm">
                  <input
                    type="radio"
                    checked={correctIndex === index}
                    onChange={() => setCorrectIndex(index)}
                  />
                  <span className="font-mono text-brand-muted">{letter})</span>
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
                />
              </div>
            ))}
          </div>
        ) : (
          <div>
            <label className="label">Správna odpoveď</label>
            <input className="input text-sm py-2" value={openAnswer} onChange={(e) => setOpenAnswer(e.target.value)} />
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Obtiažnosť</label>
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
            <label className="label">Tagy</label>
            <input className="input text-sm py-2" value={tagsText} onChange={(e) => setTagsText(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="label">Info pre teba</label>
          <textarea className="input min-h-[56px] text-sm" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={isImageQuestion} onChange={(e) => setIsImageQuestion(e.target.checked)} />
          Foto otázka
        </label>
        {isImageQuestion && <ImageUrlField value={suggestedImageUrl} onChange={setSuggestedImageUrl} />}

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-outline text-sm py-2 px-4 flex-1">
            Zrušiť
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={handleSave}
            className="btn-primary text-sm py-2 px-4 flex-1 disabled:opacity-60"
          >
            {submitting ? "Ukladám…" : "Uložiť"}
          </button>
        </div>
      </div>
    </div>
  );
}
