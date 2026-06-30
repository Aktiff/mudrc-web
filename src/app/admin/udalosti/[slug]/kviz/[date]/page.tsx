"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft, Trash2, Pencil, X, Plus, Save } from "lucide-react";
import type { QuizEvent, PastResultTeam } from "@/lib/data";
import { TeamAutocomplete } from "@/components/TeamAutocomplete";
import { AdminDatePicker } from "@/components/AdminDatePicker";

type ResultDetail = {
  date: string;
  winnerTeam: string;
  points: number;
  teams: PastResultTeam[];
};

type EditRow = { name: string; scores: number[] };

export default function AdminQuizDetailPage({ params }: { params: { slug: string; date: string } }) {
  const [result, setResult] = useState<ResultDetail | null>(null);
  const [knownTeams, setKnownTeams] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rounds, setRounds] = useState(4);

  // Edit state
  const [editDate, setEditDate] = useState("");
  const [editTeams, setEditTeams] = useState<EditRow[]>([]);

  const loadData = () => {
    fetch("/api/admin/events")
      .then((r) => r.json())
      .then((data) => {
        const event: QuizEvent = data.events.find((e: QuizEvent) => e.slug === params.slug);
        if (event) {
          setKnownTeams(event.leagueTable.map((e) => e.teamName));
          setRounds(event.rounds || 4);
          const r = event.pastResults.find((r) => (r.id ?? r.date.replace(/\./g, "-")) === params.date);
          if (r && r.teams) setResult(r as ResultDetail);
        }
        setLoading(false);
      });
  };

  useEffect(() => { loadData(); }, [params.slug, params.date]);

  const startEdit = () => {
    if (!result) return;
    setEditDate(result.date);
    setEditTeams(
      [...result.teams]
        .sort((a, b) => b.total - a.total)
        .map((t) => ({ name: t.teamName, scores: t.rounds?.length ? [...t.rounds] : Array(rounds).fill(0) }))
    );
    setEditing(true);
  };

  const getTotal = (scores: number[]) => scores.reduce((a, b) => a + (Number(b) || 0), 0);

  const updateRow = (i: number, field: "name" | number, val: string | number) =>
    setEditTeams((rows) => rows.map((r, idx) => {
      if (idx !== i) return r;
      if (field === "name") return { ...r, name: val as string };
      const scores = [...r.scores];
      scores[field as number] = Number(val);
      return { ...r, scores };
    }));

  const addRow = () => setEditTeams((r) => [...r, { name: "", scores: Array(rounds).fill(0) }]);
  const removeRow = (i: number) => setEditTeams((r) => r.filter((_, idx) => idx !== i));

  const saveEdit = async () => {
    const valid = editTeams.filter((t) => t.name.trim());
    if (valid.length < 2) return;
    setSaving(true);
    const res = await fetch(`/api/admin/events/${params.slug}/kviz/${params.date}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: editDate, teams: valid }),
    });
    if (res.ok) {
      setEditing(false);
      setLoading(true);
      loadData();
    }
    setSaving(false);
  };

  const deleteQuiz = async () => {
    if (!confirm("Naozaj zmazať tento kvíz? Odstránia sa aj ligové body.")) return;
    setDeleting(true);
    await fetch(`/api/admin/events/${params.slug}/kviz/${params.date}`, { method: "DELETE" });
    window.location.href = `/admin/udalosti/${params.slug}`;
  };

  if (loading) return <div className="p-8 text-brand-muted">Načítavam...</div>;

  if (!result) return (
    <div className="p-8">
      <Link href={`/admin/udalosti/${params.slug}`} className="text-brand-orange hover:underline text-sm">Späť</Link>
      <p className="mt-4 text-brand-muted">Kvíz nebol nájdený alebo nemá detailné dáta.</p>
    </div>
  );

  const sorted = [...result.teams].sort((a, b) => b.total - a.total);
  const backUrl = `/admin/udalosti/${params.slug}`;
  const fmtNum = (v: number) => v % 1 === 0 ? v : Number(v.toFixed(2));

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href={backUrl} className="text-brand-muted hover:text-brand-text transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <p className="text-xs text-brand-muted font-medium uppercase tracking-wider mb-0.5">Kvíz</p>
            <h1 className="font-display text-3xl text-brand-text tracking-wide">{result.date}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/udalosti/${params.slug}/kviz/${params.date}/prezentacia`}
            className="text-sm font-semibold bg-yellow-400 hover:bg-yellow-300 text-black px-4 py-2 rounded-xl transition-colors"
          >
            Prezentácia
          </Link>
          {!editing && (
            <button
              onClick={startEdit}
              className="btn-outline text-sm py-2 px-3"
            >
              <Pencil className="w-4 h-4" /> Upraviť
            </button>
          )}
          <button
            onClick={deleteQuiz}
            disabled={deleting}
            className="flex items-center gap-1.5 text-sm text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 px-3 py-2 rounded-xl border border-red-200 dark:border-red-900 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            {deleting ? "Mažem..." : "Zmazať"}
          </button>
        </div>
      </div>

      {/* Edit form */}
      {editing && (
        <div className="bg-brand-card rounded-2xl border border-brand-orange/30 p-6 mb-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-brand-text">Upraviť kvíz</h2>
            <button onClick={() => setEditing(false)} className="text-brand-muted hover:text-brand-text">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="mb-4">
            <label className="label">Dátum</label>
            <div className="max-w-xs"><AdminDatePicker value={editDate} onChange={setEditDate} /></div>
          </div>
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-brand-muted uppercase tracking-wider border-b border-brand-border">
                  <th className="text-left pb-2 pr-3 font-medium">Tím</th>
                  {Array.from({ length: rounds }, (_, i) => (
                    <th key={i} className="text-center pb-2 px-2 font-medium w-16">K{i + 1}</th>
                  ))}
                  <th className="text-center pb-2 px-2 font-medium w-20 text-brand-orange">Celkovo</th>
                  <th className="w-6" />
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border">
                {editTeams.map((team, i) => (
                  <tr key={i}>
                    <td className="py-2 pr-3">
                      <TeamAutocomplete
                        className="input text-sm py-1.5"
                        value={team.name}
                        onChange={(v) => updateRow(i, "name", v)}
                        suggestions={knownTeams}
                        placeholder={`Tim ${i + 1}`}
                      />
                    </td>
                    {Array.from({ length: rounds }, (_, k) => (
                      <td key={k} className="py-2 px-2">
                        <input
                          className="input text-sm py-1.5 text-center w-16"
                          type="number" step="0.01" min="0"
                          value={team.scores[k] ?? 0}
                          onChange={(e) => updateRow(i, k, e.target.value)}
                        />
                      </td>
                    ))}
                    <td className="py-2 px-2 text-center">
                      <span className="font-display text-xl text-brand-orange">{getTotal(team.scores)}</span>
                    </td>
                    <td className="py-2 pl-1">
                      <button onClick={() => removeRow(i)} className="text-brand-muted-light hover:text-red-400 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2">
            <button onClick={addRow} className="btn-outline text-sm py-2 px-4">
              <Plus className="w-4 h-4" /> Tím
            </button>
            <button onClick={saveEdit} disabled={saving} className="btn-primary text-sm py-2 px-5">
              <Save className="w-4 h-4" />
              {saving ? "Ukladám..." : "Uložiť zmeny"}
            </button>
          </div>
        </div>
      )}

      {/* Result detail */}
      <div className="bg-brand-card rounded-2xl border border-brand-border overflow-hidden">
        <div className="px-6 py-4 border-b border-brand-border bg-brand-surface">
          <p className="text-sm text-brand-muted">
            Víťaz: <span className="font-semibold text-brand-orange">{result.winnerTeam}</span>
            {" · "}{result.teams.length} tímov
          </p>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-brand-border">
              <th className="text-left px-6 py-3 text-xs text-brand-muted uppercase tracking-wider font-medium w-10">#</th>
              <th className="text-left px-2 py-3 text-xs text-brand-muted uppercase tracking-wider font-medium">Tím</th>
              <th className="text-right px-6 py-3 text-xs text-brand-muted uppercase tracking-wider font-medium">Body</th>
              <th className="text-right px-6 py-3 text-xs text-brand-orange uppercase tracking-wider font-semibold">Liga +</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-border">
            {sorted.map((team, i) => (
              <tr key={i} className={`${i === 0 ? "bg-brand-tint/30" : "hover:bg-brand-hover/50"}`}>
                <td className="px-6 py-3.5">
                  <span className={`text-sm font-medium ${i === 0 ? "text-brand-orange font-bold" : "text-brand-muted"}`}>{i + 1}</span>
                </td>
                <td className="px-2 py-3.5">
                  <span className={`font-semibold text-sm ${i === 0 ? "text-brand-orange" : "text-brand-text"}`}>{team.teamName}</span>
                </td>
                <td className="px-6 py-3.5 text-right">
                  <span className={`font-display text-xl ${i === 0 ? "text-brand-orange" : "text-brand-text"}`}>{fmtNum(team.total)}</span>
                </td>
                <td className="px-6 py-3.5 text-right">
                  <span className={`text-sm font-bold ${team.ligaPoints > 0 ? "text-brand-orange" : "text-brand-muted-light"}`}>
                    +{fmtNum(team.ligaPoints)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
