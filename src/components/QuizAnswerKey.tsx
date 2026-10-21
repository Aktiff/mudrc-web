"use client";

import { useEffect, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { isQuestionSlotEmpty, type QuizQuestionItem } from "@/lib/quiz-library";
import { findCorrectOptionIndex, optionLetter, parseEmbeddedOptions } from "@/lib/quiz-question-options";
import { displayQuestionNumber, sortQuizQuestions } from "@/lib/quiz-template";

function choicesOf(question: QuizQuestionItem): string[] {
  const stored = (question.options ?? []).map((option) => option.trim()).filter(Boolean);
  if (stored.length) return stored;
  return parseEmbeddedOptions(question.body).options;
}

function answerLine(question: QuizQuestionItem): { letter: string; text: string } {
  const answer = question.answer.trim();
  if (question.isOrderQuestion || question.isMatchQuestion) return { letter: "", text: answer || "bez odpovede" };
  const choices = choicesOf(question);
  if (choices.length && answer) {
    const index = findCorrectOptionIndex(choices, answer);
    if (index >= 0) return { letter: optionLetter(index), text: choices[index] ?? answer };
  }
  if (question.kind === "music" && question.musicArtist?.trim() && question.musicTitle?.trim()) {
    return { letter: "", text: `${question.musicArtist.trim()} — ${question.musicTitle.trim()}` };
  }
  return { letter: "", text: answer || "bez odpovede" };
}

export default function QuizAnswerKey({
  title,
  questions,
  onClose,
}: {
  title: string;
  questions: QuizQuestionItem[];
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const [openRound, setOpenRound] = useState<number | null>(null);
  const rounds = new Map<number, QuizQuestionItem[]>();
  for (const question of sortQuizQuestions(questions)) {
    if (isQuestionSlotEmpty(question)) continue;
    const list = rounds.get(question.roundNumber) ?? [];
    list.push(question);
    rounds.set(question.roundNumber, list);
  }
  const roundEntries = Array.from(rounds.entries());

  return (
    <div
      className="fixed inset-0 z-[110] bg-black/60 flex items-center justify-center p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Správne odpovede"
        className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-brand-card border border-brand-border rounded-2xl shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-brand-border">
          <div className="min-w-0">
            <p className="font-semibold text-brand-text text-sm">Správne odpovede</p>
            <p className="text-xs text-brand-muted truncate">{title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg border border-brand-border text-brand-muted hover:text-brand-text"
            aria-label="Zavrieť"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {roundEntries.length === 0 ? (
          <p className="text-sm text-brand-muted px-4 py-8 text-center">V kvíze zatiaľ nie sú vyplnené otázky.</p>
        ) : (
          <div className="p-4 space-y-2">
            {roundEntries.map(([round, list]) => {
              const open = openRound === round;
              return (
                <section key={round} className="rounded-xl border border-brand-border overflow-hidden">
                  <button
                    type="button"
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-brand-surface/60"
                    aria-expanded={open}
                    onClick={() => setOpenRound(open ? null : round)}
                  >
                    <span className="font-semibold text-brand-text">Kolo {round}</span>
                    <span className="flex items-center gap-2 text-xs text-brand-muted">
                      {list.length} {list.length === 1 ? "otázka" : list.length < 5 ? "otázky" : "otázok"}
                      <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
                    </span>
                  </button>
                  {open ? (
                    <ul className="space-y-0.5 px-4 pb-3 border-t border-brand-border pt-2">
                      {list.map((question) => {
                        const line = answerLine(question);
                        return (
                          <li key={question.id} className="flex items-baseline gap-2 text-sm leading-snug">
                            <span className="w-5 shrink-0 text-right tabular-nums font-semibold text-brand-muted">
                              {displayQuestionNumber(question)}
                            </span>
                            {line.letter ? (
                              <span className="w-4 shrink-0 font-bold text-brand-orange-readable">{line.letter}</span>
                            ) : null}
                            <span className={`whitespace-pre-line ${line.text === "bez odpovede" ? "text-brand-muted" : "text-brand-text"}`}>
                              {line.text}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
