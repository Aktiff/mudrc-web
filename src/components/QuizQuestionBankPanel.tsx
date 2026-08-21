"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, Check, ClipboardCopy, Trash2 } from "lucide-react";
import type { QuizQuestionItem } from "@/lib/quiz-library";
import {
  filterVisibleBankQuestions,
  formatBankQuestionBody,
  readHiddenBankQuestionIds,
  writeHiddenBankQuestionIds,
  type QuizBankQuestion,
} from "@/lib/quiz-question-bank";

type Props = {
  roundQuestions: QuizQuestionItem[];
  usedBankQuestionIds: string[];
  onInsert: (
    bankId: string,
    targetQuestionId: string,
    body: string,
    answer: string,
    options: string[]
  ) => void;
};

const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"] as const;

export default function QuizQuestionBankPanel({ roundQuestions, usedBankQuestionIds, onInsert }: Props) {
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [targetByBankId, setTargetByBankId] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    setHiddenIds(readHiddenBankQuestionIds());
  }, []);

  const visibleQuestions = useMemo(
    () => filterVisibleBankQuestions(usedBankQuestionIds, hiddenIds),
    [usedBankQuestionIds, hiddenIds]
  );

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
    onInsert(item.id, targetId, item.body, item.answer, [...item.options]);
  };

  const dismissQuestion = (bankId: string) => {
    if (!window.confirm("Odstrániť túto otázku z banky? (Zmizne aj v iných kvízoch.)")) return;
    const next = Array.from(new Set([...hiddenIds, bankId]));
    setHiddenIds(next);
    writeHiddenBankQuestionIds(next);
  };

  return (
    <div className="bg-brand-card border border-brand-border rounded-2xl flex flex-col min-w-0 max-w-full h-full max-h-[calc(100vh-10rem)] overflow-hidden">
      <div className="px-4 py-4 border-b border-brand-border shrink-0">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-tint flex items-center justify-center shrink-0">
            <BookOpen className="w-4 h-4 text-brand-orange" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-brand-text text-sm leading-snug">Banka otázok</p>
            <p className="text-brand-muted text-xs mt-0.5 leading-relaxed">
              {visibleQuestions.length} k dispozícii · vložené miznú z banky pre tento kvíz
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
        {visibleQuestions.length === 0 ? (
          <p className="text-brand-muted text-sm text-center py-8">
            Všetky otázky z banky sú vložené alebo odstránené.
          </p>
        ) : (
          visibleQuestions.map((item, index) => {
            const targetId = getTargetId(item.id);

            return (
              <div key={item.id} className="rounded-xl border border-brand-border bg-brand-surface/50 p-3 space-y-2.5">
                <div>
                  <div className="flex flex-wrap items-center gap-1.5 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-brand-orange-readable bg-brand-tint px-1.5 py-0.5 rounded">
                      #{index + 1}
                    </span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-brand-card border border-brand-border text-brand-muted">
                      {item.difficulty}/10
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-brand-text leading-snug break-words">{item.body}</p>
                </div>

                <ul className="space-y-1">
                  {item.options.map((option, optionIndex) => (
                    <li
                      key={optionIndex}
                      className={`text-xs px-2 py-1.5 rounded-md border leading-snug break-words ${
                        optionIndex === item.correctIndex
                          ? "border-green-500/50 bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-200 font-semibold"
                          : "border-brand-border text-brand-text bg-brand-card"
                      }`}
                    >
                      <span className="font-mono opacity-60 mr-1">{OPTION_LETTERS[optionIndex]})</span>
                      {option}
                    </li>
                  ))}
                </ul>

                <p className="text-xs text-brand-muted leading-relaxed bg-brand-warm border border-brand-border rounded-lg px-2.5 py-2">
                  <span className="font-semibold text-brand-text">Info: </span>
                  {item.note}
                </p>

                <div className="flex flex-col gap-2">
                  {normalQuestions.length > 0 && (
                    <div className="flex gap-2">
                      <select
                        className="input text-xs py-2 flex-1 min-w-0"
                        value={targetId}
                        onChange={(e) =>
                          setTargetByBankId((prev) => ({ ...prev, [item.id]: e.target.value }))
                        }
                      >
                        {normalQuestions.map((q) => (
                          <option key={q.id} value={q.id}>
                            Ot. {q.questionNumber}
                            {q.body.trim() ? " · obsadená" : " · prázdna"}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => handleInsert(item)}
                        className="btn-primary text-xs py-2 px-3 shrink-0"
                      >
                        Vložiť
                      </button>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => copyText(formatBankQuestionBody(item), `${item.id}-body`)}
                      className="btn-outline text-xs py-1.5 px-2 inline-flex items-center gap-1"
                    >
                      {copiedId === `${item.id}-body` ? <Check className="w-3 h-3" /> : <ClipboardCopy className="w-3 h-3" />}
                      Kopírovať
                    </button>
                    <button
                      type="button"
                      onClick={() => dismissQuestion(item.id)}
                      className="btn-outline text-xs py-1.5 px-2 inline-flex items-center gap-1 text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-950/30"
                    >
                      <Trash2 className="w-3 h-3" />
                      Vymazať
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
