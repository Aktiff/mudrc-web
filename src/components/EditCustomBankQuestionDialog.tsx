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
import {
  formatMatchBankAnswer,
  formatOrderAnswer,
  matchDraftFromColumns,
  orderItemsFromAnswer,
  validateMatchDraft,
} from "@/lib/quiz-question-options";
import MatchPairFields from "@/components/MatchPairFields";
import OrderItemFields from "@/components/OrderItemFields";

const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"] as const;

function matchFieldsFromQuestion(question: CustomBankQuestion): { left: string[]; right: string[]; assign: number[] } {
  return matchDraftFromColumns(question.options, question.matchRight ?? []);
}

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
  const [questionMode, setQuestionMode] = useState<"choice" | "open" | "order" | "match">("choice");
  const [body, setBody] = useState("");
  const [options, setOptions] = useState(["", "", "", "", "", ""]);
  const [orderItems, setOrderItems] = useState(["", "", "", ""]);
  const [matchLeft, setMatchLeft] = useState(["", ""]);
  const [matchRight, setMatchRight] = useState(["", ""]);
  const [matchAssign, setMatchAssign] = useState([0, 1]);
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
  const saveQueue = useRef(Promise.resolve());
  const saveRef = useRef<(closeAfter: boolean) => Promise<unknown>>(async () => undefined);
  questionRef.current = question;
  const formRef = useRef({
    questionMode,
    body,
    options,
    orderItems,
    matchLeft,
    matchRight,
    matchAssign,
    openAnswer,
    correctIndex,
    note,
    tagsText,
    theme,
    difficulty,
    isImageQuestion,
    suggestedImageUrl,
  });
  formRef.current = {
    questionMode,
    body,
    options,
    orderItems,
    matchLeft,
    matchRight,
    matchAssign,
    openAnswer,
    correctIndex,
    note,
    tagsText,
    theme,
    difficulty,
    isImageQuestion,
    suggestedImageUrl,
  };

  const snapshot = () =>
    JSON.stringify({
      questionMode,
      body,
      options,
      orderItems,
      matchLeft,
      matchRight,
      matchAssign,
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
    const nextMode = question.isMatchQuestion
      ? "match"
      : question.isOrderQuestion
        ? "order"
        : question.isOpenQuestion
          ? "open"
          : "choice";
    const nextOptions = question.isOrderQuestion || question.isMatchQuestion ? ["", "", "", "", "", ""] : [...question.options];
    while (nextOptions.length < 6) nextOptions.push("");
    const nextOrder = orderFieldsFromQuestion(question);
    const nextMatch = matchFieldsFromQuestion(question);
    const nextAnswer = question.isOpenQuestion && !question.isOrderQuestion && !question.isMatchQuestion ? question.answer : "";
    const nextTags = formatTagsInput(question.tags);
    const nextTheme = bankQuestionTheme(question);
    const nextNote = question.note ?? "";
    const nextImage = Boolean(question.isImageQuestion);
    const nextUrl = question.suggestedImageUrl ?? "";
    setQuestionMode(nextMode);
    setBody(question.body);
    setOptions(nextOptions.slice(0, 6));
    setOrderItems(nextOrder);
    setMatchLeft(nextMatch.left);
    setMatchRight(nextMatch.right);
    setMatchAssign(nextMatch.assign);
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
      matchLeft: nextMatch.left,
      matchRight: nextMatch.right,
      matchAssign: nextMatch.assign,
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
      void saveRef.current(false);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [question, questionMode, body, options, orderItems, matchLeft, matchRight, matchAssign, openAnswer, correctIndex, note, tagsText, theme, difficulty, isImageQuestion, suggestedImageUrl]);

  useEffect(() => {
    void fetchBankThemes().then(setThemes);
    const refresh = () => {
      void fetchBankThemes().then(setThemes);
    };
    window.addEventListener("mudrc-bank-themes-updated", refresh);
    return () => window.removeEventListener("mudrc-bank-themes-updated", refresh);
  }, []);

  if (!question) return null;

  const save = (closeAfter: boolean) => {
    const run = saveQueue.current.then(async () => {
      const current = questionRef.current;
      const form = formRef.current;
      if (!current) return;
      setError("");
      const trimmedBody = form.body.trim();
      if (!trimmedBody) {
        if (closeAfter) setError("Zadaj text otázky.");
        return;
      }

      const filledOrder = form.orderItems.map((item) => item.trim()).filter(Boolean);
      if (form.questionMode === "open") {
        if (!form.openAnswer.trim()) {
          if (closeAfter) setError("Zadaj správnu odpoveď.");
          return;
        }
      } else if (form.questionMode === "order") {
        if (filledOrder.length < 2) {
          if (closeAfter) setError("Zadaj aspoň dve položky v správnom poradí.");
          return;
        }
      } else if (form.questionMode === "match") {
        const checked = validateMatchDraft(form.matchLeft, form.matchRight, form.matchAssign);
        if (checked.error) {
          if (closeAfter) setError(checked.error);
          return;
        }
      } else {
        const filledOptions = form.options.map((option) => option.trim());
        if (!filledOptions[0] || !filledOptions[1]) {
          if (closeAfter) setError("Možnosti A a B sú povinné.");
          return;
        }
        if (!filledOptions[form.correctIndex]) {
          if (closeAfter) setError("Správna možnosť musí mať text.");
          return;
        }
      }

      const currentSnapshot = JSON.stringify(form);
      if (!closeAfter && currentSnapshot === baseline.current) return;

      setSubmitting(true);
      try {
        const payload =
          form.questionMode === "open"
            ? {
                body: trimmedBody,
                options: ["", "", "", "", "", ""] as string[],
                correctIndex: 0,
                answer: form.openAnswer.trim(),
                note: form.note.trim() || undefined,
                tags: parseTagsInput(form.tagsText),
                theme: form.theme,
                difficulty: form.difficulty,
                isImageQuestion: form.isImageQuestion,
                isOpenQuestion: true,
                isOrderQuestion: false,
                isMatchQuestion: false,
                suggestedImageUrl: form.suggestedImageUrl.trim() || undefined,
              }
            : form.questionMode === "order"
              ? {
                  body: trimmedBody,
                  options: filledOrder,
                  correctIndex: 0,
                  answer: formatOrderAnswer(filledOrder),
                  note: form.note.trim() || undefined,
                  tags: parseTagsInput(form.tagsText),
                  theme: form.theme,
                  difficulty: form.difficulty,
                  isImageQuestion: form.isImageQuestion,
                  isOpenQuestion: false,
                  isOrderQuestion: true,
                  isMatchQuestion: false,
                  suggestedImageUrl: form.suggestedImageUrl.trim() || undefined,
                }
              : form.questionMode === "match"
                ? (() => {
                    const pairs = validateMatchDraft(form.matchLeft, form.matchRight, form.matchAssign).pairs;
                    return {
                      body: trimmedBody,
                      options: pairs.map((pair) => pair.left),
                      matchRight: pairs.map((pair) => pair.right),
                      correctIndex: 0,
                      answer: formatMatchBankAnswer(pairs),
                      note: form.note.trim() || undefined,
                      tags: parseTagsInput(form.tagsText),
                      theme: form.theme,
                      difficulty: form.difficulty,
                      isImageQuestion: form.isImageQuestion,
                      isOpenQuestion: false,
                      isOrderQuestion: false,
                      isMatchQuestion: true,
                      suggestedImageUrl: form.suggestedImageUrl.trim() || undefined,
                    };
                  })()
                : {
                    body: trimmedBody,
                    options: form.options.map((option) => option.trim()),
                    correctIndex: form.correctIndex,
                    note: form.note.trim() || undefined,
                    tags: parseTagsInput(form.tagsText),
                    theme: form.theme,
                    difficulty: form.difficulty,
                    isImageQuestion: form.isImageQuestion,
                    isOpenQuestion: false,
                    isOrderQuestion: false,
                    isMatchQuestion: false,
                    suggestedImageUrl: form.suggestedImageUrl.trim() || undefined,
                  };

        await updateCustomBankQuestionAsync(current.id, payload);
        baseline.current = currentSnapshot;
        setSavedTick((value) => value + 1);
        onSaved();
        if (closeAfter && JSON.stringify(formRef.current) === currentSnapshot) onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Uloženie zlyhalo.");
      } finally {
        setSubmitting(false);
      }
    });
    saveQueue.current = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  };
  saveRef.current = save;

  const handleSave = () => {
    void save(true);
  };
  const formIsDirty = baseline.current !== snapshot();

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-brand-border bg-brand-card shadow-2xl p-5 sm:p-6 space-y-4"
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
          <button
            type="button"
            onClick={() => setQuestionMode("match")}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg border ${
              questionMode === "match" ? "bg-brand-orange text-brand-btn-fg border-brand-orange" : "border-brand-border"
            }`}
          >
            Priraď
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
        ) : questionMode === "match" ? (
          <div>
            <label className="label">Priradenie</label>
            <MatchPairFields
              left={matchLeft}
              right={matchRight}
              assign={matchAssign}
              onChange={(left, right, assign) => {
                setMatchLeft(left);
                setMatchRight(right);
                setMatchAssign(assign);
              }}
            />
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
            {submitting ? "Ukladám…" : formIsDirty ? "Uložiť" : savedTick > 0 ? "Uložené" : "Uložiť"}
          </button>
        </div>
      </div>
    </div>
  );
}
