"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { AdminDatePicker } from "@/components/AdminDatePicker";
import { formatEuroAmount, formatSkPlayerCountTotal } from "@/lib/registration-utils";
import type { QuizStatRow, QuizStatTeam, QuizStatVenue } from "@/lib/quiz-stats";

type EditState = {
  slug: string;
  quizKey: string;
  date: string;
  targetSlug: string;
  playerCount: string;
  teams: QuizStatTeam[];
};

export default function StatistikyBoard({
  initialRows,
  venues,
}: {
  initialRows: QuizStatRow[];
  venues: QuizStatVenue[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);
  const [venueFilter, setVenueFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [editing, setEditing] = useState<EditState | null>(null);
  const [busyKey, setBusyKey] = useState("");
  const [error, setError] = useState("");

  const cities = useMemo(
    () => Array.from(new Set(rows.map((row) => row.city).filter(Boolean))).sort((a, b) => a.localeCompare(b, "sk")),
    [rows]
  );
  const venueNames = useMemo(
    () => Array.from(new Set(rows.map((row) => row.venue).filter(Boolean))).sort((a, b) => a.localeCompare(b, "sk")),
    [rows]
  );

  const visible = rows.filter((row) => {
    if (venueFilter && row.venue !== venueFilter) return false;
    if (cityFilter && row.city !== cityFilter) return false;
    return true;
  });

  const totals = visible.reduce(
    (sum, row) => {
      sum.players += row.players;
      sum.earned += row.earned;
      return sum;
    },
    { players: 0, earned: 0 }
  );

  const applyData = (data: { rows?: QuizStatRow[] }) => {
    if (Array.isArray(data.rows)) setRows(data.rows);
    router.refresh();
  };

  const startEdit = (row: QuizStatRow) => {
    setError("");
    setEditing({
      slug: row.slug,
      quizKey: row.key,
      date: row.date,
      targetSlug: row.slug,
      playerCount: String(row.players),
      teams: row.teams.map((team) => ({ ...team })),
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    setBusyKey(`${editing.slug}:${editing.quizKey}`);
    setError("");
    const teamPlayers = editing.teams.reduce((sum, team) => sum + (Number(team.players) || 0), 0);
    const res = await fetch("/api/admin/statistiky", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: editing.slug,
        quizKey: editing.quizKey,
        date: editing.date,
        targetSlug: editing.targetSlug,
        playerCount: editing.teams.length ? teamPlayers : Number(editing.playerCount) || 0,
        teams: editing.teams,
      }),
    });
    const data = await res.json();
    setBusyKey("");
    if (!res.ok) {
      setError(data.error ?? "Kvíz sa nepodarilo uložiť.");
      return;
    }
    setEditing(null);
    applyData(data);
  };

  const deleteRow = async (row: QuizStatRow) => {
    if (!confirm(`Zmazať kvíz ${row.date} v ${row.venue}? Zmizne zo štatistiky aj z výsledkov tohto podniku.`)) return;
    setBusyKey(`${row.slug}:${row.key}`);
    setError("");
    const res = await fetch("/api/admin/statistiky", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: row.slug, quizKey: row.key }),
    });
    const data = await res.json();
    setBusyKey("");
    if (!res.ok) {
      setError(data.error ?? "Kvíz sa nepodarilo zmazať.");
      return;
    }
    if (editing?.slug === row.slug && editing.quizKey === row.key) setEditing(null);
    applyData(data);
  };

  const editVenue = venues.find((venue) => venue.slug === editing?.targetSlug);
  const editPlayers = editing
    ? editing.teams.length
      ? editing.teams.reduce((sum, team) => sum + (Number(team.players) || 0), 0)
      : Number(editing.playerCount) || 0
    : 0;
  const editEarned = editVenue ? Math.round((Number(editVenue.entryFee) || 0) * editPlayers * 100) / 100 : 0;

  return (
    <div className="w-full min-w-0">
      <h1 className="font-display text-4xl text-brand-text tracking-wide mb-1">Štatistiky</h1>
      <p className="text-brand-muted text-sm mb-6">
        Odohrané kvízy, počet hráčov a príjem zo vstupného. Pri starších kvízoch je počet hráčov odhad, kým ho neuložíš.
      </p>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <label className="block sm:w-64">
          <span className="label">Podnik</span>
          <select className="input" value={venueFilter} onChange={(e) => setVenueFilter(e.target.value)}>
            <option value="">Všetky podniky</option>
            {venueNames.map((venue) => (
              <option key={venue} value={venue}>
                {venue}
              </option>
            ))}
          </select>
        </label>
        <label className="block sm:w-64">
          <span className="label">Mesto</span>
          <select className="input" value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}>
            <option value="">Všetky mestá</option>
            {cities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="bg-brand-card rounded-2xl border border-brand-border px-5 py-4 mb-4 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span className="text-brand-muted">{visible.length} {visible.length === 1 ? "kvíz" : "kvízov"}</span>
        <span className="text-brand-muted">{formatSkPlayerCountTotal(totals.players)}</span>
        <span className="font-semibold text-brand-text">{formatEuroAmount(totals.earned)}</span>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl text-sm font-medium bg-red-50 text-red-600 border border-red-200">
          {error}
        </div>
      )}

      <div className="bg-brand-card rounded-2xl border border-brand-border overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-brand-border text-left text-xs uppercase tracking-wider text-brand-muted">
              <th className="px-5 py-3 font-medium">Dátum</th>
              <th className="px-3 py-3 font-medium">Podnik</th>
              <th className="px-3 py-3 font-medium">Mesto</th>
              <th className="px-3 py-3 font-medium">Hráči</th>
              <th className="px-3 py-3 font-medium">Zarobené</th>
              <th className="px-5 py-3 font-medium text-right"> </th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-brand-muted">
                  Žiadne kvízy pre tento filter.
                </td>
              </tr>
            )}
            {visible.map((row) => {
              const rowKey = `${row.slug}:${row.key}`;
              const isEditing = editing?.slug === row.slug && editing.quizKey === row.key;
              return (
                <tr key={rowKey} className="border-b border-brand-border last:border-b-0 align-top">
                  <td className="px-5 py-4 whitespace-nowrap" colSpan={isEditing ? 6 : 1}>
                    {isEditing && editing ? (
                      <div className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-3">
                          <label className="block">
                            <span className="label">Dátum</span>
                            <AdminDatePicker value={editing.date} onChange={(date) => setEditing({ ...editing, date })} />
                          </label>
                          <label className="block sm:col-span-2">
                            <span className="label">Podnik</span>
                            <select
                              className="input"
                              value={editing.targetSlug}
                              onChange={(e) => setEditing({ ...editing, targetSlug: e.target.value })}
                            >
                              {venues.map((venue) => (
                                <option key={venue.slug} value={venue.slug}>
                                  {venue.venue} · {venue.city}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                        {editing.teams.length > 0 ? (
                          <div className="max-w-md space-y-1.5">
                            <div className="label">Hráči v tímoch</div>
                            {editing.teams.map((team, index) => (
                              <label
                                key={`${team.teamName}-${index}`}
                                className="group grid grid-cols-[1fr_5.5rem] items-center gap-3 rounded-xl border border-transparent bg-brand-surface px-3 py-1.5 transition-colors hover:border-brand-border focus-within:border-brand-orange focus-within:bg-brand-orange focus-within:shadow-sm"
                              >
                                <span className="truncate font-medium text-brand-muted group-focus-within:font-bold group-focus-within:text-brand-btn-fg">
                                  {team.teamName}
                                </span>
                                <input
                                  className="input py-2 text-center text-lg font-semibold group-focus-within:border-brand-orange group-focus-within:bg-brand-card"
                                  type="number"
                                  min="0"
                                  max="99"
                                  value={team.players || ""}
                                  aria-label={`Počet hráčov, ${team.teamName}`}
                                  onChange={(e) => {
                                    const players = Number(e.target.value) || 0;
                                    setEditing({
                                      ...editing,
                                      teams: editing.teams.map((item, itemIndex) =>
                                        itemIndex === index ? { ...item, players } : item
                                      ),
                                    });
                                  }}
                                />
                              </label>
                            ))}
                          </div>
                        ) : (
                          <label className="block max-w-xs">
                            <span className="label">Počet hráčov</span>
                            <input
                              className="input"
                              type="number"
                              min="0"
                              max="500"
                              value={editing.playerCount}
                              onChange={(e) => setEditing({ ...editing, playerCount: e.target.value })}
                            />
                          </label>
                        )}
                        <div className="text-sm text-brand-muted">
                          {formatSkPlayerCountTotal(editPlayers)} · vstupné {formatEuroAmount(editVenue?.entryFee ?? 0)} ·{" "}
                          <span className="font-semibold text-brand-text">{formatEuroAmount(editEarned)}</span>
                        </div>
                        <div className="flex gap-2">
                          <button type="button" onClick={saveEdit} disabled={busyKey === rowKey} className="btn-primary text-sm py-2 px-5">
                            {busyKey === rowKey ? "Ukladám…" : "Uložiť"}
                          </button>
                          <button type="button" onClick={() => setEditing(null)} className="btn-outline text-sm py-2 px-5">
                            Zrušiť
                          </button>
                        </div>
                      </div>
                    ) : (
                      row.date
                    )}
                  </td>
                  {!isEditing && (
                    <>
                      <td className="px-3 py-4 font-semibold text-brand-text">{row.venue}</td>
                      <td className="px-3 py-4 text-brand-muted">{row.city}</td>
                      <td className="px-3 py-4">
                        {formatSkPlayerCountTotal(row.players)}
                        {row.estimated && <span className="ml-2 text-xs text-amber-700">odhad</span>}
                      </td>
                      <td className="px-3 py-4 font-semibold text-brand-text">{formatEuroAmount(row.earned)}</td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button type="button" onClick={() => startEdit(row)} className="btn-outline text-sm py-2 px-3">
                            <Pencil className="w-4 h-4" /> Upraviť
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteRow(row)}
                            disabled={busyKey === rowKey}
                            className="btn-outline text-sm py-2 px-3 text-red-500"
                          >
                            <Trash2 className="w-4 h-4" /> {busyKey === rowKey ? "Mažem…" : "Vymazať"}
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
