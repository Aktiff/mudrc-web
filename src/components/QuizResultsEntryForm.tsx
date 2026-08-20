"use client";

import { Plus, Save, Trash2, Users } from "lucide-react";
import type { QuizEvent } from "@/lib/data";
import { AdminDatePicker } from "@/components/AdminDatePicker";
import { TeamAutocomplete } from "@/components/TeamAutocomplete";

export type QuizTeamRow = { name: string; scores: number[] };

type QuizOption = {
  id: string;
  title: string;
  isSafe: boolean;
  conflictingTeams: string[];
  usageCount: number;
};

type Props = {
  events: QuizEvent[];
  quizzes: QuizOption[];
  selectedEventSlug: string;
  onEventSlugChange: (slug: string) => void;
  libraryQuizId: string;
  onLibraryQuizIdChange: (id: string) => void;
  teamNamesText: string;
  onTeamNamesTextChange: (text: string) => void;
  onApplyTeams: () => void;
  quizDate: string;
  onQuizDateChange: (date: string) => void;
  quizTeams: QuizTeamRow[];
  onQuizTeamsChange: (teams: QuizTeamRow[]) => void;
  onSubmit: () => void;
  submitting: boolean;
  message: { text: string; ok: boolean } | null;
  resultSummary: { winnerTeam: string; ligaPoints: { name: string; total: number; liga: number }[] } | null;
  loadFromRegistrations?: () => void;
};

function getTotal(scores: number[]) {
  return scores.reduce((sum, score) => sum + (Number(score) || 0), 0);
}

