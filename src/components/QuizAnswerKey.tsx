"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
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
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4 p-4">
            {roundEntries.map(([round, list]) => (
              <section key={round} className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-muted mb-1">Kolo {round}</p>
                <ul className="space-y-0.5">
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
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
