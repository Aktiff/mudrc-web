"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ChevronLeft, Save, PauseCircle, PlayCircle, Upload, ImageIcon } from "lucide-react";
import Link from "next/link";
import type { QuizEvent, LeagueEntry, PastResult } from "@/lib/data";
import { AdminDatePicker, AdminTimePicker } from "@/components/AdminDatePicker";
import { TeamAutocomplete } from "@/components/TeamAutocomplete";

type Tab = "info" | "liga" | "vysledky" | "pravidla" | "pridat";

const DURATION_OPTIONS = [60, 75, 90, 105, 120, 135, 150, 165, 180, 195, 210, 225, 240];

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h} hod.`;
  return `${h} hod. ${m} min.`;
}

export default function EditEventPage({ params }: { params: { slug: string } }) {
  const router = useRouter();
  const isNew = params.slug === "nova";
  const [tab, setTab] = useState<Tab>("info");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [quizDate, setQuizDate] = useState(() => {
    const d = new Date();
    return `${String(d.getDate()).padStart(2,"0")}.${String(d.getMonth()+1).padStart(2,"0")}.${d.getFullYear()}`;
  });
  type QuizTeamRow = { name: string; scores: number[] };
  const emptyRow = (): QuizTeamRow => ({ name: "", scores: Array(4).fill(0) });
  const [quizTeams, setQuizTeams] = useState<QuizTeamRow[]>(Array.from({ length: 10 }, emptyRow));
  const [quizResult, setQuizResult] = useState<{ winnerTeam: string; ligaPoints: {name:string;total:number;liga:number}[] } | null>(null);
  const [quizSubmitting, setQuizSubmitting] = useState(false);
  const [quizMsg, setQuizMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const addQuizTeam = () => setQuizTeams((t) => [...t, emptyRow()]);
  const removeQuizTeam = (i: number) => setQuizTeams((t) => t.filter((_, idx) => idx !== i));
  const updateQuizTeam = (i: number, field: "name" | number, val: string | number) =>
    setQuizTeams((teams) =>
      teams.map((t, idx) => {
        if (idx !== i) return t;
        if (field === "name") return { ...t, name: val as string };
        const scores = [...t.scores];
        scores[field as number] = Number(val);
        return { ...t, scores };
      })
    );
  const getTotal = (scores: number[]) => scores.reduce((a, b) => a + (Number(b) || 0), 0);

  const submitQuiz = async () => {
    const validTeams = quizTeams.filter((t) => t.name.trim());
    if (!quizDate || validTeams.length < 2) {
      setQuizMsg({ text: "Zadaj dátum a aspoň 2 tímy.", ok: false });
      return;
    }
    setQuizSubmitting(true);
    setQuizResult(null);
    setQuizMsg(null);
    try {
      const res = await fetch(`/api/admin/events/${params.slug}/kviz`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: quizDate, teams: validTeams }),
      });
      const data = await res.json();
      if (res.ok) {
        setQuizResult(data);
        setQuizTeams(Array.from({ length: 10 }, emptyRow));
        fetch("/api/admin/events").then((r) => r.json()).then((d) => {
          const ev = d.events.find((e: QuizEvent) => e.slug === params.slug);
          if (ev) setForm({ durationMinutes: 120, active: true, ...ev });
        });
      } else {
        setQuizMsg({ text: data.error ?? "Chyba pri ukladaní.", ok: false });
      }
    } catch {
      setQuizMsg({ text: "Sieťová chyba. Skús znova.", ok: false });
    }
    setQuizSubmitting(false);
  };

  const [form, setForm] = useState<QuizEvent>({
    slug: "",
    venue: "",
    city: "",
    address: "",
    date: "",
    time: "19:00",
    entryFee: 4,
    maxPlayers: 8,
    minPlayers: 2,
    rounds: 4,
    questions: 55,
    durationMinutes: 120,
    active: true,
    imageUrl: "",
    rules: [],
    leagueTable: [],
    pastResults: [],
  });

  useEffect(() => {
    if (!isNew) {
      fetch("/api/admin/events")
        .then((r) => r.json())
        .then((data) => {
          const ev = data.events.find((e: QuizEvent) => e.slug === params.slug);
          if (ev) setForm({ durationMinutes: 120, active: true, ...ev });
        });
    }
  }, [params.slug, isNew]);

  const set = (key: keyof QuizEvent, value: unknown) => setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    setSaving(true);
    setMsg("");
    const res = await fetch(
      isNew ? "/api/admin/events" : `/api/admin/events/${params.slug}`,
      {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      }
    );
    if (res.ok) {
      setMsg("Uložené!");
      if (isNew) router.push("/admin/udalosti");
    } else {
      const err = await res.json();
      setMsg(err.error ?? "Chyba pri ukladaní");
    }
    setSaving(false);
  };

  const toggleActive = async () => {
    const turningOff = form.active;
    const msg = turningOff
      ? "Naozaj vypnúť túto ligu? Udalosť zmizne z verejného zoznamu na /liga."
      : "Naozaj znova zapnúť túto ligu? Udalosť sa znova zobrazí na webe.";
    if (!confirm(msg)) return;

    const updated = { ...form, active: !form.active };
    setForm(updated);
    if (!isNew) {
      await fetch(`/api/admin/events/${params.slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
      setMsg(updated.active ? "Udalosť aktivovaná" : "Udalosť vypnutá");
    }
  };

  const resetLeague = async () => {
    if (!confirm("Naozaj resetovať ligu? Vymaže sa celá tabuľka aj všetky výsledky kvízov. Túto akciu nie je možné vrátiť späť.")) return;
    const updated = { ...form, leagueTable: [], pastResults: [] };
    setForm(updated);
    if (!isNew) {
      await fetch(`/api/admin/events/${params.slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
      setMsg("Liga resetovaná");
    }
  };

  const deleteQuiz = async (quizId: string) => {
    if (!confirm("Naozaj zmazať tento kvíz? Odstránia sa aj ligové body.")) return;
    const res = await fetch(`/api/admin/events/${params.slug}/kviz/${quizId}`, { method: "DELETE" });
    if (res.ok) {
      const data = await fetch("/api/admin/events").then((r) => r.json());
      const ev = data.events.find((e: QuizEvent) => e.slug === params.slug);
      if (ev) setForm({ durationMinutes: 120, active: true, ...ev });
      setMsg("Kvíz zmazaný");
    } else {
      setMsg("Chyba pri mazaní kvízu");
    }
  };

  const deleteEvent = async () => {
    if (!confirm("Naozaj zmazať túto udalosť?")) return;
    setDeleting(true);
    await fetch(`/api/admin/events/${params.slug}`, { method: "DELETE" });
    router.push("/admin/udalosti");
  };

  const addLeagueRow = () =>
    set("leagueTable", [
      ...form.leagueTable,
      { rank: form.leagueTable.length + 1, teamName: "", points: 0, quizzesPlayed: 0 },
    ]);

  const updateLeagueRow = (i: number, key: keyof LeagueEntry, val: string | number) =>
    set("leagueTable", form.leagueTable.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)));

  const removeLeagueRow = (i: number) =>
    set("leagueTable", form.leagueTable.filter((_, idx) => idx !== i).map((r, idx) => ({ ...r, rank: idx + 1 })));

  const addResult = () =>
    set("pastResults", [...form.pastResults, { date: "", winnerTeam: "", points: 0 }]);

  const updateResult = (i: number, key: keyof PastResult, val: string | number) =>
    set("pastResults", form.pastResults.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)));

  const removeResult = (i: number) =>
    set("pastResults", form.pastResults.filter((_, idx) => idx !== i));

  const addRule = () => set("rules", [...(form.rules ?? []), ""]);
  const updateRule = (i: number, val: string) =>
    set("rules", (form.rules ?? []).map((r, idx) => (idx === i ? val : r)));
  const removeRule = (i: number) =>
    set("rules", (form.rules ?? []).filter((_, idx) => idx !== i));

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (data.url) set("imageUrl", data.url);
    setUploading(false);
  };

  const tabClass = (t: Tab) =>
    `px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
      tab === t ? "bg-brand-orange text-brand-btn-fg shadow-sm" : "text-stone-600 hover:text-stone-900"
    }`;

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/admin/udalosti" className="text-stone-400 hover:text-stone-700 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h1 className="font-display text-3xl text-brand-text tracking-wide">
            {isNew ? "Nová udalosť" : form.venue || params.slug}
          </h1>
          {!isNew && (
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${form.active ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
              {form.active ? "Aktívna" : "Vypnutá"}
            </span>
          )}
        </div>
        {!isNew && (
          <button
            onClick={toggleActive}
            className={`flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-xl border transition-colors ${
              form.active
                ? "border-amber-200 text-amber-700 hover:bg-amber-50"
                : "border-green-200 text-green-700 hover:bg-green-50"
            }`}
          >
            {form.active ? <PauseCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
            {form.active ? "Vypnúť ligu" : "Zapnúť ligu"}
          </button>
        )}
      </div>

      <div className="flex gap-1 bg-stone-100 p-1 rounded-xl mb-6 w-fit flex-wrap">
        <button className={tabClass("pridat")} onClick={() => setTab("pridat")}>+ Pridať kvíz</button>
        <button className={tabClass("info")} onClick={() => setTab("info")}>Základné info</button>
        <button className={tabClass("liga")} onClick={() => setTab("liga")}>Liga ({form.leagueTable.length})</button>
        <button className={tabClass("vysledky")} onClick={() => setTab("vysledky")}>Výsledky ({form.pastResults.length})</button>
        <button className={tabClass("pravidla")} onClick={() => setTab("pravidla")}>Pravidlá ({(form.rules ?? []).length})</button>
      </div>

      {tab === "info" && (
        <div className="bg-white rounded-2xl border border-stone-200 p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Podnik</label>
              <input className="input" value={form.venue} onChange={(e) => set("venue", e.target.value)} placeholder="Lili Cafe" />
            </div>
            <div>
              <label className="label">Mesto</label>
              <input className="input" value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="Oslany" />
            </div>
          </div>
          <div>
            <label className="label">Adresa</label>
            <input className="input" value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Namestie Slobody 7/13, Oslany" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Dátum kvízu</label>
              <AdminDatePicker value={form.date} onChange={(v) => set("date", v)} placeholder="10.07.2026" />
            </div>
            <div>
              <label className="label">Čas</label>
              <AdminTimePicker value={form.time} onChange={(v) => set("time", v)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Min. hráčov v tíme</label>
              <input className="input" type="number" min="1" value={form.minPlayers} onChange={(e) => set("minPlayers", Number(e.target.value))} />
            </div>
            <div>
              <label className="label">Max. hráčov v tíme</label>
              <input className="input" type="number" min="1" value={form.maxPlayers} onChange={(e) => set("maxPlayers", Number(e.target.value))} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Počet otázok</label>
              <input className="input" type="number" value={form.questions} onChange={(e) => set("questions", Number(e.target.value))} />
            </div>
            <div>
              <label className="label">Vstupné (EUR / hráč)</label>
              <input className="input" type="number" step="0.5" min="0" value={form.entryFee} onChange={(e) => set("entryFee", Number(e.target.value))} />
            </div>
            <div>
              <label className="label">Približná dĺžka</label>
              <select className="input" value={form.durationMinutes} onChange={(e) => set("durationMinutes", Number(e.target.value))}>
                {DURATION_OPTIONS.map((min) => (
                  <option key={min} value={min}>{formatDuration(min)}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Fotka podniku</label>
            <div className="flex items-center gap-4">
              {form.imageUrl ? (
                <div className="relative w-24 h-16 rounded-xl overflow-hidden border border-stone-200 shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={form.imageUrl} alt="" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-24 h-16 rounded-xl border-2 border-dashed border-stone-200 flex items-center justify-center shrink-0">
                  <ImageIcon className="w-6 h-6 text-stone-300" />
                </div>
              )}
              <label className="btn-outline text-sm py-2 px-4 cursor-pointer">
                <Upload className="w-4 h-4" />
                {uploading ? "Nahrávam..." : "Nahrať fotku"}
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
              </label>
              {form.imageUrl && (
                <button onClick={() => set("imageUrl", "")} className="text-sm text-stone-400 hover:text-red-400 transition-colors">Odstrániť</button>
              )}
            </div>
          </div>
          {isNew && (
            <div>
              <label className="label">Slug (URL identifikátor)</label>
              <input className="input" value={form.slug} onChange={(e) => set("slug", e.target.value)} placeholder="lili-cafe" />
              <p className="text-stone-400 text-xs mt-1">Nechaj prázdne — vygeneruje sa automaticky z názvu podniku</p>
            </div>
          )}
        </div>
      )}

      {tab === "liga" && (
        <div className="bg-white rounded-2xl border border-stone-200 p-6">
          {!isNew && (
            <div className="flex flex-wrap gap-3 mb-6 pb-6 border-b border-stone-100">
              <button
                onClick={toggleActive}
                className={`flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-xl border transition-colors ${
                  form.active
                    ? "border-amber-200 text-amber-700 hover:bg-amber-50"
                    : "border-green-200 text-green-700 hover:bg-green-50"
                }`}
              >
                {form.active ? <PauseCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
                {form.active ? "Vypnúť ligu" : "Zapnúť ligu"}
              </button>
              <button
                onClick={resetLeague}
                className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Resetovať ligu
              </button>
            </div>
          )}
          {form.leagueTable.length > 0 && (
            <div className="grid grid-cols-[2rem_1fr_6rem_6rem_2rem] gap-2 text-xs text-stone-400 mb-2 px-0.5">
              <span>#</span>
              <span>Názov tímu</span>
              <span className="text-center">Body</span>
              <span className="text-center">Kvízy</span>
              <span />
            </div>
          )}
          <div className="space-y-2 mb-4">
            {form.leagueTable.length === 0 && (
              <p className="text-stone-400 text-sm py-4 text-center">Zatiaľ žiadne tímy. Pridaj prvý tím.</p>
            )}
            {form.leagueTable.map((row, i) => (
              <div key={i} className="grid grid-cols-[2rem_1fr_6rem_6rem_2rem] gap-2 items-center">
                <span className="text-stone-400 text-sm text-center">{row.rank}.</span>
                <input className="input text-sm py-2" value={row.teamName} onChange={(e) => updateLeagueRow(i, "teamName", e.target.value)} placeholder="Názov tímu" />
                <input className="input text-sm py-2 text-center" type="number" value={row.points} onChange={(e) => updateLeagueRow(i, "points", Number(e.target.value))} />
                <input className="input text-sm py-2 text-center" type="number" value={row.quizzesPlayed} onChange={(e) => updateLeagueRow(i, "quizzesPlayed", Number(e.target.value))} />
                <button onClick={() => removeLeagueRow(i)} className="text-stone-300 hover:text-red-400 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <button onClick={addLeagueRow} className="btn-outline text-sm py-2 px-4 w-full justify-center">
            <Plus className="w-4 h-4" /> Pridať tím
          </button>
        </div>
      )}

      {tab === "pridat" && !isNew && (
        <div className="bg-white rounded-2xl border border-stone-200 p-6">
          <p className="text-stone-500 text-sm mb-6">
            Zadaj výsledky kvízu. Prázdne riadky sa automaticky ignorujú.
          </p>
          <div className="mb-6">
            <label className="label">Dátum kvízu</label>
            <div className="max-w-xs">
              <AdminDatePicker value={quizDate} onChange={setQuizDate} />
            </div>
          </div>
          <div className="grid gap-3 mb-2 pr-9" style={{ gridTemplateColumns: `1fr repeat(${form.rounds || 4}, 5rem) 4.5rem` }}>
            <span className="text-xs text-stone-400 uppercase tracking-wider font-medium">Tím</span>
            {Array.from({ length: form.rounds || 4 }, (_, i) => (
              <span key={i} className="text-xs text-stone-400 uppercase tracking-wider font-medium text-center">K{i + 1}</span>
            ))}
            <span className="text-xs text-brand-orange uppercase tracking-wider font-semibold text-center">Body</span>
          </div>
          <div className="space-y-2 mb-6">
            {quizTeams.map((team, i) => (
              <div key={i} className="grid gap-3 items-center" style={{ gridTemplateColumns: `1fr repeat(${form.rounds || 4}, 5rem) 4.5rem 2rem` }}>
                <TeamAutocomplete
                  className="input py-2.5"
                  value={team.name}
                  onChange={(v) => updateQuizTeam(i, "name", v)}
                  suggestions={form.leagueTable.map((e) => e.teamName)}
                  placeholder={`Tím ${i + 1}`}
                />
                {Array.from({ length: form.rounds || 4 }, (_, k) => (
                  <input
                    key={k}
                    className="input py-2.5 text-center"
                    type="number" step="0.01" min="0"
                    value={team.scores[k] ?? 0}
                    onChange={(e) => updateQuizTeam(i, k, e.target.value)}
                  />
                ))}
                <div className="text-center">
                  <span className="font-display text-2xl text-brand-orange">{getTotal(team.scores)}</span>
                </div>
                <button onClick={() => removeQuizTeam(i)} className="text-stone-300 hover:text-red-400 transition-colors flex justify-center">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-3 mb-4">
            <button onClick={addQuizTeam} className="btn-outline text-sm py-2.5 px-5">
              <Plus className="w-4 h-4" /> Pridať tím
            </button>
          </div>
          {quizMsg && (
            <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium ${quizMsg.ok ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-600 border border-red-200"}`}>
              {quizMsg.text}
            </div>
          )}
          {quizResult && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-5">
              <div className="font-semibold text-green-700 mb-3">Kvíz uložený! Víťaz: {quizResult.winnerTeam}</div>
              <div className="space-y-1.5">
                {quizResult.ligaPoints.sort((a, b) => b.total - a.total).map((t, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <span className="text-stone-400 w-5 text-right font-medium">{i + 1}.</span>
                    <span className="flex-1 font-semibold text-stone-700">{t.name}</span>
                    <span className="text-stone-400">{t.total} bodov</span>
                    <span className="text-brand-orange font-bold">+{t.liga} lig. b.</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "pravidla" && (
        <div className="bg-white rounded-2xl border border-stone-200 p-6">
          <p className="text-stone-400 text-sm mb-4">Každé pravidlo je jeden riadok.</p>
          <div className="space-y-2 mb-4">
            {(form.rules ?? []).length === 0 && (
              <p className="text-stone-400 text-sm py-4 text-center">Žiadne pravidlá. Pridaj prvé.</p>
            )}
            {(form.rules ?? []).map((rule, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-stone-300 text-sm w-5 text-right shrink-0">{i + 1}.</span>
                <input
                  className="input text-sm py-2 flex-1"
                  value={rule}
                  onChange={(e) => updateRule(i, e.target.value)}
                  placeholder="Text pravidla..."
                />
                <button onClick={() => removeRule(i)} className="text-stone-300 hover:text-red-400 transition-colors shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <button onClick={addRule} className="btn-outline text-sm py-2 px-4 w-full justify-center">
            <Plus className="w-4 h-4" /> Pridať pravidlo
          </button>
        </div>
      )}

      {tab === "vysledky" && (
        <div className="bg-white rounded-2xl border border-stone-200 p-6">
          <div className="space-y-2 mb-4">
            {form.pastResults.length === 0 && (
              <p className="text-stone-400 text-sm py-4 text-center">Zatiaľ žiadne výsledky.</p>
            )}
            {[...form.pastResults].reverse().map((r, i) => {
              const hasDetail = !!(r.teams && r.teams.length > 0);
              const quizId = r.id ?? r.date.replace(/\./g, "-");
              return (
                <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${hasDetail ? "border-stone-200 hover:border-brand-orange hover:bg-brand-warm group" : "border-stone-100 bg-stone-50"}`}>
                  {hasDetail ? (
                    <>
                      <Link href={`/admin/udalosti/${params.slug}/kviz/${quizId}`} className="flex items-center gap-3 flex-1">
                        <span className="font-semibold text-brand-text text-sm">{r.date}</span>
                        <span className="text-stone-400 text-sm">víťaz</span>
                        <span className="font-semibold text-brand-orange text-sm">{r.winnerTeam}</span>
                        <span className="ml-auto text-stone-400 text-sm">{r.points} bodov</span>
                        <ChevronLeft className="w-4 h-4 text-stone-300 group-hover:text-brand-orange rotate-180 transition-all" />
                      </Link>
                      <button
                        onClick={() => deleteQuiz(quizId)}
                        className="text-stone-300 hover:text-red-500 transition-colors shrink-0 p-1"
                        title="Zmazať kvíz"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="font-semibold text-stone-500 text-sm">{r.date}</span>
                      <span className="text-stone-400 text-sm">víťaz</span>
                      <span className="font-semibold text-stone-600 text-sm">{r.winnerTeam}</span>
                      <span className="ml-auto text-stone-400 text-sm">{r.points} bodov</span>
                      <button
                        onClick={() => {
                          if (!confirm("Naozaj zmazať tento výsledok?")) return;
                          removeResult(form.pastResults.length - 1 - i);
                        }}
                        className="text-stone-300 hover:text-red-500 transition-colors shrink-0 p-1"
                        title="Zmazať výsledok"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mt-6">
        <div>
          {!isNew && (
            <button onClick={deleteEvent} disabled={deleting} className="text-sm text-red-400 hover:text-red-600 transition-colors flex items-center gap-1.5">
              <Trash2 className="w-4 h-4" />
              {deleting ? "Mažem..." : "Zmazať udalosť"}
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          {msg && <span className={`text-sm ${msg.includes("!") || msg.includes("ova") || msg.includes("ena") ? "text-green-600" : "text-red-500"}`}>{msg}</span>}
          {tab === "pridat" && !isNew ? (
            <button onClick={submitQuiz} disabled={quizSubmitting} className="btn-primary text-sm py-2.5 px-6">
              <Save className="w-4 h-4" />
              {quizSubmitting ? "Ukladám..." : "Uložiť kvíz"}
            </button>
          ) : (
            <button onClick={save} disabled={saving} className="btn-primary text-sm py-2.5 px-6">
              <Save className="w-4 h-4" />
              {saving ? "Ukladám..." : "Uložiť zmeny"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
