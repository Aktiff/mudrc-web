"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Layers, MonitorPlay, Pencil, Play, Plus } from "lucide-react";
import type { QuizEvent } from "@/lib/data";
import type { QuizLibraryItem, QuizUsage } from "@/lib/quiz-library";
import QuizResultsEntryForm, {
  parseTeamNamesInput,
  teamsFromNames,
  type QuizTeamRow,
} from "@/components/QuizResultsEntryForm";

type QuizListItem = QuizLibraryItem & {
  usageCount: number;
  usages: QuizUsage[];
  conflictingTeams: string[];
  isSafe: boolean;
};

function todaySkDate(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

export default function HotoveKvizyList() {
  const [quizzes, setQuizzes] = useState<QuizListItem[]>([]);
  const [events, setEvents] = useState<QuizEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const [teamNamesText, setTeamNamesText] = useState("");
  const [filterTeams, setFilterTeams] = useState<string[]>([]);
  const [selectedEventSlug, setSelectedEventSlug] = useState("");
  const [libraryQuizId, setLibraryQuizId] = useState("");
  const [quizDate, setQuizDate] = useState(todaySkDate);
  const [quizTeams, setQuizTeams] = useState<QuizTeamRow[]>(() => teamsFromNames([], 4));
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [resultSummary, setResultSummary] = useState<{
    winnerTeam: string;
    ligaPoints: { name: string; total: number; liga: number }[];
  } | null>(null);

  const selectedEvent = events.find((event) => event.slug === selectedEventSlug);
  const rounds = selectedEvent?.rounds || 4;

  const loadQuizzes = useCallback(async (teams: string[] = filterTeams) => {
    const qs = teams.length ? `?teams=${encodeURIComponent(teams.join("\n"))}` : "";
    const res = await fetch(`/api/admin/quiz-library${qs}&_=${Date.now()}`.replace("?&", "?"), { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setQuizzes(data.quizzes ?? []);
    }
  }, [filterTeams]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [eventsRes] = await Promise.all([
      fetch(`/api/admin/events?_=${Date.now()}`, { cache: "no-store" }),
      loadQuizzes(filterTeams),
    ]);
    if (eventsRes.ok) {
      const data = await eventsRes.json();
      setEvents(data.events ?? []);
    }
    setLoading(false);
  }, [filterTeams, loadQuizzes]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    loadQuizzes(filterTeams);
  }, [filterTeams, loadQuizzes]);

  useEffect(() => {
    setQuizTeams((teams) => {
      const names = teams.map((team) => team.name);
      return teamsFromNames(names, rounds, Math.max(10, teams.length));
    });
  }, [rounds]);

  const applyTeamsToTable = async () => {
    const names = parseTeamNamesInput(teamNamesText);
    setFilterTeams(names);
    setQuizTeams(teamsFromNames(names, rounds));
    await loadQuizzes(names);
    if (names.length && libraryQuizId) {
      const res = await fetch(`/api/admin/quiz-library?teams=${encodeURIComponent(names.join("\n"))}&_=${Date.now()}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        const quiz = (data.quizzes ?? []).find((entry: QuizListItem) => entry.id === libraryQuizId);
        if (quiz && !quiz.isSafe) {
          setMessage({ text: `Pozor: na vybranom kvíze už hrali ${quiz.conflictingTeams.join(", ")}.`, ok: false });
          return;
        }
      }
    }
    setMessage(names.length ? { text: `Načítaných ${names.length} tímov do tabuľky.`, ok: true } : null);
  };

  const loadFromRegistrations = async () => {
    if (!selectedEventSlug || !selectedEvent) return;
    const res = await fetch(
      `/api/register?slug=${selectedEventSlug}&venue=${encodeURIComponent(selectedEvent.venue)}&_=${Date.now()}`,
      { cache: "no-store" }
    );
    const data = await res.json();
    const names = (data.registrations ?? []).map((row: { teamName: string }) => row.teamName).filter(Boolean);
    if (!names.length) {
      setMessage({ text: "Žiadne registrácie pre tento podnik.", ok: false });
      return;
    }
    setTeamNamesText(names.join("\n"));
    setFilterTeams(names);
    setQuizTeams(teamsFromNames(names, rounds));
    await loadQuizzes(names);
    setMessage({ text: `Načítaných ${names.length} tímov z registrácií.`, ok: true });
  };

  const submitResult = async () => {
    const validTeams = quizTeams.filter((team) => team.name.trim());
    if (!selectedEventSlug) {
      setMessage({ text: "Vyber podnik.", ok: false });
      return;
    }
    if (!libraryQuizId) {
      setMessage({ text: "Vyber hotový kvíz.", ok: false });
      return;
    }
    if (!quizDate || validTeams.length < 2) {
      setMessage({ text: "Zadaj dátum a aspoň 2 tímy s bodmi.", ok: false });
      return;
    }

    setSubmitting(true);
    setMessage(null);
    setResultSummary(null);
    try {
      const res = await fetch(`/api/admin/events/${selectedEventSlug}/kviz`, {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: quizDate, teams: validTeams, libraryQuizId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ text: data.error ?? "Chyba pri ukladaní.", ok: false });
        return;
      }
      setResultSummary(data);
      setMessage({ text: "Výsledok uložený a priradený ku kvízu.", ok: true });
      setQuizTeams(teamsFromNames([], rounds));
      setTeamNamesText("");
      setFilterTeams([]);
      await loadQuizzes([]);
    } catch {
      setMessage({ text: "Sieťová chyba.", ok: false });
    } finally {
      setSubmitting(false);
    }
  };

  const createQuiz = async () => {
    const title = window.prompt("Názov nového kvízu:", "Nový kvíz");
    if (!title?.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/admin/quiz-library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() }),
      });
      if (res.ok) {
        const quiz = await res.json();
        window.location.href = `/admin/hotove-kvizy/${quiz.id}`;
      }
    } finally {
      setCreating(false);
    }
  };

  const safeCount = quizzes.filter((quiz) => quiz.isSafe).length;

  return (
    <div className="space-y-8">
      <QuizResultsEntryForm
        events={events}
        quizzes={quizzes}
        selectedEventSlug={selectedEventSlug}
        onEventSlugChange={setSelectedEventSlug}
        libraryQuizId={libraryQuizId}
        onLibraryQuizIdChange={setLibraryQuizId}
        teamNamesText={teamNamesText}
        onTeamNamesTextChange={setTeamNamesText}
        onApplyTeams={applyTeamsToTable}
        quizDate={quizDate}
        onQuizDateChange={setQuizDate}
        quizTeams={quizTeams}
        onQuizTeamsChange={setQuizTeams}
        onSubmit={submitResult}
        submitting={submitting}
        message={message}
        resultSummary={resultSummary}
        loadFromRegistrations={selectedEventSlug ? loadFromRegistrations : undefined}
      />

      {filterTeams.length > 0 && (
        <p className="text-sm text-brand-muted -mt-4">
          Vhodných kvízov pre zadané tímy: <strong className="text-brand-text">{safeCount}</strong> z {quizzes.length}
        </p>
      )}

      <div className="flex items-center justify-between gap-4">
        <p className="text-brand-muted text-sm">{loading ? "Načítavam…" : `${quizzes.length} kvízov v knižnici`}</p>
        <button
          type="button"
          onClick={createQuiz}
          disabled={creating}
          className="btn-primary text-sm py-2.5 px-5 inline-flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          {creating ? "Vytváram…" : "Nový kvíz"}
        </button>
      </div>

      <div className="space-y-3">
        {quizzes.map((quiz) => (
          <div
            key={quiz.id}
            className={`bg-brand-card rounded-2xl border px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-4 sm:justify-between ${
              filterTeams.length && !quiz.isSafe ? "border-amber-400/70" : "border-brand-border"
            }`}
          >
            <div className="flex items-start gap-4 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-brand-tint flex items-center justify-center shrink-0">
                <MonitorPlay className="w-5 h-5 text-brand-orange" />
              </div>
              <div className="min-w-0">
                <Link
                  href={`/admin/hotove-kvizy/${quiz.id}`}
                  className="font-semibold text-brand-text hover:text-brand-orange-readable transition-colors"
                >
                  {quiz.title}
                </Link>
                {quiz.notes && <p className="text-brand-muted text-sm mt-0.5">{quiz.notes}</p>}
                <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                  <span className="font-semibold px-2.5 py-1 rounded-full inline-flex items-center gap-1 bg-brand-surface text-brand-muted border border-brand-border">
                    <Layers className="w-3 h-3" />
                    {quiz.slides.length} {quiz.slides.length === 1 ? "slide" : quiz.slides.length < 5 ? "slidy" : "slidov"}
                  </span>
                  <span className="text-brand-muted">{quiz.usageCount === 0 ? "Ešte nepoužitý" : `${quiz.usageCount}× hraný`}</span>
                  {filterTeams.length > 0 && (
                    <span
                      className={`font-semibold px-2.5 py-1 rounded-full ${
                        quiz.isSafe
                          ? "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                      }`}
                    >
                      {quiz.isSafe ? "Vhodný" : "Konflikt tímov"}
                    </span>
                  )}
                </div>
                {quiz.conflictingTeams.length > 0 && (
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-2 inline-flex items-start gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    Už hrali: {quiz.conflictingTeams.join(", ")}
                  </p>
                )}
                {quiz.usageCount > 0 && (
                  <p className="text-xs text-brand-muted mt-1">
                    Naposledy: {quiz.usages[0]?.venue} ({quiz.usages[0]?.city}) — {quiz.usages[0]?.date}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setLibraryQuizId(quiz.id);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl border border-brand-orange/40 text-brand-orange-readable hover:bg-brand-tint transition-colors"
              >
                Použiť
              </button>
              <Link
                href={`/admin/hotove-kvizy/${quiz.id}`}
                className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl border border-brand-border text-brand-text hover:border-brand-orange hover:text-brand-orange-readable transition-colors"
              >
                <Pencil className="w-4 h-4" />
                Otvoriť
              </Link>
              <Link
                href={`/admin/hotove-kvizy/${quiz.id}/prehrat`}
                className={`inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl transition-colors ${
                  quiz.slides.length
                    ? "bg-brand-orange text-brand-btn-fg hover:opacity-90"
                    : "bg-brand-surface text-brand-muted border border-brand-border pointer-events-none opacity-60"
                }`}
              >
                <Play className="w-4 h-4" />
                Prehrať
              </Link>
            </div>
          </div>
        ))}
      </div>

      {!loading && quizzes.length === 0 && (
        <div className="bg-brand-card rounded-2xl border border-brand-border px-6 py-10 text-center text-brand-muted">
          Zatiaľ nemáš žiadne hotové kvízy. Vytvor prvý kliknutím na „Nový kvíz“.
        </div>
      )}
    </div>
  );
}
