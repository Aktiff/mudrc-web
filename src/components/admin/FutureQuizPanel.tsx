"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { FutureQuiz } from "@/lib/data";
import { formatEventDateLabel } from "@/lib/data";
import { normalizeFutureQuizzes } from "@/lib/future-quizzes";
import { normalizeQuizRules, type QuizRule } from "@/lib/quiz-rules";
import { AdminDatePicker, AdminTimePicker } from "@/components/AdminDatePicker";
import QuizTypeField from "@/components/admin/QuizTypeField";
import { RuleListEditor } from "@/components/admin/RuleListEditor";
import { DEFAULT_QUIZ_TYPE } from "@/lib/quiz-type";

type FutureQuizPanelProps = {
  slug: string;
  eventDate: string;
  eventTime: string;
  quizzes: FutureQuiz[];
  knownTypes: string[];
  venueRules?: QuizRule[];
  onChange: (quizzes: FutureQuiz[]) => void;
  onMessage: (text: string, ok: boolean) => void;
};

export default function FutureQuizPanel({
  slug,
  eventDate,
  eventTime,
  quizzes,
  knownTypes,
  venueRules = [],
  onChange,
  onMessage,
}: FutureQuizPanelProps) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState(eventTime || "19:00");
  const [quizType, setQuizType] = useState(DEFAULT_QUIZ_TYPE);
  const [customType, setCustomType] = useState("");
  const [busy, setBusy] = useState(false);
  const listed = normalizeFutureQuizzes(quizzes);

  const addTerm = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/events/${slug}/dalsi-termin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          time: time || eventTime,
          quizType: customType.trim() || quizType,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        onMessage(typeof data.error === "string" ? data.error : "Termín sa nepodarilo pridať.", false);
        return;
      }
      onChange(normalizeFutureQuizzes(data.futureQuizzes));
      setDate("");
      setCustomType("");
      onMessage("Ďalší termín je pridaný. Najbližší kvíz ostal bez zmeny.", true);
    } catch {
      onMessage("Sieťová chyba pri pridávaní termínu.", false);
    } finally {
      setBusy(false);
    }
  };

  const saveRules = async (quiz: FutureQuiz, rules: QuizRule[], commonRules?: QuizRule[]) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/events/${slug}/dalsi-termin`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: quiz.id,
          specialRules: rules,
          ...(commonRules !== undefined ? { rules: commonRules } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        onMessage(typeof data.error === "string" ? data.error : "Pravidlá sa nepodarilo uložiť.", false);
        return;
      }
      onChange(normalizeFutureQuizzes(data.futureQuizzes));
      onMessage("Špeciálne pravidlá tohto termínu sú uložené.", true);
    } catch {
      onMessage("Sieťová chyba pri ukladaní pravidiel.", false);
    } finally {
      setBusy(false);
    }
  };

  const removeTerm = async (quiz: FutureQuiz) => {
    if (!confirm(`Zmazať termín ${quiz.date}? Najbližší kvíz sa tým nemení.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/events/${slug}/dalsi-termin`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: quiz.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        onMessage(typeof data.error === "string" ? data.error : "Termín sa nepodarilo zmazať.", false);
        return;
      }
      onChange(normalizeFutureQuizzes(data.futureQuizzes));
      onMessage("Termín je zmazaný.", true);
    } catch {
      onMessage("Sieťová chyba pri mazaní termínu.", false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-brand-border bg-brand-surface/40 p-4 space-y-4">
      <div>
        <p className="font-semibold text-brand-text text-sm">Ďalší kvíz v tomto podniku</p>
        <p className="text-brand-muted text-xs mt-1 leading-relaxed">
          Najbližší termín ostane tak, ako je. Tu pridáš špeciálny kvíz dopredu, aj o niekoľko mesiacov. Na webe sa ukáže ako druhá karta.
        </p>
      </div>
      {listed.length > 0 && (
        <ul className="space-y-4">
          {listed.map((quiz) => (
            <FutureQuizCard
              key={quiz.id}
              quiz={quiz}
              venueRules={venueRules}
              busy={busy}
              onSave={(rules, commonRules) => void saveRules(quiz, rules, commonRules)}
              onRemove={() => void removeTerm(quiz)}
            />
          ))}
        </ul>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Dátum ďalšieho kvízu</label>
          <AdminDatePicker value={date} onChange={setDate} placeholder="05.11.2026" />
          <p className="text-brand-muted text-xs mt-1">Musí byť až po {eventDate || "najbližšom termíne"}.</p>
        </div>
        <div>
          <label className="label">Čas</label>
          <AdminTimePicker value={time} onChange={setTime} />
        </div>
        <div>
          <label className="label">Typ kvízu</label>
          <QuizTypeField id={`future-quiz-type-${slug}`} value={quizType} knownTypes={knownTypes} onChange={setQuizType} />
        </div>
        <div>
          <label className="label">Alebo nový typ</label>
          <input
            className="input"
            value={customType}
            onChange={(event) => setCustomType(event.target.value)}
            placeholder="Filmový kvíz"
          />
        </div>
      </div>
      <button type="button" onClick={() => void addTerm()} disabled={busy || !date.trim()} className="btn-primary text-sm py-2.5 px-4">
        {busy ? "Ukladám..." : "Pridať ďalší termín"}
      </button>
    </div>
  );
}

function FutureQuizCard({
  quiz,
  venueRules,
  busy,
  onSave,
  onRemove,
}: {
  quiz: FutureQuiz;
  venueRules: QuizRule[];
  busy: boolean;
  onSave: (rules: QuizRule[], commonRules?: QuizRule[]) => void;
  onRemove: () => void;
}) {
  const [rules, setRules] = useState(() => normalizeQuizRules(quiz.specialRules));
  const [commonRules, setCommonRules] = useState(() => normalizeQuizRules(quiz.rules ?? venueRules));
  const [commonEdited, setCommonEdited] = useState(false);

  return (
    <li className="rounded-xl border border-brand-border bg-brand-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-brand-text font-semibold">
          {formatEventDateLabel(quiz.date)} · {quiz.time} · {quiz.quizType}
        </span>
        <button
          type="button"
          onClick={onRemove}
          disabled={busy}
          className="text-brand-muted hover:text-red-500 disabled:opacity-40"
          title="Zmazať termín"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      <div>
        <p className="font-semibold text-brand-text text-sm mb-1">Špeciálne pravidlá</p>
        <p className="text-brand-muted text-xs mb-3 leading-relaxed">
          Platia len pre tento termín. Najbližší kvíz ich neukáže. Na webe sú nad bežnými pravidlami podniku.
        </p>
        <RuleListEditor
          rules={rules}
          onChange={setRules}
          placeholder="Špeciálne pravidlo..."
          addLabel="Pridať špeciálne pravidlo"
          emptyLabel="Zatiaľ žiadne špeciálne pravidlá."
        />
        <details className="mt-4 rounded-lg border border-brand-border bg-brand-surface/50 px-3 py-2">
          <summary className="cursor-pointer text-sm font-semibold text-brand-text">Bežné pravidlá</summary>
          <p className="text-brand-muted text-xs mt-2 mb-3 leading-relaxed">
            Tu ich môžeš skryť len pre tento termín. Najbližší kvíz ostane so svojimi pravidlami. Skryté sa na webe ani v projekcii neukáže.
          </p>
          <RuleListEditor
            rules={commonRules}
            onChange={(next) => {
              setCommonRules(next);
              setCommonEdited(true);
            }}
            placeholder="Text pravidla..."
            addLabel="Pridať pravidlo"
            emptyLabel="Tento podnik zatiaľ nemá bežné pravidlá."
          />
        </details>
        <button
          type="button"
          onClick={() => onSave(rules, commonEdited ? commonRules : undefined)}
          disabled={busy}
          className="btn-primary text-sm py-2 px-4 mt-3"
        >
          {busy ? "Ukladám..." : "Uložiť pravidlá termínu"}
        </button>
      </div>
    </li>
  );
}
