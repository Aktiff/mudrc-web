"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import type { QuizEvent, PastResultTeam } from "@/lib/data";

type TeamDisplay = PastResultTeam & { totalWithBonus: number };
type ScoreGroup = { teams: TeamDisplay[]; baseTotal: number; startRank: number };

export default function PrezentaciaPage({ params }: { params: { slug: string; date: string } }) {
  const [teams, setTeams] = useState<PastResultTeam[]>([]);
  const [quizDate, setQuizDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(0);
  const [showRounds, setShowRounds] = useState(true);
  const [bonus, setBonus] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [viewportH, setViewportH] = useState(900);

  useEffect(() => {
    const update = () => setViewportH(window.innerHeight);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    fetch("/api/admin/events")
      .then(r => r.json())
      .then(data => {
        const event: QuizEvent = data.events.find((e: QuizEvent) => e.slug === params.slug);
        if (event) {
          const r = event.pastResults.find(r => (r.id ?? r.date.replace(/\./g, "-")) === params.date);
          if (r?.teams) { setTeams(r.teams); setQuizDate(r.date); }
        }
        setLoading(false);
      });
  }, [params.slug, params.date]);

  if (loading) return (
    <div className="fixed inset-0 bg-[#1a1a1a] flex items-center justify-center z-[9999]">
      <span className="text-white text-3xl">Načítavam...</span>
    </div>
  );

  if (!teams.length) return (
    <div className="fixed inset-0 bg-[#1a1a1a] flex flex-col items-center justify-center z-[9999] gap-6">
      <p className="text-white text-2xl">Prezentácia nie je dostupná.</p>
      <Link href={`/admin/udalosti/${params.slug}`} className="text-[#f0b429] underline text-xl">Späť</Link>
    </div>
  );

  const N = teams.length;
  const numRounds = teams[0]?.rounds?.length ?? 4;

  const teamsWithBonus: TeamDisplay[] = teams.map(t => ({
    ...t,
    totalWithBonus: t.total + (bonus[t.teamName] ?? 0),
  }));

  // Build score groups sorted best-to-worst (highest total = index 0)
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

  // allGroups[0] = first place group, allGroups[G-1] = last place group
  const G = allGroups.length;
  const isStartScreen = step === 0;
  const isPreFinal = step === G;   // all groups revealed
  const isFinal = step > G;        // winner screen

  // Reveal groups from worst (step=1 → allGroups[G-1]) to best (step=G → all)
  const visibleGroups: ScoreGroup[] = allGroups.slice(Math.max(0, G - step));
  // visibleGroups[0] = best visible (most recently revealed at top), visibleGroups[last] = worst

  // Sort teams within tied groups by bonus desc
  const displayGroups = visibleGroups.map(group => ({
    ...group,
    teams: group.teams.length > 1
      ? [...group.teams].sort((a, b) => (bonus[b.teamName] ?? 0) - (bonus[a.teamName] ?? 0))
      : group.teams,
  }));

  const addBonus = (name: string) =>
    setBonus(prev => ({ ...prev, [name]: parseFloat(((prev[name] ?? 0) + 0.1).toFixed(2)) }));

  const removeBonus = (name: string) =>
    setBonus(prev => ({ ...prev, [name]: Math.max(0, parseFloat(((prev[name] ?? 0) - 0.1).toFixed(2))) }));

  const saveAndRevealWinner = async () => {
    setSaving(true);
    const teamsPayload = finalSorted.map(t => ({
      name: t.teamName,
      scores: t.rounds ?? [],
      total: t.totalWithBonus,
    }));
    try {
      await fetch(`/api/admin/events/${params.slug}/kviz/${params.date}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: quizDate, teams: teamsPayload }),
      });
    } catch { /* non-blocking: show winner anyway */ }
    setSaving(false);
    setStep(G + 1);
  };

  const finalSorted = [...teamsWithBonus].sort((a, b) => b.totalWithBonus - a.totalWithBonus);

  const visibleRowCount = isStartScreen
    ? 0
    : isFinal
    ? finalSorted.length
    : displayGroups.reduce((sum, group) => sum + group.teams.length, 0);

  const topBarPx = 72;
  const bottomBarPx = isPreFinal ? 150 : 110;
  const colHeaderPx = showRounds && !isStartScreen && !isFinal ? 40 : 0;
  const contentPadPx = 24;
  const availablePx = Math.max(
    200,
    viewportH - topBarPx - bottomBarPx - colHeaderPx - contentPadPx
  );
  const rowCount = Math.max(1, visibleRowCount || N);
  const rowHeightPx = availablePx / rowCount;
  const fitScale = Math.min(1, rowHeightPx / 52);

  const nameFontRem = Math.max(0.9, Math.min(4.2, 4.2 * fitScale));
  const scoreFontRem = Math.max(1, Math.min(5, 5 * fitScale));
  const rankFontRem = Math.max(0.8, Math.min(3.5, 3.5 * fitScale));
  const subFontRem = Math.max(0.65, Math.min(2.5, 2.5 * fitScale));
  const rowPadY = Math.max(0.12, Math.min(1.1, (rowHeightPx - 10) / 32));
  const rowGapPx = Math.max(2, Math.min(8, 8 * fitScale));
  const roundColRem = Math.max(3.2, Math.min(8, 8 * fitScale));
  const totalColRem = Math.max(3.8, Math.min(9, 9 * fitScale));
  const rankColRem = Math.max(2.5, Math.min(4, 4 * fitScale));

  const fmtScore = (v: number) => v % 1 === 0 ? String(v) : String(parseFloat(v.toFixed(2)));
  const backUrl = `/admin/udalosti/${params.slug}/kviz/${params.date}`;

  return (
    <div
      className="fixed inset-0 bg-[#1a1a1a] z-[9999] flex flex-col overflow-hidden select-none"
      style={{ fontFamily: "Inter, system-ui, sans-serif" }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-8 py-4 shrink-0 border-b border-[#2a2a2a]">
        <Link href={backUrl} className="text-stone-400 hover:text-white text-lg transition-colors">
          ← Späť
        </Link>
        <span className="font-bold text-[#f0b429] text-2xl tracking-widest">MUDRC KVÍZ</span>
        <button
          onClick={() => setShowRounds(v => !v)}
          className="text-base font-semibold px-4 py-2 rounded-lg border border-[#f0b429] text-[#f0b429] hover:bg-[#f0b429] hover:text-black transition-all"
        >
          {showRounds ? "Skryť kolá" : "Zobraziť kolá"}
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col px-8 py-4 overflow-hidden">
        {isStartScreen ? (
          /* ── Start screen ── */
          <div className="flex flex-col items-center justify-center h-full gap-8">
            <span style={{ fontSize: "5rem" }}>🎯</span>
            <span className="font-bold text-[#f0b429] tracking-widest" style={{ fontSize: "3.5rem" }}>
              MUDRC KVÍZ
            </span>
          </div>

        ) : isFinal ? (
          /* ── Winner screen ── */
          <div className="flex flex-col h-full min-h-0 overflow-hidden">
            <div className="shrink-0 flex items-center gap-4 py-2">
              <span style={{ fontSize: `${Math.max(1.8, 3.5 * fitScale)}rem` }}>🏆</span>
              <div>
                <div
                  className="font-bold text-[#f0b429] leading-tight"
                  style={{ fontSize: `${Math.max(1.4, Math.min(4, 32 / Math.max(6, finalSorted[0].teamName.length))) * fitScale}rem` }}
                >
                  {finalSorted[0].teamName}
                </div>
                <div className="text-stone-400" style={{ fontSize: `${Math.max(0.85, 1.3 * fitScale)}rem` }}>
                  Víťaz kvízu MUDRC!
                </div>
              </div>
            </div>
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden" style={{ gap: `${rowGapPx}px` }}>
              {finalSorted.map((t, idx) => (
                <div
                  key={t.teamName}
                  className={`flex items-center gap-6 rounded-xl ${idx === 0 ? "border-2 border-[#f0b429] bg-[#211900]" : "border border-[#2a2a2a] bg-[#1a1a1a]"}`}
                  style={{ padding: `${rowPadY}rem 1.5rem` }}
                >
                  <span
                    className={`font-bold shrink-0 ${idx === 0 ? "text-[#f0b429]" : "text-stone-400"}`}
                    style={{ minWidth: "4rem", fontSize: `${rankFontRem}rem` }}
                  >
                    {idx === 0 ? "🏆" : `${idx + 1}.`}
                  </span>
                  <span
                    className={`font-bold flex-1 ${idx === 0 ? "text-[#ffd54f]" : "text-white"}`}
                    style={{ fontSize: `${nameFontRem}rem` }}
                  >
                    {t.teamName}
                  </span>
                  <span className="text-[#f0b429] font-bold shrink-0" style={{ fontSize: `${scoreFontRem}rem` }}>
                    {fmtScore(t.totalWithBonus)}
                  </span>
                </div>
              ))}
            </div>
          </div>

        ) : (
          /* ── Reveal screen ── */
          <div className="flex flex-col h-full min-h-0 overflow-hidden">
            {showRounds && (
              <div
                className="grid items-center text-stone-500 uppercase tracking-wider pb-2 border-b border-stone-800 mb-1 shrink-0"
                style={{
                  gridTemplateColumns: `${rankColRem}rem 1fr repeat(${numRounds}, ${roundColRem}rem) ${totalColRem}rem ${totalColRem}rem`,
                  fontSize: `${subFontRem * 0.7}rem`,
                  paddingLeft: "1.5rem",
                  paddingRight: "1.5rem",
                  gap: "0.5rem",
                }}
              >
                <span>#</span>
                <span>Tím</span>
                {Array.from({ length: numRounds }, (_, k) => (
                  <span key={k} className="text-center">K{k + 1}</span>
                ))}
                <span className="text-right">Body</span>
                <span />
              </div>
            )}

            <div className="flex-1 min-h-0 flex flex-col overflow-hidden" style={{ gap: `${rowGapPx}px` }}>
            {displayGroups.map((group, groupIdx) => {
              const isTie = group.teams.length > 1;
              const isNewest = groupIdx === 0 && !isPreFinal;
              const isFirstPlaceGroup = group.startRank === 1;
              const groupHasBonus = isTie && group.teams.some(t => (bonus[t.teamName] ?? 0) > 0);

              return group.teams.map((team, teamIdx) => {
                const rankDisplay = isTie
                  ? (groupHasBonus ? `${group.startRank + teamIdx}.` : "–")
                  : `${group.startRank}.`;
                const isFirstPlace = isFirstPlaceGroup && isPreFinal && !isTie;

                return (
                  <div
                    key={team.teamName}
                    className={`rounded-xl transition-all duration-300 shrink-0 ${
                      isFirstPlace
                        ? "border-2 border-[#f0b429] bg-[#211900]"
                        : isNewest
                        ? "border border-[#444] bg-[#222]"
                        : "border border-[#2a2a2a] bg-[#1a1a1a]"
                    }`}
                    style={showRounds ? {
                      display: "grid",
                      gridTemplateColumns: `${rankColRem}rem 1fr repeat(${numRounds}, ${roundColRem}rem) ${totalColRem}rem ${totalColRem}rem`,
                      alignItems: "center",
                      padding: `${rowPadY}rem 1.5rem`,
                      gap: "0.5rem",
                    } : {
                      display: "flex",
                      alignItems: "center",
                      padding: `${rowPadY}rem 1.5rem`,
                      gap: "1rem",
                    }}
                  >
                    {showRounds ? (
                      <>
                        <span
                          className={`font-bold ${isFirstPlace ? "text-[#f0b429]" : "text-stone-400"}`}
                          style={{ fontSize: `${rankFontRem}rem` }}
                        >
                          {rankDisplay}
                        </span>
                        <span
                          className={`font-bold ${isFirstPlace ? "text-[#ffd54f]" : "text-white"}`}
                          style={{ fontSize: `${nameFontRem}rem` }}
                        >
                          {team.teamName}
                        </span>
                        {Array.from({ length: numRounds }, (_, k) => (
                          <span key={k} className="text-center text-white font-semibold" style={{ fontSize: `${nameFontRem * 0.85}rem` }}>
                            {fmtScore(team.rounds?.[k] ?? 0)}
                          </span>
                        ))}
                        <span
                          className="text-right font-bold text-[#f0b429]"
                          style={{ fontSize: `${scoreFontRem}rem` }}
                        >
                          {fmtScore(team.totalWithBonus)}
                        </span>
                        {isTie ? (
                          <div className="flex flex-col gap-1 items-center justify-center">
                            <button
                              onClick={() => addBonus(team.teamName)}
                              className="text-center text-[#ffd54f] font-bold bg-stone-700 hover:bg-[#f0b429] hover:text-black rounded-lg transition-all w-full"
                              style={{ fontSize: `${subFontRem * 0.75}rem`, padding: "0.25rem 0.5rem" }}
                            >
                              +0.1 bod
                            </button>
                            <button
                              onClick={() => removeBonus(team.teamName)}
                              disabled={(bonus[team.teamName] ?? 0) <= 0}
                              className="text-center text-stone-400 font-bold bg-stone-800 hover:bg-red-800 hover:text-white rounded-lg transition-all w-full disabled:opacity-25 disabled:cursor-not-allowed"
                              style={{ fontSize: `${subFontRem * 0.75}rem`, padding: "0.25rem 0.5rem" }}
                            >
                              −0.1 bod
                            </button>
                          </div>
                        ) : (
                          <span />
                        )}
                      </>
                    ) : (
                      <>
                        <span
                          className={`font-bold shrink-0 ${isFirstPlace ? "text-[#f0b429]" : "text-stone-400"}`}
                          style={{ minWidth: "4rem", fontSize: `${rankFontRem}rem` }}
                        >
                          {rankDisplay}
                        </span>
                        <span
                          className={`font-bold flex-1 ${isFirstPlace ? "text-[#ffd54f]" : "text-white"}`}
                          style={{ fontSize: `${nameFontRem}rem` }}
                        >
                          {team.teamName}
                        </span>
                        <span
                          className="font-bold text-[#f0b429] shrink-0"
                          style={{ fontSize: `${scoreFontRem}rem` }}
                        >
                          {fmtScore(team.totalWithBonus)}
                        </span>
                        {isTie && (
                          <div className="shrink-0 flex flex-col gap-1">
                            <button
                              onClick={() => addBonus(team.teamName)}
                              className="text-[#ffd54f] font-bold bg-stone-700 hover:bg-[#f0b429] hover:text-black rounded-xl transition-all"
                              style={{ fontSize: `${subFontRem * 0.9}rem`, padding: "0.4rem 1.1rem" }}
                            >
                              +0.1 bod
                            </button>
                            <button
                              onClick={() => removeBonus(team.teamName)}
                              disabled={(bonus[team.teamName] ?? 0) <= 0}
                              className="text-stone-400 font-bold bg-stone-800 hover:bg-red-800 hover:text-white rounded-xl transition-all disabled:opacity-25 disabled:cursor-not-allowed"
                              style={{ fontSize: `${subFontRem * 0.9}rem`, padding: "0.4rem 1.1rem" }}
                            >
                              −0.1 bod
                            </button>
                          </div>
                        )}
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

      {/* Gratulujeme message when all revealed */}
      {isPreFinal && (
        <div className="text-center pb-1 shrink-0">
          <span className="font-bold text-[#f0b429]" style={{ fontSize: `${Math.max(1.4, 2.5 * fitScale)}rem` }}>Gratulujeme! 🎉</span>
        </div>
      )}

      {/* Bottom button */}
      <div className="flex justify-center pb-8 pt-3 shrink-0">
        {isFinal ? (
          <Link
            href={backUrl}
            className="bg-[#f0b429] text-black font-bold rounded-2xl hover:bg-[#ffd54f] transition-colors shadow-lg shadow-black/40"
            style={{ fontSize: "1.6rem", padding: "1rem 4rem" }}
          >
            Zavrieť prezentáciu
          </Link>
        ) : isPreFinal ? (
          <button
            onClick={saveAndRevealWinner}
            disabled={saving}
            className="bg-[#f0b429] text-black font-bold rounded-2xl hover:bg-[#ffd54f] transition-colors active:scale-95 disabled:opacity-60 shadow-lg shadow-black/40"
            style={{ fontSize: "1.6rem", padding: "1rem 4rem" }}
          >
            {saving ? "Ukladám..." : "💾 Uložiť kvíz"}
          </button>
        ) : (
          <button
            onClick={() => setStep(s => s + 1)}
            className="bg-[#f0b429] text-black font-bold rounded-2xl hover:bg-[#ffd54f] transition-colors active:scale-95 shadow-lg shadow-black/40"
            style={{ fontSize: "1.6rem", padding: "1rem 4rem" }}
          >
            {isStartScreen ? "Štart →" : "Ďalší →"}
          </button>
        )}
      </div>
    </div>
  );
}
