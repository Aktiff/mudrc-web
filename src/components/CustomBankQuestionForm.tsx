"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Plus } from "lucide-react";
import ImageUrlField from "@/components/admin/ImageUrlField";
import { BankThemeSelect } from "@/components/BankThemeControls";
import { DEFAULT_BANK_THEME, DEFAULT_BANK_THEMES } from "@/lib/bank-themes";
import { fetchBankThemes } from "@/lib/bank-themes-client";
import { addCustomBankQuestionAsync, type CustomBankQuestion } from "@/lib/quiz-custom-bank";
import TagSuggestInput from "@/components/TagSuggestInput";
import { parseTagsInput } from "@/lib/quiz-question-tags";
import { formatMatchBankAnswer, formatOrderAnswer, validateMatchColumns } from "@/lib/quiz-question-options";
import MatchPairFields from "@/components/MatchPairFields";
import OrderItemFields from "@/components/OrderItemFields";

const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"] as const;
const EMPTY_ORDER = ["", "", "", ""];
const EMPTY_MATCH = ["", "", ""];

type QuestionMode = "choice" | "open" | "order" | "match";

type Props = {
  onAdded?: (question: CustomBankQuestion) => void;
};

export default function CustomBankQuestionForm({ onAdded }: Props) {
  const [open, setOpen] = useState(false);
  const [questionMode, setQuestionMode] = useState<QuestionMode>("choice");
  const [body, setBody] = useState("");
  const [options, setOptions] = useState(["", "", "", "", "", ""]);
  const [orderItems, setOrderItems] = useState(EMPTY_ORDER);
  const [matchLeft, setMatchLeft] = useState(EMPTY_MATCH);
  const [matchRight, setMatchRight] = useState(EMPTY_MATCH);
  const [openAnswer, setOpenAnswer] = useState("");
  const [correctIndex, setCorrectIndex] = useState(0);
  const [note, setNote] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [theme, setTheme] = useState<string>(DEFAULT_BANK_THEME);
  const [themes, setThemes] = useState<string[]>([...DEFAULT_BANK_THEMES]);
  const [difficulty, setDifficulty] = useState(5);
  const [isImageQuestion, setIsImageQuestion] = useState(false);
  const [suggestedImageUrl, setSuggestedImageUrl] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setBody("");
    setOptions(["", "", "", "", "", ""]);
    setOrderItems([...EMPTY_ORDER]);
    setMatchLeft([...EMPTY_MATCH]);
    setMatchRight([...EMPTY_MATCH]);
    setOpenAnswer("");
    setCorrectIndex(0);
    setNote("");
    setTagsText("");
    setTheme(DEFAULT_BANK_THEME);
    setDifficulty(5);
    setIsImageQuestion(false);
    setSuggestedImageUrl("");
  };

  useEffect(() => {
    void fetchBankThemes().then(setThemes);
    const refresh = () => {
      void fetchBankThemes().then(setThemes);
    };
    window.addEventListener("mudrc-bank-themes-updated", refresh);
    return () => window.removeEventListener("mudrc-bank-themes-updated", refresh);
  }, []);

  const handleSubmit = async () => {
    setError("");
    setSuccess("");
    const trimmedBody = body.trim();
    if (!trimmedBody) {
      setError("Zadaj text otázky.");
      return;
    }

    const filledOrder = orderItems.map((item) => item.trim()).filter(Boolean);
    if (questionMode === "open") {
      const answer = openAnswer.trim();
      if (!answer) {
        setError("Zadaj správnu odpoveď.");
        return;
      }
    } else if (questionMode === "order") {
      if (filledOrder.length < 2) {
        setError("Zadaj aspoň dve položky v správnom poradí.");
        return;
      }
    } else if (questionMode === "match") {
      const checked = validateMatchColumns(matchLeft, matchRight);
      if (checked.error) {
        setError(checked.error);
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
          theme,
          difficulty,
          isImageQuestion,
          isOpenQuestion: true,
          suggestedImageUrl: suggestedImageUrl.trim() || undefined,
        });
      } else if (questionMode === "order") {
        created = await addCustomBankQuestionAsync({
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
        });
      } else if (questionMode === "match") {
        const pairs = validateMatchColumns(matchLeft, matchRight).pairs;
        created = await addCustomBankQuestionAsync({
          body: trimmedBody,
          options: pairs.map((pair) => pair.left),
          matchRight: pairs.map((pair) => pair.right),
          correctIndex: 0,
          answer: formatMatchBankAnswer(pairs),
          note: note.trim() || undefined,
          tags: parseTagsInput(tagsText),
          theme,
          difficulty,
          isImageQuestion,
          isOpenQuestion: false,
          isOrderQuestion: false,
          isMatchQuestion: true,
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
          theme,
          difficulty,
          isImageQuestion,
          isOpenQuestion: false,
          suggestedImageUrl: suggestedImageUrl.trim() || undefined,
        });
      }

      resetForm();
      setSuccess(
        `Otázka je uložená v banke. Tagy: ${created.tags.join(", ")}${tagsText.trim() ? "" : " (doplnené automaticky)"}.`
      );
      onAdded?.(created);
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
              <button
                type="button"
                onClick={() => setQuestionMode("order")}
                className={`text-sm font-semibold px-4 py-2 rounded-xl border transition-colors ${
                  questionMode === "order"
                    ? "bg-brand-orange text-brand-btn-fg border-brand-orange"
                    : "border-brand-border text-brand-muted hover:border-brand-orange"
                }`}
              >
                Usporiadaj
              </button>
              <button
                type="button"
                onClick={() => setQuestionMode("match")}
                className={`text-sm font-semibold px-4 py-2 rounded-xl border transition-colors ${
                  questionMode === "match"
                    ? "bg-brand-orange text-brand-btn-fg border-brand-orange"
                    : "border-brand-border text-brand-muted hover:border-brand-orange"
                }`}
              >
                Priraď
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

          {questionMode === "order" ? (
            <div>
              <label className="label">Položky v správnom poradí</label>
              <OrderItemFields items={orderItems} onChange={setOrderItems} />
            </div>
          ) : questionMode === "match" ? (
            <div>
              <label className="label">Dvojice v správnom priradení</label>
              <MatchPairFields
                left={matchLeft}
                right={matchRight}
                onChange={(left, right) => {
                  setMatchLeft(left);
                  setMatchRight(right);
                }}
              />
            </div>
          ) : questionMode === "choice" ? (
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

          <BankThemeSelect themes={themes} value={theme} onChange={setTheme} onThemesChange={setThemes} />

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
              <TagSuggestInput
                className="input text-sm py-2"
                value={tagsText}
                onChange={setTagsText}
                placeholder="Ak necháš prázdne, doplníme ich za teba"
              />
              <p className="text-brand-muted text-xs mt-1">Použitý tag sa uloží a nabudúce sa ponúkne pri písaní.</p>
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
