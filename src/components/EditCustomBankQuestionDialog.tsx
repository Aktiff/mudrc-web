"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import ImageUrlField from "@/components/admin/ImageUrlField";
import { BankThemeSelect } from "@/components/BankThemeControls";
import { bankQuestionTheme, DEFAULT_BANK_THEMES } from "@/lib/bank-themes";
import { fetchBankThemes } from "@/lib/bank-themes-client";
import TagSuggestInput from "@/components/TagSuggestInput";
import type { CustomBankQuestion } from "@/lib/quiz-custom-bank";
import { updateCustomBankQuestionAsync } from "@/lib/quiz-custom-bank";
import { formatTagsInput, parseTagsInput } from "@/lib/quiz-question-tags";
import { formatOrderAnswer, orderItemsFromAnswer } from "@/lib/quiz-question-options";
import OrderItemFields from "@/components/OrderItemFields";

const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"] as const;

function orderFieldsFromQuestion(question: CustomBankQuestion): string[] {
  const fromOptions = question.options.map((option) => option.trim()).filter(Boolean);
  const fromAnswer = orderItemsFromAnswer(question.answer);
  const items = fromOptions.length >= 2 ? fromOptions : fromAnswer;
  const next = items.length ? [...items] : ["", "", "", ""];
  while (next.length < 2) next.push("");
  return next;
}

type Props = {
  question: CustomBankQuestion | null;
  onClose: () => void;
  onSaved: () => void;
};

