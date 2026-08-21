"use client";

import { useMemo, useState } from "react";
import { BookOpen, Check, ChevronDown, ChevronUp, ClipboardCopy } from "lucide-react";
import type { QuizQuestionItem } from "@/lib/quiz-library";
import {
  formatBankQuestionBody,
  formatBankQuestionClipboard,
  PUB_QUIZ_BANK,
  type QuizBankQuestion,
} from "@/lib/quiz-question-bank";

type Props = {
  roundQuestions: QuizQuestionItem[];
  onInsert: (targetQuestionId: string, body: string, answer: string) => void;
};

const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"] as const;

export default function QuizQuestionBankPanel({ roundQuestions, onInsert }: Props) {
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [targetByBankId, setTargetByBankId] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const normalQuestions = useMemo(
    () => roundQuestions.filter((q) => q.kind === "normal"),
    [roundQuestions]
  );

  const defaultTargetId = normalQuestions[0]?.id ?? "";

  const copyText = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 2000);
    } catch {
      window.prompt("Skopíruj text:", text);
    }
  };

  const getTargetId = (bankId: string) => targetByBankId[bankId] || defaultTargetId;

  const handleInsert = (item: QuizBankQuestion) => {
    const targetId = getTargetId(item.id);
    if (!targetId) return;
    onInsert(targetId, formatBankQuestionBody(item), item.answer);
  };

  return (
    <div className="bg-brand-card border border-brand-border rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-brand-warm transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-brand-tint flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5 text-brand-orange" />
          </div>
          <div>
            <p className="font-semibold text-brand-text">Banka otázok — všeobecný pub kvíz</p>
            <p className="text-brand-muted text-sm">
              {PUB_QUIZ_BANK.length} overených otázok · 6 možností · obtiažnosť · poznámka pre kvízmistra
            </p>
          </div>
        </div>
        {open ? <ChevronUp className="w-5 h-5 text-brand-muted shrink-0" /> : <ChevronDown className="w-5 h-5 text-brand-muted shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-brand-border px-5 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
          <p className="text-brand-muted text-sm">
            Otvor otázku, skopíruj alebo ju rovno vlož do slotu v aktuálnom kole. Možnosti sú v texte otázky pre čítanie
            nahlas; na projekcii zostáva len otázka a neskôr správna odpoveď.
          </p>

          {PUB_QUIZ_BANK.map((item, index) => {
            const expanded = expandedId === item.id;
            const targetId = getTargetId(item.id);

            return (
              <div key={item.id} className="rounded-xl border border-brand-border bg-brand-surface/50 p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className="text-xs font-bold uppercase tracking-wider text-brand-orange-readable bg-brand-tint px-2 py-0.5 rounded-md">
                        #{index + 1}
                      </span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-card border border-brand-border text-brand-muted">
                        Obtiažnosť {item.difficulty}/10
                      </span>
                    </div>
                    <p className="font-semibold text-brand-text leading-snug">{item.body}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : item.id)}
                    className="text-sm text-brand-orange-readable font-semibold shrink-0"
                  >
                    {expanded ? "Skryť" : "Detail"}
                  </button>
                </div>

                {expanded && (
                  <div className="space-y-3 pt-1">
                    <ul className="grid gap-1.5 sm:grid-cols-2">
                      {item.options.map((option, optionIndex) => (
                        <li
                          key={optionIndex}
                          className={`text-sm px-3 py-2 rounded-lg border ${
                            optionIndex === item.correctIndex
                              ? "border-green-500/50 bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-200 font-semibold"
                              : "border-brand-border text-brand-text bg-brand-card"
                          }`}
                        >
                          <span className="font-mono text-xs mr-2 opacity-70">{OPTION_LETTERS[optionIndex]})</span>
                          {option}
                        </li>
                      ))}
                    </ul>
                    <p className="text-sm text-brand-muted leading-relaxed bg-brand-warm border border-brand-border rounded-lg px-3 py-2">
                      <span className="font-semibold text-brand-text">Prečo / zaujímavosť: </span>
                      {item.note}
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {normalQuestions.length > 0 && (
                    <>
                      <select
                        className="input text-sm py-2 min-w-[10rem] max-w-full"
                        value={targetId}
                        onChange={(e) =>
                          setTargetByBankId((prev) => ({ ...prev, [item.id]: e.target.value }))
                        }
                      >
                        {normalQuestions.map((q) => (
                          <option key={q.id} value={q.id}>
                            Otázka {q.questionNumber}
                            {q.body.trim() ? " (obsadená)" : " (prázdna)"}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => handleInsert(item)}
                        className="btn-primary text-sm py-2 px-4"
                      >
                        Vložiť do kvízu
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => copyText(formatBankQuestionBody(item), `${item.id}-body`)}
                    className="btn-outline text-sm py-2 px-3 inline-flex items-center gap-1.5"
                  >
                    {copiedId === `${item.id}-body` ? <Check className="w-4 h-4" /> : <ClipboardCopy className="w-4 h-4" />}
                    Kopírovať otázku
                  </button>
                  <button
                    type="button"
                    onClick={() => copyText(item.answer, `${item.id}-answer`)}
                    className="btn-outline text-sm py-2 px-3 inline-flex items-center gap-1.5"
                  >
                    {copiedId === `${item.id}-answer` ? <Check className="w-4 h-4" /> : <ClipboardCopy className="w-4 h-4" />}
                    Odpoveď
                  </button>
                  <button
                    type="button"
                    onClick={() => copyText(formatBankQuestionClipboard(item), `${item.id}-all`)}
                    className="btn-outline text-sm py-2 px-3 inline-flex items-center gap-1.5"
                  >
                    {copiedId === `${item.id}-all` ? <Check className="w-4 h-4" /> : <ClipboardCopy className="w-4 h-4" />}
                    Všetko
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