export default function QuizResultsEntryForm({
  events,
  quizzes,
  selectedEventSlug,
  onEventSlugChange,
  libraryQuizId,
  onLibraryQuizIdChange,
  teamNamesText,
  onTeamNamesTextChange,
  onApplyTeams,
  quizDate,
  onQuizDateChange,
  quizTeams,
  onQuizTeamsChange,
  onSubmit,
  submitting,
  message,
  resultSummary,
  loadFromRegistrations,
}: Props) {
  const selectedEvent = events.find((event) => event.slug === selectedEventSlug) ?? null;
  const rounds = selectedEvent?.rounds || 4;
  const suggestions = (selectedEvent?.leagueTable ?? []).map((entry) => entry.teamName);
  const selectedQuiz = quizzes.find((quiz) => quiz.id === libraryQuizId);
  const activeTeamNames = quizTeams.map((team) => team.name.trim()).filter(Boolean);

  const updateTeam = (index: number, field: "name" | number, value: string | number) => {
    onQuizTeamsChange(
      quizTeams.map((team, idx) => {
        if (idx !== index) return team;
        if (field === "name") return { ...team, name: value as string };
        const scores = [...team.scores];
        scores[field as number] = Number(value);
        return { ...team, scores };
      })
    );
  };

  const addTeam = () => {
    onQuizTeamsChange([...quizTeams, { name: "", scores: Array(rounds).fill(0) }]);
  };

  const removeTeam = (index: number) => {
    onQuizTeamsChange(quizTeams.filter((_, idx) => idx !== index));
  };

  return (
    <div className="bg-brand-card rounded-2xl border border-brand-border p-6 space-y-6">
      <div>
        <h2 className="font-display text-2xl text-brand-text tracking-wide mb-1">Zapísať výsledok kvízu</h2>
        <p className="text-brand-muted text-sm">
          Vyber podnik a hotový kvíz, načítaj tímy do tabuľky a ulož body — priradí sa k podniku, dátumu a kvízu v knižnici.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Podnik</label>
          <select className="input" value={selectedEventSlug} onChange={(e) => onEventSlugChange(e.target.value)}>
            <option value="">— Vyber podnik —</option>
            {events.map((event) => (
              <option key={event.slug} value={event.slug}>
                {event.venue} · {event.city}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Hotový kvíz</label>
          <select className="input" value={libraryQuizId} onChange={(e) => onLibraryQuizIdChange(e.target.value)}>
            <option value="">— Vyber kvíz —</option>
            {quizzes.map((quiz) => (
              <option key={quiz.id} value={quiz.id}>
                {quiz.title}
                {quiz.usageCount ? ` (${quiz.usageCount}×)` : ""}
                {activeTeamNames.length && !quiz.isSafe ? " ⚠" : activeTeamNames.length && quiz.isSafe ? " ✓" : ""}
              </option>
            ))}
          </select>
          {selectedQuiz && activeTeamNames.length > 0 && (
            <p className={`text-xs mt-1.5 ${selectedQuiz.isSafe ? "text-green-600" : "text-amber-700"}`}>
              {selectedQuiz.isSafe
                ? "Tímy na tomto kvíze ešte nehrali."
                : `Konflikt: ${selectedQuiz.conflictingTeams.join(", ")}`}
            </p>
          )}
        </div>
        <div>
          <label className="label">Dátum kvízu</label>
          <AdminDatePicker value={quizDate} onChange={onQuizDateChange} />
        </div>
        <div>
          <label className="label">Tímy na večer (predvyplnenie)</label>
          <textarea
            className="input min-h-[88px] resize-y"
            value={teamNamesText}
            onChange={(e) => onTeamNamesTextChange(e.target.value)}
            placeholder={"Bzdochy\nDream Team\nBodky"}
          />
          <button type="button" onClick={onApplyTeams} className="btn-outline text-sm py-2 px-3 mt-2">
            Načítať do tabuľky
          </button>
        </div>
      </div>

      <div>
        <div className="grid gap-3 mb-2 pr-9" style={{ gridTemplateColumns: `1fr repeat(${rounds}, 5rem) 4.5rem` }}>
          <span className="text-xs text-brand-muted uppercase tracking-wider font-medium">Tím</span>
          {Array.from({ length: rounds }, (_, index) => (
            <span key={index} className="text-xs text-brand-muted uppercase tracking-wider font-medium text-center">
              K{index + 1}
            </span>
          ))}
          <span className="text-xs text-brand-orange uppercase tracking-wider font-semibold text-center">Body</span>
        </div>
        <div className="space-y-2">
          {quizTeams.map((team, index) => (
            <div
              key={index}
              className="grid gap-3 items-center"
              style={{ gridTemplateColumns: `1fr repeat(${rounds}, 5rem) 4.5rem 2rem` }}
            >
              <TeamAutocomplete
                className="input py-2.5"
                value={team.name}
                onChange={(value) => updateTeam(index, "name", value)}
                suggestions={suggestions}
                placeholder={`Tím ${index + 1}`}
              />
              {Array.from({ length: rounds }, (_, roundIndex) => (
                <input
                  key={roundIndex}
                  className="input py-2.5 text-center"
                  type="number"
                  step="0.01"
                  min="0"
                  value={team.scores[roundIndex] ?? 0}
                  onChange={(e) => updateTeam(index, roundIndex, e.target.value)}
                />
              ))}
              <div className="text-center">
                <span className="font-display text-2xl text-brand-orange">{getTotal(team.scores)}</span>
              </div>
              <button
                type="button"
                onClick={() => removeTeam(index)}
                className="text-brand-muted-light hover:text-red-400 transition-colors flex justify-center"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={addTeam} className="btn-outline text-sm py-2.5 px-5">
          <Plus className="w-4 h-4" /> Pridať tím
        </button>
        {loadFromRegistrations && selectedEventSlug && (
          <button type="button" onClick={loadFromRegistrations} className="btn-outline text-sm py-2.5 px-5">
            <Users className="w-4 h-4" /> Načítať z registrácií
          </button>
        )}
        <button type="button" onClick={onSubmit} disabled={submitting} className="btn-primary text-sm py-2.5 px-6 ml-auto">
          <Save className="w-4 h-4" />
          {submitting ? "Ukladám…" : "Uložiť výsledok"}
        </button>
      </div>

      {message && (
        <div
          className={`px-4 py-3 rounded-xl text-sm font-medium ${
            message.ok ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-600 border border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      {resultSummary && (
        <div className="bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-xl p-5">
          <div className="font-semibold text-green-700 dark:text-green-300 mb-3">
            Kvíz uložený! Víťaz: {resultSummary.winnerTeam}
          </div>
          <div className="space-y-1.5">
            {resultSummary.ligaPoints
              .slice()
              .sort((a, b) => b.total - a.total)
              .map((team, index) => (
                <div key={index} className="flex items-center gap-3 text-sm">
                  <span className="text-brand-muted w-5 text-right font-medium">{index + 1}.</span>
                  <span className="flex-1 font-semibold text-brand-text">{team.name}</span>
                  <span className="text-brand-muted">{team.total} bodov</span>
                  <span className="text-brand-orange font-bold">+{team.liga} lig. b.</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function parseTeamNamesInput(raw: string): string[] {
  return raw
    .split(/[\n,;]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function teamsFromNames(names: string[], rounds: number, rowCount = 10): QuizTeamRow[] {
  const rows: QuizTeamRow[] = Array.from({ length: Math.max(rowCount, names.length) }, () => ({
    name: "",
    scores: Array(rounds).fill(0),
  }));
  names.forEach((name, index) => {
    rows[index] = { name, scores: Array(rounds).fill(0) };
  });
  return rows;
}