export default function EditCustomBankQuestionDialog({ question, onClose, onSaved }: Props) {
  const [questionMode, setQuestionMode] = useState<"choice" | "open" | "order">("choice");
  const [body, setBody] = useState("");
  const [options, setOptions] = useState(["", "", "", "", "", ""]);
  const [orderItems, setOrderItems] = useState(["", "", "", ""]);
  const [openAnswer, setOpenAnswer] = useState("");
  const [correctIndex, setCorrectIndex] = useState(0);
  const [note, setNote] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [theme, setTheme] = useState("");
  const [themes, setThemes] = useState<string[]>([...DEFAULT_BANK_THEMES]);
  const [difficulty, setDifficulty] = useState(5);
  const [isImageQuestion, setIsImageQuestion] = useState(false);
  const [suggestedImageUrl, setSuggestedImageUrl] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [savedTick, setSavedTick] = useState(0);
  const baseline = useRef("");
  const questionRef = useRef(question);
  const persistRef = useRef<(closeAfter: boolean) => Promise<void>>(async () => {});
  questionRef.current = question;

  const snapshot = () =>
    JSON.stringify({
      questionMode,
      body,
      options,
      orderItems,
      openAnswer,
      correctIndex,
      note,
      tagsText,
      theme,
      difficulty,
      isImageQuestion,
      suggestedImageUrl,
    });

  useEffect(() => {
    if (!question) return;
    const nextMode = question.isOrderQuestion ? "order" : question.isOpenQuestion ? "open" : "choice";
    const nextOptions = question.isOrderQuestion ? ["", "", "", "", "", ""] : [...question.options];
    while (nextOptions.length < 6) nextOptions.push("");
    const nextOrder = orderFieldsFromQuestion(question);
    const nextAnswer = question.isOpenQuestion && !question.isOrderQuestion ? question.answer : "";
    const nextTags = formatTagsInput(question.tags);
    const nextTheme = bankQuestionTheme(question);
    const nextNote = question.note ?? "";
    const nextImage = Boolean(question.isImageQuestion);
    const nextUrl = question.suggestedImageUrl ?? "";
    setQuestionMode(nextMode);
    setBody(question.body);
    setOptions(nextOptions.slice(0, 6));
    setOrderItems(nextOrder);
    setOpenAnswer(nextAnswer);
    setCorrectIndex(question.correctIndex);
    setNote(nextNote);
    setTagsText(nextTags);
    setTheme(nextTheme);
    setDifficulty(question.difficulty);
    setIsImageQuestion(nextImage);
    setSuggestedImageUrl(nextUrl);
    setError("");
    baseline.current = JSON.stringify({
      questionMode: nextMode,
      body: question.body,
      options: nextOptions.slice(0, 6),
      orderItems: nextOrder,
      openAnswer: nextAnswer,
      correctIndex: question.correctIndex,
      note: nextNote,
      tagsText: nextTags,
      theme: nextTheme,
      difficulty: question.difficulty,
      isImageQuestion: nextImage,
      suggestedImageUrl: nextUrl,
    });
  }, [question]);

  useEffect(() => {
    if (!question) return;
    const current = snapshot();
    if (!baseline.current || current === baseline.current) return;
    const timer = window.setTimeout(() => {
      void persistRef.current(false);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [question, questionMode, body, options, orderItems, openAnswer, correctIndex, note, tagsText, theme, difficulty, isImageQuestion, suggestedImageUrl]);

  useEffect(() => {
    void fetchBankThemes().then(setThemes);
    const refresh = () => {
      void fetchBankThemes().then(setThemes);
    };
    window.addEventListener("mudrc-bank-themes-updated", refresh);
    return () => window.removeEventListener("mudrc-bank-themes-updated", refresh);
  }, []);

  if (!question) return null;

  const persist = async (closeAfter: boolean) => {
    const current = questionRef.current;
    if (!current) return;
    setError("");
    const trimmedBody = body.trim();
    if (!trimmedBody) {
      if (closeAfter) setError("Zadaj text otázky.");
      return;
    }

    const filledOrder = orderItems.map((item) => item.trim()).filter(Boolean);
    if (questionMode === "open") {
      if (!openAnswer.trim()) {
        if (closeAfter) setError("Zadaj správnu odpoveď.");
        return;
      }
    } else if (questionMode === "order") {
      if (filledOrder.length < 2) {
        if (closeAfter) setError("Zadaj aspoň dve položky v správnom poradí.");
        return;
      }
    } else {
      const filledOptions = options.map((o) => o.trim());
      if (!filledOptions[0] || !filledOptions[1]) {
        if (closeAfter) setError("Možnosti A a B sú povinné.");
        return;
      }
      if (!filledOptions[correctIndex]) {
        if (closeAfter) setError("Správna možnosť musí mať text.");
        return;
      }
    }

    const currentSnapshot = snapshot();
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
              theme,
              difficulty,
              isImageQuestion,
              isOpenQuestion: true,
              isOrderQuestion: false,
              suggestedImageUrl: suggestedImageUrl.trim() || undefined,
            }
          : questionMode === "order"
            ? {
                body: trimmedBody,
                options: filledOrder,
                correctIndex: 0,
                answer: formatOrderAnswer(filledOrder),
                note: note.trim() || undefined,
                tags: parseTagsInput(tagsText),
                theme,
                difficulty,
                isImageQuestion,
                isOpenQuestion: false,
                isOrderQuestion: true,
                suggestedImageUrl: suggestedImageUrl.trim() || undefined,
              }
            : {
              body: trimmedBody,
              options: options.map((o) => o.trim()),
              correctIndex,
              note: note.trim() || undefined,
              tags: parseTagsInput(tagsText),
              theme,
              difficulty,
              isImageQuestion,
              isOpenQuestion: false,
              isOrderQuestion: false,
              suggestedImageUrl: suggestedImageUrl.trim() || undefined,
            };

      await updateCustomBankQuestionAsync(current.id, payload);
      baseline.current = currentSnapshot;
      setSavedTick((value) => value + 1);
      onSaved();
      if (closeAfter) onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Uloženie zlyhalo.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSave = () => {
    void persist(true);
  };
  persistRef.current = persist;

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
          <button
            type="button"
            onClick={() => setQuestionMode("order")}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg border ${
              questionMode === "order" ? "bg-brand-orange text-brand-btn-fg border-brand-orange" : "border-brand-border"
            }`}
          >
            Usporiadaj
          </button>
        </div>

        <BankThemeSelect themes={themes} value={theme} onChange={setTheme} onThemesChange={setThemes} />

        <div>
          <label className="label">Otázka</label>
          <textarea className="input min-h-[72px] text-sm" value={body} onChange={(e) => setBody(e.target.value)} />
        </div>

        {questionMode === "order" ? (
          <div>
            <label className="label">Položky v správnom poradí</label>
            <OrderItemFields items={orderItems} onChange={setOrderItems} />
          </div>
        ) : questionMode === "choice" ? (
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
            <TagSuggestInput className="input text-sm py-2" value={tagsText} onChange={setTagsText} />
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
            {submitting ? "Ukladám…" : savedTick > 0 ? "Uložené" : "Uložiť"}
          </button>
        </div>
      </div>
    </div>
  );
}
