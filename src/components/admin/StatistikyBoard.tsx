"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { AdminDatePicker } from "@/components/AdminDatePicker";
import QuizTypeField from "@/components/admin/QuizTypeField";
import { parseSkEventDateTime } from "@/lib/data";
import { formatEuroAmount, formatSkPlayerCountTotal } from "@/lib/registration-utils";
import { quizTypeOrDefault, rememberQuizTypes } from "@/lib/quiz-type";
import type { QuizStatRow, QuizStatTeam, QuizStatVenue, TeamQuizAppearance } from "@/lib/quiz-stats";

type DatePeriod = "all" | "today" | "thisWeek" | "lastWeek" | "thisMonth" | "lastMonth" | "thisYear";

const DATE_PERIODS: { id: DatePeriod; label: string }[] = [
  { id: "all", label: "Všetko" },
  { id: "today", label: "Dnes" },
  { id: "thisWeek", label: "Tento týždeň" },
  { id: "lastWeek", label: "Posledný týždeň" },
  { id: "thisMonth", label: "Tento mesiac" },
  { id: "lastMonth", label: "Posledný mesiac" },
  { id: "thisYear", label: "Tento rok" },
];

function formatSkDate(date: Date): string {
  return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}.${date.getFullYear()}`;
}

function periodRange(period: DatePeriod, now = new Date()): { from: string; to: string } {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === "all") return { from: "", to: "" };
  if (period === "today") return { from: formatSkDate(today), to: formatSkDate(today) };
  if (period === "thisWeek" || period === "lastWeek") {
    const mondayOffset = (today.getDay() + 6) % 7;
    const monday = new Date(today);
    monday.setDate(today.getDate() - mondayOffset);
    if (period === "thisWeek") return { from: formatSkDate(monday), to: formatSkDate(today) };
    const from = new Date(monday);
    from.setDate(monday.getDate() - 7);
    const to = new Date(monday);
    to.setDate(monday.getDate() - 1);
    return { from: formatSkDate(from), to: formatSkDate(to) };
  }
  if (period === "thisMonth") {
    return { from: formatSkDate(new Date(today.getFullYear(), today.getMonth(), 1)), to: formatSkDate(today) };
  }
  if (period === "lastMonth") {
    const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const to = new Date(today.getFullYear(), today.getMonth(), 0);
    return { from: formatSkDate(from), to: formatSkDate(to) };
  }
  return { from: formatSkDate(new Date(today.getFullYear(), 0, 1)), to: formatSkDate(today) };
}

function dateInRange(value: string, from: string, to: string): boolean {
  if (!from && !to) return true;
  const current = parseSkEventDateTime(value);
  if (!current) return false;
  const start = from ? parseSkEventDateTime(from) : null;
  const end = to ? parseSkEventDateTime(to) : null;
  if (start && current.getTime() < start.getTime()) return false;
  if (end) {
    const endOfDay = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999);
    if (current.getTime() > endOfDay.getTime()) return false;
  }
  return true;
}

function skCount(count: number, one: string, few: string, many: string) {
  if (count === 1) return `1 ${one}`;
  if (count >= 2 && count <= 4) return `${count} ${few}`;
  return `${count} ${many}`;
}

type EditState = {
  slug: string;
  quizKey: string;
  date: string;
  targetSlug: string;
  playerCount: string;
  quizType: string;
  teams: QuizStatTeam[];
};

export default function StatistikyBoard({
  initialRows,
  venues,
  initialTeams,
}: {
  initialRows: QuizStatRow[];
  venues: QuizStatVenue[];
  initialTeams: TeamQuizAppearance[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [teamRows, setTeamRows] = useState(initialTeams);
  const [view, setView] = useState<"kvizy" | "timy">("kvizy");
  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);
  useEffect(() => {
    setTeamRows(initialTeams);
  }, [initialTeams]);
  const [venueFilter, setVenueFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [editing, setEditing] = useState<EditState | null>(null);
  const [busyKey, setBusyKey] = useState("");
  const [error, setError] = useState("");

  const cities = useMemo(
    () => Array.from(new Set(rows.map((row) => row.city).filter(Boolean))).sort((a, b) => a.localeCompare(b, "sk")),
    [rows]
  );
  const venueNames = useMemo(() => {
    const source = cityFilter ? rows.filter((row) => row.city === cityFilter) : rows;
    return Array.from(new Set(source.map((row) => row.venue).filter(Boolean))).sort((a, b) => a.localeCompare(b, "sk"));
  }, [rows, cityFilter]);

  const visible = rows.filter((row) => {
    if (cityFilter && row.city !== cityFilter) return false;
    if (venueFilter && row.venue !== venueFilter) return false;
    if (!dateInRange(row.date, dateFrom, dateTo)) return false;
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

  const teamNames = useMemo(() => {
    const names = new Map<string, string>();
    for (const row of teamRows) {
      if (cityFilter && row.city !== cityFilter) continue;
      if (venueFilter && row.venue !== venueFilter) continue;
      if (!dateInRange(row.date, dateFrom, dateTo)) continue;
      const key = row.teamName.toLocaleLowerCase("sk");
      if (!names.has(key)) names.set(key, row.teamName);
    }
    return Array.from(names.values()).sort((a, b) => a.localeCompare(b, "sk"));
  }, [teamRows, cityFilter, venueFilter, dateFrom, dateTo]);

  const visibleTeams = teamRows.filter((row) => {
    if (cityFilter && row.city !== cityFilter) return false;
    if (venueFilter && row.venue !== venueFilter) return false;
    if (teamFilter && row.teamName.toLocaleLowerCase("sk") !== teamFilter) return false;
    if (!dateInRange(row.date, dateFrom, dateTo)) return false;
    return true;
  });

  const activePeriod = DATE_PERIODS.find((period) => {
    const range = periodRange(period.id);
    return range.from === dateFrom && range.to === dateTo;
  })?.id;

  const chooseCity = (city: string) => {
    setCityFilter(city);
    if (city && venueFilter && !rows.some((row) => row.city === city && row.venue === venueFilter)) {
      setVenueFilter("");
    }
    setTeamFilter("");
  };

  const chooseVenue = (venue: string) => {
    setVenueFilter(venue);
    setTeamFilter("");
  };

  const choosePeriod = (period: DatePeriod) => {
    const range = periodRange(period);
    setDateFrom(range.from);
    setDateTo(range.to);
  };

  const filtersActive = Boolean(cityFilter || venueFilter || teamFilter || dateFrom || dateTo);
  const resetFilters = () => {
    setCityFilter("");
    setVenueFilter("");
    setTeamFilter("");
    setDateFrom("");
    setDateTo("");
  };

  const teamGroups = useMemo(() => {
    const groups: { teamName: string; rows: TeamQuizAppearance[] }[] = [];
    for (const row of visibleTeams) {
      const key = row.teamName.toLocaleLowerCase("sk");
      const last = groups[groups.length - 1];
      if (last && last.teamName.toLocaleLowerCase("sk") === key) last.rows.push(row);
      else groups.push({ teamName: row.teamName, rows: [row] });
    }
    return groups;
  }, [visibleTeams]);

  const applyData = (data: { rows?: QuizStatRow[]; teams?: TeamQuizAppearance[] }) => {
    if (Array.isArray(data.rows)) setRows(data.rows);
    if (Array.isArray(data.teams)) setTeamRows(data.teams);
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
      quizType: row.quizType,
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
        quizType: quizTypeOrDefault(editing.quizType),
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
        {view === "kvizy"
          ? "Odohrané kvízy, počet hráčov a príjem zo vstupného. Pri starších kvízoch je počet hráčov odhad, kým ho neuložíš."
          : "História tímov na kvízoch. Pri starších kvízoch je počet hráčov v tíme odhad, kým ho neuložíš pri kvíze."}
      </p>

      <div className="inline-flex rounded-full border border-brand-border bg-brand-card p-1 mb-6">
        <button
          type="button"
          onClick={() => setView("kvizy")}
          className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors ${
            view === "kvizy" ? "bg-brand-orange text-brand-btn-fg" : "text-brand-muted hover:text-brand-text"
          }`}
        >
          Kvízy
        </button>
        <button
          type="button"
          onClick={() => setView("timy")}
          className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors ${
            view === "timy" ? "bg-brand-orange text-brand-btn-fg" : "text-brand-muted hover:text-brand-text"
          }`}
        >
          Tímy
        </button>
      </div>

      <div className="flex flex-col gap-3 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <label className="block sm:w-64">
            <span className="label">Mesto</span>
            <select className="input" value={cityFilter} onChange={(e) => chooseCity(e.target.value)}>
              <option value="">Všetky mestá</option>
              {cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </label>
          <label className="block sm:w-64">
            <span className="label">Podnik</span>
            <select className="input" value={venueFilter} onChange={(e) => chooseVenue(e.target.value)}>
              <option value="">Všetky podniky</option>
              {venueNames.map((venue) => (
                <option key={venue} value={venue}>
                  {venue}
                </option>
              ))}
            </select>
          </label>
          {view === "timy" && (
            <label className="block sm:w-64">
              <span className="label">Tím</span>
              <select className="input" value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}>
                <option value="">Všetky tímy</option>
                {teamNames.map((name) => (
                  <option key={name.toLocaleLowerCase("sk")} value={name.toLocaleLowerCase("sk")}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {DATE_PERIODS.map((period) => (
            <button
              key={period.id}
              type="button"
              onClick={() => choosePeriod(period.id)}
              className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
                activePeriod === period.id
                  ? "bg-brand-orange text-brand-btn-fg border-brand-orange"
                  : "bg-brand-card text-brand-muted border-brand-border hover:text-brand-text"
              }`}
            >
              {period.label}
            </button>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <label className="block sm:w-52">
            <span className="label">Od</span>
            <AdminDatePicker
              value={dateFrom}
              placeholder="Od"
              onChange={(value) => {
                setDateFrom(value);
              }}
            />
          </label>
          <label className="block sm:w-52">
            <span className="label">Do</span>
            <AdminDatePicker
              value={dateTo}
              placeholder="Do"
              onChange={(value) => {
                setDateTo(value);
              }}
            />
          </label>
          <div className="flex items-end">
            <button type="button" onClick={resetFilters} disabled={!filtersActive} className="btn-outline text-sm py-2 px-4 disabled:opacity-40">
              Zrušiť filter
            </button>
          </div>
        </div>
      </div>

      {view === "kvizy" && (
      <>
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
              <th className="px-3 py-3 font-medium">Typ kvízu</th>
              <th className="px-3 py-3 font-medium">Hráči</th>
              <th className="px-3 py-3 font-medium">Zarobené</th>
              <th className="px-5 py-3 font-medium text-right"> </th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-brand-muted">
                  Žiadne kvízy pre tento filter.
                </td>
              </tr>
            )}
            {visible.map((row) => {
              const rowKey = `${row.slug}:${row.key}`;
              const isEditing = editing?.slug === row.slug && editing.quizKey === row.key;
              return (
                <tr key={rowKey} className="border-b border-brand-border last:border-b-0 align-top">
                  <td className="px-5 py-4 whitespace-nowrap" colSpan={isEditing ? 7 : 1}>
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
                        <label className="block max-w-md">
                          <span className="label">Typ kvízu</span>
                          <QuizTypeField
                            id={`stat-quiz-type-${row.slug}-${row.key}`}
                            value={editing.quizType}
                            knownTypes={rememberQuizTypes(rows.map((item) => item.quizType))}
                            onChange={(quizType) => setEditing({ ...editing, quizType })}
                          />
                        </label>
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
                      <td className="px-3 py-4">{row.quizType}</td>
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
      </>
      )}

      {view === "timy" && (
        <div className="space-y-4">
          <div className="bg-brand-card rounded-2xl border border-brand-border px-5 py-4 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <span className="text-brand-muted">{skCount(teamGroups.length, "tím", "tímy", "tímov")}</span>
            <span className="text-brand-muted">{skCount(visibleTeams.length, "štart", "štarty", "štartov")}</span>
          </div>
          {teamGroups.length === 0 && (
            <div className="bg-brand-card rounded-2xl border border-brand-border px-5 py-8 text-center text-brand-muted text-sm">
              Žiadne tímy pre tento filter. História sa berie z kvízov, pri ktorých sú zapísané tímy.
            </div>
          )}
          {teamGroups.map((group) => (
            <section key={group.teamName.toLocaleLowerCase("sk")} className="bg-brand-card rounded-2xl border border-brand-border overflow-x-auto">
              <div className="px-5 py-4 border-b border-brand-border">
                <h2 className="font-display text-2xl text-brand-text tracking-wide">{group.teamName}</h2>
                <p className="text-brand-muted text-sm mt-0.5">
                  {skCount(group.rows.length, "kvíz", "kvízy", "kvízov")}
                </p>
              </div>
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-brand-border text-left text-xs uppercase tracking-wider text-brand-muted">
                    <th className="px-5 py-3 font-medium">Dátum</th>
                    <th className="px-3 py-3 font-medium">Podnik</th>
                    <th className="px-3 py-3 font-medium">Mesto</th>
                    <th className="px-3 py-3 font-medium">Typ kvízu</th>
                    <th className="px-3 py-3 font-medium">Hráči v tíme</th>
                    <th className="px-3 py-3 font-medium">Umiestnenie</th>
                    <th className="px-5 py-3 font-medium">Tímov na kvíze</th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((row) => (
                    <tr key={row.id} className="border-b border-brand-border last:border-b-0">
                      <td className="px-5 py-4 whitespace-nowrap">{row.date}</td>
                      <td className="px-3 py-4 font-semibold text-brand-text">{row.venue}</td>
                      <td className="px-3 py-4 text-brand-muted">{row.city}</td>
                      <td className="px-3 py-4">{row.quizType}</td>
                      <td className="px-3 py-4">
                        {formatSkPlayerCountTotal(row.players)}
                        {row.playersEstimated && <span className="ml-2 text-xs text-amber-700">odhad</span>}
                      </td>
                      <td className="px-3 py-4 font-semibold text-brand-text">{row.place}.</td>
                      <td className="px-5 py-4">{row.teamCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
