"use client";
import { useState, useEffect, useLayoutEffect, useRef, useMemo, type CSSProperties } from "react";
import Link from "next/link";
import type { QuizEvent, PastResultTeam } from "@/lib/data";

type TeamDisplay = PastResultTeam & { totalWithBonus: number; rowId: number };
type ScoreGroup = { teams: TeamDisplay[]; baseTotal: number; startRank: number };

function fontsForRowHeight(rowH: number) {
  return {
    namePx: Math.min(38, Math.max(10, rowH * 0.31)),
    scorePx: Math.min(42, Math.max(11, rowH * 0.34)),
    rankPx: Math.min(26, Math.max(9, rowH * 0.21)),
    subPx: Math.min(14, Math.max(7, rowH * 0.12)),
    roundColPx: Math.min(64, Math.max(30, rowH * 0.75)),
    totalColPx: Math.min(72, Math.max(34, rowH * 0.8)),
    rankColPx: Math.min(40, Math.max(22, rowH * 0.48)),
    compactBtns: rowH < 50,
  };
}

const rowFlex: CSSProperties = {
  flex: "1 1 0",
  minHeight: 0,
  overflow: "hidden",
  boxSizing: "border-box",
};

export default function PrezentaciaPage({ params }: { params: { slug: string; date: string } }) {
  const [teams, setTeams] = useState<PastResultTeam[]>([]);
  const [quizDate, setQuizDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(0);
  const [showRounds, setShowRounds] = useState(true);
  const [bonus, setBonus] = useState<Record<number, number>>({});
  const [saving, setSaving] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const [listHeight, setListHeight] = useState(0);

  useEffect(() => {
    const prevHtml = document.documentElement.style.overflow;
    const prevBody = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }, []);

  useEffect(() => {
    fetch("/api/admin/events")
      .then((r) => r.json())
      .then((data) => {
        const event: QuizEvent = data.events.find((e: QuizEvent) => e.slug === params.slug);
        if (event) {
          const r = event.pastResults.find((r) => (r.id ?? r.date.replace(/\./g, "-")) === params.date);
          if (r?.teams) {
            setTeams(r.teams);
            setQuizDate(r.date);
          }
        }
        setLoading(false);
      });
  }, [params.slug, params.date]);

  const teamsWithBonus: TeamDisplay[] = teams.map((t, i) => ({
    ...t,
    rowId: i,
    totalWithBonus: t.total + (bonus[i] ?? 0),
  }));

  const sortedDesc = [...teamsWithBonus].sort((a, b) => b.total - a.total);
  const allGroups: ScoreGroup[] = [];
  let rankCursor = 1;
  let gi = 0;
  while (gi < sortedDesc.length) {
    let gj = gi;
    while (gj < sortedDesc.length - 1 && sortedDesc[gj].total === sortedDesc[gj + 1].total) gj++;
    allGroups.push({ baseTotal: sortedDesc[gi].total, teams: sortedDesc.slice(gi, gj + 1), startRank: rankCursor });
    rankCursor += gj - gi + 1;
    gi = gj + 1;
  }

  const G = allGroups.length;
  const isStartScreen = step === 0;
  const isPreFinal = step === G;
  const isFinal = step > G;

  const visibleGroups: ScoreGroup[] = allGroups.slice(Math.max(0, G - step));
  const displayGroups = visibleGroups.map((group) => ({
    ...group,
    teams:
      group.teams.length > 1
        ? [...group.teams].sort((a, b) => (bonus[b.rowId] ?? 0) - (bonus[a.rowId] ?? 0))
        : group.teams,
  }));

  const finalSorted = [...teamsWithBonus].sort((a, b) => b.totalWithBonus - a.totalWithBonus);

  const visibleRowCount = isStartScreen
    ? 0
    : isFinal
    ? finalSorted.length
    : displayGroups.reduce((sum, group) => sum + group.teams.length, 0);

  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el || visibleRowCount === 0) return;
    const measure = () => setListHeight(el.clientHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [step, showRounds, isPreFinal, isFinal, visibleRowCount]);

  const gapPx = visibleRowCount > 10 ? 1 : visibleRowCount > 7 ? 2 : 3;
  const rowHeight =
    visibleRowCount > 0
      ? (listHeight - gapPx * Math.max(0, visibleRowCount - 1)) / visibleRowCount
      : 48;
  const layout = useMemo(() => fontsForRowHeight(rowHeight), [rowHeight]);

  const addBonus = (rowId: number) =>
    setBonus((prev) => ({ ...prev, [rowId]: parseFloat(((prev[rowId] ?? 0) + 0.1).toFixed(2)) }));

  const removeBonus = (rowId: number) =>
    setBonus((prev) => ({ ...prev, [rowId]: Math.max(0, parseFloat(((prev[rowId] ?? 0) - 0.1).toFixed(2))) }));

  const saveAndRevealWinner = async () => {
    setSaving(true);
    const teamsPayload = finalSorted.map((t) => ({
      name: t.teamName,
      scores: t.rounds ?? [],
      total: t.totalWithBonus,
    }));
    try {
      const res = await fetch(`/api/admin/events/${params.slug}/kviz/${params.date}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: quizDate, teams: teamsPayload }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "Chyba pri ukladaní kvízu do ligy");
        setSaving(false);
        return;
      }
      alert("Kvíz uložený do ligy. Liga je zapnutá.");
    } catch {
      alert("Sieťová chyba pri ukladaní kvízu");
      setSaving(false);
      return;
    }
    setSaving(false);
    setStep(G + 1);
  };

  const fmtScore = (v: number) => (v % 1 === 0 ? String(v) : String(parseFloat(v.toFixed(2))));
  const backUrl = `/admin/udalosti/${params.slug}/kviz/${params.date}`;
  const listGapStyle: CSSProperties = { gap: `${gapPx}px` };
  const numRounds = teams[0]?.rounds?.length ?? 4;
  const rowGrid = `${layout.rankColPx}px 1fr 1fr`;
  const scoresGrid = `repeat(${numRounds}, 1fr) minmax(4rem, 1.4fr) minmax(5.5rem, 1.2fr)`;

  const renderTieButtons = (rowId: number, inline?: boolean) => (
    <div className={`${inline ? "shrink-0" : ""} flex ${layout.compactBtns ? "flex-row gap-0.5" : "flex-col gap-0.5"}`}>
      <button
        onClick={() => addBonus(rowId)}
        className="text-[#ffd54f] font-bold bg-stone-700 hover:bg-[#f0b429] hover:text-black rounded transition-all"
        style={{
          fontSize: `${layout.subPx}px`,
          padding: layout.compactBtns ? "0.1rem 0.35rem" : "0.15rem 0.5rem",
        }}
      >
        {layout.compactBtns ? "+0.1" : "+0.1 bod"}
      </button>
      <button
        onClick={() => removeBonus(rowId)}
        disabled={(bonus[rowId] ?? 0) <= 0}
        className="text-stone-400 font-bold bg-stone-800 hover:bg-red-800 hover:text-white rounded transition-all disabled:opacity-25 disabled:cursor-not-allowed"
        style={{
          fontSize: `${layout.subPx}px`,
          padding: layout.compactBtns ? "0.1rem 0.35rem" : "0.15rem 0.5rem",
        }}
      >
        {layout.compactBtns ? "−0.1" : "−0.1 bod"}
      </button>
    </div>
  );

  if (loading) {
    return (
      <div className="fixed inset-0 bg-[#1a1a1a] flex items-center justify-center z-[9999]">
        <span className="text-white text-3xl">Načítavam...</span>
      </div>
    );
  }

  if (!teams.length) {
    return (
      <div className="fixed inset-0 bg-[#1a1a1a] flex flex-col items-center justify-center z-[9999] gap-6">
        <p className="text-white text-2xl">Prezentácia nie je dostupná.</p>
        <Link href={`/admin/udalosti/${params.slug}`} className="text-[#f0b429] underline text-xl">
          Späť
        </Link>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-[#1a1a1a] z-[9999] flex flex-col overflow-hidden select-none h-[100dvh]"
      style={{ fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <div className="flex items-center justify-between px-6 py-3 shrink-0 border-b border-[#2a2a2a]">
        <Link href={backUrl} className="text-stone-400 hover:text-white text-lg transition-colors">
          ← Späť
        </Link>
        <span className="font-bold text-[#f0b429] text-2xl tracking-widest">MUDRC KVÍZ</span>
        <button
          onClick={() => setShowRounds((v) => !v)}
          className="text-sm font-semibold px-3 py-1.5 rounded-lg border border-[#f0b429] text-[#f0b429] hover:bg-[#f0b429] hover:text-black transition-all"
        >
          {showRounds ? "Skryť kolá" : "Zobraziť kolá"}
        </button>
      </div>

      <div className="flex-1 min-h-0 flex flex-col px-2 py-2 overflow-hidden w-full">
        {isStartScreen ? (
          <div className="flex flex-col items-center justify-center flex-1 min-h-0 gap-8">
            <span style={{ fontSize: "5rem" }}>🎯</span>
            <span className="font-bold text-[#f0b429] tracking-widest" style={{ fontSize: "3.5rem" }}>
              MUDRC KVÍZ
            </span>
          </div>
        ) : isFinal ? (
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="shrink-0 flex items-center gap-3 py-1">
              <span style={{ fontSize: `${Math.min(52, layout.scorePx * 1.15)}px` }}>🏆</span>
              <div>
                <div
                  className="font-bold text-[#f0b429] leading-tight"
                  style={{ fontSize: `${Math.min(34, layout.namePx * 1.05)}px` }}
                >
                  {finalSorted[0].teamName}
                </div>
                <div className="text-stone-400" style={{ fontSize: `${layout.subPx}px` }}>
                  Víťaz kvízu MUDRC!
                </div>
              </div>
            </div>
            <div ref={listRef} className="flex-1 min-h-0 flex flex-col overflow-hidden w-full" style={listGapStyle}>
              {finalSorted.map((t, idx) => (
                <div
                  key={t.teamName}
                  className={`grid items-center gap-3 rounded-xl w-full ${idx === 0 ? "border-2 border-[#f0b429] bg-[#211900]" : "border border-[#2a2a2a] bg-[#1a1a1a]"}`}
                  style={{ ...rowFlex, display: "grid", alignItems: "center", gridTemplateColumns: rowGrid, padding: "0 0.5rem" }}
                >
                  <span
                    className={`font-bold shrink-0 ${idx === 0 ? "text-[#f0b429]" : "text-stone-400"}`}
                    style={{ fontSize: `${layout.rankPx}px` }}
                  >
                    {idx === 0 ? "🏆" : `${idx + 1}.`}
                  </span>
                  <span
                    className={`font-bold truncate ${idx === 0 ? "text-[#ffd54f]" : "text-white"}`}
                    style={{ fontSize: `${layout.namePx}px` }}
                  >
                    {t.teamName}
                  </span>
                  <span className="text-[#f0b429] font-bold text-right whitespace-nowrap tabular-nums" style={{ fontSize: `${layout.scorePx}px` }}>
                    {fmtScore(t.totalWithBonus)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            {showRounds && (
              <div
                className="grid items-center text-stone-500 uppercase tracking-wider pb-1 border-b border-stone-800 mb-1 shrink-0 w-full"
                style={{
                  gridTemplateColumns: rowGrid,
                  fontSize: `${layout.subPx}px`,
                  paddingLeft: "0.5rem",
                  paddingRight: "0.5rem",
                  gap: "0.5rem",
                }}
              >
                <span>#</span>
                <span>Tím</span>
                <div
                  className="grid items-center w-full"
                  style={{
                    gridTemplateColumns: scoresGrid,
                    gap: "0.35rem",
                  }}
                >
                  {Array.from({ length: numRounds }, (_, k) => (
                    <span key={k} className="text-center">
                      K{k + 1}
                    </span>
                  ))}
                  <span className="text-right">Body</span>
                  <span />
                </div>
              </div>
            )}

            <div ref={listRef} className="flex-1 min-h-0 flex flex-col overflow-hidden w-full" style={listGapStyle}>
              {displayGroups.map((group, groupIdx) => {
                const isTie = group.teams.length > 1;
                const isNewest = groupIdx === 0 && !isPreFinal;
                const isFirstPlaceGroup = group.startRank === 1;
                const groupHasBonus = isTie && group.teams.some((t) => (bonus[t.rowId] ?? 0) > 0);

                return group.teams.map((team, teamIdx) => {
                  const rankDisplay = isTie
                    ? groupHasBonus
                      ? `${group.startRank + teamIdx}.`
                      : "–"
                    : `${group.startRank}.`;
                  const isFirstPlace = isFirstPlaceGroup && isPreFinal && !isTie;

                  return (
                    <div
                      key={team.teamName}
                      className={`grid items-center gap-2 rounded-xl w-full transition-all duration-300 ${
                        isFirstPlace
                          ? "border-2 border-[#f0b429] bg-[#211900]"
                          : isNewest
                          ? "border border-[#444] bg-[#222]"
                          : "border border-[#2a2a2a] bg-[#1a1a1a]"
                      }`}
                      style={
                        showRounds
                          ? {
                              ...rowFlex,
                              display: "grid",
                              alignItems: "center",
                              gridTemplateColumns: rowGrid,
                              padding: "0 0.5rem",
                            }
                          : {
                              ...rowFlex,
                              display: "grid",
                              alignItems: "center",
                              gridTemplateColumns: rowGrid,
                              padding: "0 0.5rem",
                            }
                      }
                    >
                      {showRounds ? (
                        <>
                          <span
                            className={`font-bold ${isFirstPlace ? "text-[#f0b429]" : "text-stone-400"}`}
                            style={{ fontSize: `${layout.rankPx}px` }}
                          >
                            {rankDisplay}
                          </span>
                          <span
                            className={`font-bold truncate ${isFirstPlace ? "text-[#ffd54f]" : "text-white"}`}
                            style={{ fontSize: `${layout.namePx}px` }}
                          >
                            {team.teamName}
                          </span>
                          <div
                            className="grid items-center w-full min-w-0"
                            style={{ gridTemplateColumns: scoresGrid, gap: "0.35rem" }}
                          >
                            {Array.from({ length: numRounds }, (_, k) => (
                              <span
                                key={k}
                                className="text-center text-white font-semibold tabular-nums"
                                style={{ fontSize: `${layout.namePx * 0.85}px` }}
                              >
                                {fmtScore(team.rounds?.[k] ?? 0)}
                              </span>
                            ))}
                            <span
                              className="text-right font-bold text-[#f0b429] whitespace-nowrap tabular-nums"
                              style={{ fontSize: `${layout.scorePx}px` }}
                            >
                              {fmtScore(team.totalWithBonus)}
                            </span>
                            {isTie ? renderTieButtons(team.rowId) : <span />}
                          </div>
                        </>
                      ) : (
                        <>
                          <span
                            className={`font-bold ${isFirstPlace ? "text-[#f0b429]" : "text-stone-400"}`}
                            style={{ fontSize: `${layout.rankPx}px` }}
                          >
                            {rankDisplay}
                          </span>
                          <span
                            className={`font-bold truncate ${isFirstPlace ? "text-[#ffd54f]" : "text-white"}`}
                            style={{ fontSize: `${layout.namePx}px` }}
                          >
                            {team.teamName}
                          </span>
                          <div className="flex items-center justify-end gap-3 min-w-0">
                            <span className="font-bold text-[#f0b429] whitespace-nowrap tabular-nums" style={{ fontSize: `${layout.scorePx}px` }}>
                              {fmtScore(team.totalWithBonus)}
                            </span>
                            {isTie && renderTieButtons(team.rowId, true)}
                          </div>
                        </>
                      )}
                    </div>
                  );
                });
              })}
            </div>
          </div>
        )}
      </div>

      {isPreFinal && (
        <div className="text-center py-1 shrink-0">
          <span className="font-bold text-[#f0b429]" style={{ fontSize: `${Math.max(16, layout.subPx * 1.5)}px` }}>
            Gratulujeme! 🎉
          </span>
        </div>
      )}

      <div className="flex justify-center py-3 shrink-0">
        {isFinal ? (
          <Link
            href={backUrl}
            className="bg-[#f0b429] text-black font-bold rounded-2xl hover:bg-[#ffd54f] transition-colors shadow-lg shadow-black/40"
            style={{ fontSize: "1.25rem", padding: "0.75rem 3rem" }}
          >
            Zavrieť prezentáciu
          </Link>
        ) : isPreFinal ? (
          <button
            onClick={saveAndRevealWinner}
            disabled={saving}
            className="bg-[#f0b429] text-black font-bold rounded-2xl hover:bg-[#ffd54f] transition-colors active:scale-95 disabled:opacity-60 shadow-lg shadow-black/40"
            style={{ fontSize: "1.25rem", padding: "0.75rem 3rem" }}
          >
            {saving ? "Ukladám..." : "💾 Uložiť kvíz"}
          </button>
        ) : (
          <button
            onClick={() => setStep((s) => s + 1)}
            className="bg-[#f0b429] text-black font-bold rounded-2xl hover:bg-[#ffd54f] transition-colors active:scale-95 shadow-lg shadow-black/40"
            style={{ fontSize: "1.25rem", padding: "0.75rem 3rem" }}
          >
            {isStartScreen ? "Štart →" : "Ďalší →"}
          </button>
        )}
      </div>
    </div>
  );
}
