"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BookOpen, Layers, MonitorPlay, Pencil, Play, Plus, Trash2 } from "lucide-react";
import type { QuizLibraryItem, QuizUsage } from "@/lib/quiz-library";
import { clearQuizDraft } from "@/lib/quiz-editor-draft";

type QuizListItem = QuizLibraryItem & {
  usageCount: number;
  usages: QuizUsage[];
  conflictingTeams: string[];
  isSafe: boolean;
};

export default function HotoveKvizyList() {
  const [quizzes, setQuizzes] = useState<QuizListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [actionQuizId, setActionQuizId] = useState<string | null>(null);
  const [listMessage, setListMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadQuizzes = useCallback(async () => {
    const res = await fetch(`/api/admin/quiz-library?_=${Date.now()}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(typeof data.error === "string" ? data.error : "Kvízy sa nepodarilo načítať.");
    }
    setQuizzes(data.quizzes ?? []);
    setLoadError(null);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    let lastError = "Kvízy sa nepodarilo načítať.";
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await loadQuizzes();
        setLoading(false);
        return;
      } catch (error) {
        lastError = error instanceof Error ? error.message : lastError;
        if (attempt < 1) await new Promise((resolve) => setTimeout(resolve, 400));
      }
    }
    setLoadError(lastError);
    setLoading(false);
  }, [loadQuizzes]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const createQuiz = async () => {
    const title = window.prompt("Názov nového kvízu:", "Nový kvíz");
    if (!title?.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/admin/quiz-library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCreateError(data.error ?? "Nepodarilo sa vytvoriť kvíz.");
        return;
      }
      window.location.href = `/admin/hotove-kvizy/${data.id}`;
    } catch {
      setCreateError("Sieťová chyba pri vytváraní kvízu.");
    } finally {
      setCreating(false);
    }
  };

  const renameQuiz = async (quiz: QuizListItem) => {
    const newTitle = window.prompt("Nový názov kvízu:", quiz.title);
    if (!newTitle?.trim() || newTitle.trim() === quiz.title) return;

    setActionQuizId(quiz.id);
    setListMessage(null);
    try {
      const res = await fetch(`/api/admin/quiz-library/${quiz.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setListMessage({ text: data.error ?? "Premenovanie zlyhalo.", ok: false });
        return;
      }
      setListMessage({ text: `Kvíz premenovaný na „${newTitle.trim()}“.`, ok: true });
      await loadQuizzes();
    } catch {
      setListMessage({ text: "Sieťová chyba pri premenovaní.", ok: false });
    } finally {
      setActionQuizId(null);
    }
  };

  const deleteQuiz = async (quiz: QuizListItem) => {
    if (!window.confirm(`Vymazať kvíz „${quiz.title}"?`)) return;
    if (!window.confirm("Naozaj natrvalo? Túto akciu nie je možné vrátiť.")) return;

    setActionQuizId(quiz.id);
    setListMessage(null);
    try {
      const res = await fetch(`/api/admin/quiz-library/${quiz.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setListMessage({ text: data.error ?? "Vymazanie zlyhalo.", ok: false });
        return;
      }
      clearQuizDraft(quiz.id);
      const releasedCount = Array.isArray(data.releasedBankQuestionIds) ? data.releasedBankQuestionIds.length : 0;
      setListMessage({
        text:
          releasedCount > 0
            ? `Kvíz „${quiz.title}" bol vymazaný. ${releasedCount} otázok z banky je opäť k dispozícii.`
            : `Kvíz „${quiz.title}" bol vymazaný.`,
        ok: true,
      });
      await loadQuizzes();
    } catch {
      setListMessage({ text: "Sieťová chyba pri mazaní.", ok: false });
    } finally {
      setActionQuizId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-brand-muted text-sm">{loading ? "Načítavam…" : `${quizzes.length} kvízov v knižnici`}</p>
          {createError && <p className="text-sm text-red-500 mt-1">{createError}</p>}
          {listMessage && (
            <p className={`text-sm mt-1 ${listMessage.ok ? "text-green-600" : "text-red-500"}`}>{listMessage.text}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/hotove-kvizy/banka"
            className="btn-outline text-sm py-2.5 px-5 inline-flex items-center gap-2"
          >
            <BookOpen className="w-4 h-4" />
            Banka otázok
          </Link>
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
      </div>

      <div className="space-y-3">
        {quizzes.map((quiz) => (
          <div
            key={quiz.id}
            className="bg-brand-card rounded-2xl border border-brand-border px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-4 sm:justify-between"
          >
            <div className="flex items-start gap-4 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-brand-tint flex items-center justify-center shrink-0">
                <MonitorPlay className="w-5 h-5 text-brand-orange" />
              </div>
              <div className="min-w-0">
                <a
                  href={`/admin/hotove-kvizy/${quiz.id}`}
                  className="font-semibold text-brand-text hover:text-brand-orange-readable transition-colors"
                >
                  {quiz.title}
                </a>
                {quiz.notes && <p className="text-brand-muted text-sm mt-0.5">{quiz.notes}</p>}
                <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                  <span className="font-semibold px-2.5 py-1 rounded-full inline-flex items-center gap-1 bg-brand-surface text-brand-muted border border-brand-border">
                    <Layers className="w-3 h-3" />
                    {quiz.questions?.length ?? 0}{" "}
                    {(quiz.questions?.length ?? 0) === 1
                      ? "otázka"
                      : (quiz.questions?.length ?? 0) < 5
                        ? "otázky"
                        : "otázok"}
                  </span>
                  <span className="text-brand-muted">
                    {quiz.usageCount === 0 ? "Ešte nepoužitý" : `${quiz.usageCount}× hraný`}
                  </span>
                </div>
                {quiz.usageCount > 0 && (
                  <p className="text-xs text-brand-muted mt-1">
                    Naposledy: {quiz.usages[0]?.venue} ({quiz.usages[0]?.city}) — {quiz.usages[0]?.date}
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <a
                href={`/admin/hotove-kvizy/${quiz.id}`}
                className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl border border-brand-border text-brand-text hover:border-brand-orange hover:text-brand-orange-readable transition-colors"
              >
                <Pencil className="w-4 h-4" />
                Otvoriť
              </a>
              <a
                href={`/admin/hotove-kvizy/${quiz.id}/prehrat`}
                className={`inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl transition-colors ${
                  quiz.questions?.length
                    ? "bg-brand-orange text-brand-btn-fg hover:opacity-90"
                    : "bg-brand-surface text-brand-muted border border-brand-border pointer-events-none opacity-60"
                }`}
              >
                <Play className="w-4 h-4" />
                Prehrať
              </a>
              <button
                type="button"
                onClick={() => renameQuiz(quiz)}
                disabled={actionQuizId === quiz.id}
                className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl border border-brand-border text-brand-text hover:border-brand-orange hover:text-brand-orange-readable transition-colors disabled:opacity-50"
              >
                Premenovať
              </button>
              <button
                type="button"
                onClick={() => deleteQuiz(quiz)}
                disabled={actionQuizId === quiz.id}
                className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                Vymazať
              </button>
            </div>
          </div>
        ))}
      </div>

      {!loading && loadError && quizzes.length === 0 && (
        <div className="bg-brand-card rounded-2xl border border-brand-border px-6 py-10 text-center space-y-3">
          <p className="text-red-500 text-sm">{loadError}</p>
          <button type="button" onClick={() => void loadAll()} className="btn-primary text-sm py-2.5 px-5">
            Načítať znova
          </button>
        </div>
      )}

      {!loading && !loadError && quizzes.length === 0 && (
        <div className="bg-brand-card rounded-2xl border border-brand-border px-6 py-10 text-center text-brand-muted">
          Zatiaľ nemáš žiadne kvízy. Vytvor prvý kliknutím na „Nový kvíz“.
        </div>
      )}
    </div>
  );
}
