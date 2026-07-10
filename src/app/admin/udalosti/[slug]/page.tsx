"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ChevronLeft, Save, PauseCircle, PlayCircle, Upload, ImageIcon, Phone, Users, Clock, RefreshCw, Vote, ExternalLink, UserPlus, UserX } from "lucide-react";
import Link from "next/link";
import type { QuizEvent, LeagueEntry, PastResult } from "@/lib/data";
import { sortLeagueTable } from "@/lib/data";
import { hasSeedLeagueBackup } from "@/lib/league-seed";
import { formatPollOptionLabel, pollOptionsMatch } from "@/lib/poll";
import { findQuizResult, mergePastResults, normalizeDateKey, quizResultKey } from "@/lib/quiz-result-key";
import { REGION_OPTIONS } from "@/lib/regions";
import { AdminDatePicker, AdminTimePicker } from "@/components/AdminDatePicker";
import { PollAdminMultiDatePicker } from "@/components/PollAdminMultiDatePicker";
import { TeamAutocomplete } from "@/components/TeamAutocomplete";

type Tab = "info" | "liga" | "vysledky" | "pravidla" | "pridat" | "registracie" | "anketa";

const VALID_TABS: Tab[] = ["info", "liga", "vysledky", "pravidla", "pridat", "registracie", "anketa"];

function parseTab(value: string | null): Tab {
  if (value && VALID_TABS.includes(value as Tab)) return value as Tab;
  return "info";
}

type PollAdminState = {
  config: { active: boolean; title: string } | null;
  votes: { id: string; teamName: string; optionDates: string[]; updatedAt: string }[];
  teamCount: number;
  upcomingOptions: string[];
  configOptions: string[];
  publicPath: string;
  storage: "supabase" | "local" | "unconfigured";
  publicVisible: boolean;
};

const DURATION_OPTIONS = [60, 75, 90, 105, 120, 135, 150, 165, 180, 195, 210, 225, 240];

function normalizeEvent(ev: QuizEvent): QuizEvent {
  return {
    ...ev,
    durationMinutes: ev.durationMinutes ?? 120,
    leagueActive: ev.leagueActive === false ? false : true,
    registrationOpen: ev.registrationOpen === false ? false : true,
    leagueTable: sortLeagueTable(ev.leagueTable ?? []),
  };
}

async function fetchFreshEvent(slug: string): Promise<QuizEvent | null> {
  const fresh = await fetch(`/api/admin/events?_=${Date.now()}`, { cache: "no-store" }).then((r) => r.json());
  return fresh.events?.find((e: QuizEvent) => e.slug === slug) ?? null;
}

async function loadEventFromServer(slug: string): Promise<QuizEvent | null> {
  const res = await fetch(`/api/admin/events?_=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) return null;
  const data = await res.json();
  return data.events?.find((e: QuizEvent) => e.slug === slug) ?? null;
}

function mergeFormWithServer(local: QuizEvent, server: QuizEvent): QuizEvent {
  const merged: QuizEvent = { ...local };
  if ((server.leagueTable?.length ?? 0) >= (local.leagueTable?.length ?? 0)) {
    merged.leagueTable = server.leagueTable;
  }
  merged.pastResults = mergePastResults(local.pastResults ?? [], server.pastResults ?? []);
  merged.leagueActive = server.leagueActive;
  merged.active = server.active;
  return normalizeEvent(merged);
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h} hod.`;
  return `${h} hod. ${m} min.`;
}

export default function EditEventPage({ params }: { params: { slug: string } }) {
  const router = useRouter();
  const isNew = params.slug === "nova";
  const [tab, setTabState] = useState<Tab>("info");
  const [saving, setSaving] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
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
  type EventRegistration = { id: string; eventSlug: string; venue: string; teamName: string; players: string; phone: string; createdAt: string };
  const [registrations, setRegistrations] = useState<EventRegistration[]>([]);
  const [regsLoading, setRegsLoading] = useState(false);
  const [deletingRegId, setDeletingRegId] = useState<string | null>(null);
  const [clearingRegs, setClearingRegs] = useState(false);
  const [pollAdmin, setPollAdmin] = useState<PollAdminState | null>(null);
  const [pollLoading, setPollLoading] = useState(false);
  const [pollToggling, setPollToggling] = useState(false);
  const [pollResetting, setPollResetting] = useState(false);
  const [deletingPollTeam, setDeletingPollTeam] = useState<string | null>(null);
  const [pollSelectedDates, setPollSelectedDates] = useState<string[]>([]);
  const [pollOptionsSaving, setPollOptionsSaving] = useState(false);

  useEffect(() => {
    setTabState(parseTab(new URLSearchParams(window.location.search).get("tab")));
  }, [params.slug]);

  const setTab = useCallback(
    (next: Tab) => {
      setTabState(next);
      const query = new URLSearchParams(window.location.search);
      if (next === "info") query.delete("tab");
      else query.set("tab", next);
      const qs = query.toString();
      router.replace(`/admin/udalosti/${params.slug}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [params.slug, router]
  );

  const loadRegistrations = () => {
    setRegsLoading(true);
    fetch(`/api/register?slug=${params.slug}&venue=${encodeURIComponent(form.venue)}&_=${Date.now()}`, {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((d) => setRegistrations(d.registrations ?? []))
      .finally(() => setRegsLoading(false));
  };

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
    if (findQuizResult(form.pastResults ?? [], normalizeDateKey(quizDate))) {
      setQuizMsg({ text: "Kvíz s týmto dátumom je už vytvorený. Zvoľ iný dátum alebo ho uprav vo Výsledkoch.", ok: false });
      setMsg({ text: "Kvíz s týmto dátumom je už vytvorený.", ok: false });
      return;
    }
    setQuizSubmitting(true);
    setQuizResult(null);
    setQuizMsg(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/events/${params.slug}/kviz`, {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: quizDate, teams: validTeams }),
      });
      const data = await res.json();
      if (!res.ok) {
        setQuizMsg({ text: data.error ?? "Chyba pri ukladaní.", ok: false });
        setMsg({ text: data.error ?? "Chyba pri ukladaní.", ok: false });
        return;
      }

      const fresh = await loadEventFromServer(params.slug);
      const savedEvent = fresh ?? (data.event ? normalizeEvent(data.event as QuizEvent) : null);
      const savedQuiz = savedEvent
        ? findQuizResult(savedEvent.pastResults ?? [], normalizeDateKey(quizDate))
        : undefined;
      if (!savedEvent || !savedQuiz?.teams?.length) {
        setQuizMsg({ text: "Kvíz sa nepodarilo uložiť. Skús znova alebo obnov stránku.", ok: false });
        setMsg({ text: "Kvíz sa nepodarilo uložiť. Skús znova alebo obnov stránku.", ok: false });
        return;
      }

      setForm(normalizeEvent(savedEvent));
      setQuizResult(data);
      setQuizTeams(Array.from({ length: 10 }, emptyRow));
      setMsg({ text: "Kvíz uložený do ligy", ok: true });
      setTab("vysledky");
    } catch {
      setQuizMsg({ text: "Sieťová chyba. Skús znova.", ok: false });
      setMsg({ text: "Sieťová chyba. Skús znova.", ok: false });
    } finally {
      setQuizSubmitting(false);
    }
  };

  const [form, setForm] = useState<QuizEvent>({
    slug: "",
    venue: "",
    city: "",
    address: "",
    regionSlug: "prievidza",
    date: "",
    time: "19:00",
    entryFee: 4,
    maxPlayers: 8,
    minPlayers: 2,
    rounds: 4,
    questions: 55,
    durationMinutes: 120,
    active: true,
    leagueActive: true,
    registrationOpen: true,
    imageUrl: "",
    rules: [],
    leagueTable: [],
    pastResults: [],
  });

  useEffect(() => {
    if (!isNew) {
      loadEventFromServer(params.slug).then((ev) => {
        if (ev) setForm(normalizeEvent(ev));
      });
    }
  }, [params.slug, isNew]);

  useEffect(() => {
    if (isNew || (tab !== "liga" && tab !== "vysledky")) return;
    loadEventFromServer(params.slug).then((ev) => {
      if (ev) setForm((current) => mergeFormWithServer(current, normalizeEvent(ev)));
    });
  }, [tab, params.slug, isNew]);

  useEffect(() => {
    if (isNew || !form.venue) return;
    loadRegistrations();
  }, [params.slug, form.venue, isNew]);

  const applyPollAdminData = (data: Record<string, unknown>) => {
    const configOptions = (data.configOptions as string[]) ?? [];
    setPollAdmin({
      config: data.config ? { active: (data.config as { active: boolean; title: string }).active, title: (data.config as { active: boolean; title: string }).title } : null,
      votes: (data.votes as PollAdminState["votes"]) ?? [],
      teamCount: (data.teamCount as number) ?? 0,
      upcomingOptions: (data.upcomingOptions as string[]) ?? [],
      configOptions,
      publicPath: (data.publicPath as string) ?? "",
      storage: (data.storage as PollAdminState["storage"]) ?? "unconfigured",
      publicVisible: (data.publicVisible as boolean) ?? false,
    });
    setPollSelectedDates(configOptions);
  };

  const loadPollAdmin = () => {
    if (isNew || !form.venue) return;
    setPollLoading(true);
    fetch(
      `/api/admin/poll?slug=${encodeURIComponent(params.slug)}&venue=${encodeURIComponent(form.venue)}&_=${Date.now()}`,
      { cache: "no-store" }
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) applyPollAdminData(data);
      })
      .finally(() => setPollLoading(false));
  };

  useEffect(() => {
    if (isNew) return;
    loadPollAdmin();
  }, [params.slug, isNew, form.venue]);

  useEffect(() => {
    if (isNew || tab !== "anketa") return;
    loadPollAdmin();
  }, [tab, params.slug, isNew, form.venue]);

  const togglePollActive = async () => {
    const nextActive = !(pollAdmin?.config?.active ?? false);
    const label = nextActive ? "Zapnúť anketu pre tento podnik?" : "Vypnúť anketu? Verejný odkaz a tlačidlo na stránke podniku zmiznú.";
    if (!confirm(label)) return;

    setPollToggling(true);
    try {
      const res = await fetch("/api/admin/poll", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: params.slug, venue: form.venue, active: nextActive }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ text: data.error ?? "Nepodarilo sa upraviť anketu.", ok: false });
        return;
      }
      applyPollAdminData(data);
      setMsg({ text: nextActive ? "Anketa zapnutá." : "Anketa vypnutá.", ok: true });
    } finally {
      setPollToggling(false);
    }
  };

  const resetPollVotes = async () => {
    if ((pollAdmin?.teamCount ?? 0) === 0) return;
    if (!confirm(`Naozaj vymazať všetky hlasy (${pollAdmin?.teamCount} tímov)? Anketa ostane zapnutá, termíny sa nezmenia.`)) return;

    setPollResetting(true);
    try {
      const res = await fetch(
        `/api/admin/poll?slug=${encodeURIComponent(params.slug)}&venue=${encodeURIComponent(form.venue)}`,
        { method: "DELETE" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ text: data.error ?? "Nepodarilo sa resetovať hlasy.", ok: false });
        return;
      }
      applyPollAdminData(data);
      setMsg({ text: `Vymazané hlasy ${data.removed ?? 0} tímov. Anketa ostáva aktívna.`, ok: true });
    } finally {
      setPollResetting(false);
    }
  };

  const savePollOptions = async (options: string[]) => {
    setPollOptionsSaving(true);
    try {
      const res = await fetch("/api/admin/poll", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: params.slug, venue: form.venue, options }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ text: data.error ?? "Nepodarilo sa uložiť termíny.", ok: false });
        return false;
      }
      applyPollAdminData(data);
      return true;
    } finally {
      setPollOptionsSaving(false);
    }
  };

  const saveSelectedPollDates = async () => {
    const ok = await savePollOptions(pollSelectedDates);
    if (ok) setMsg({ text: `Uložených ${pollSelectedDates.length} termínov.`, ok: true });
  };

  const removePollDate = async (option: string) => {
    const current = pollAdmin?.configOptions ?? [];
    const next = current.filter((entry) => !pollOptionsMatch(entry, option));
    const ok = await savePollOptions(next);
    if (ok) setMsg({ text: "Termín odstránený z ankety.", ok: true });
  };

  const deletePollTeam = async (voteId: string, teamName: string) => {
    if (!confirm(`Naozaj vymazať hlas tímu „${teamName}"?`)) return;
    setDeletingPollTeam(voteId);
    try {
      const res = await fetch(
        `/api/admin/poll?slug=${encodeURIComponent(params.slug)}&voteId=${encodeURIComponent(voteId)}&venue=${encodeURIComponent(form.venue)}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        loadPollAdmin();
        setMsg({ text: "Hlas tímu vymazaný.", ok: true });
      } else {
        setMsg({ text: "Chyba pri mazaní hlasu.", ok: false });
      }
    } finally {
      setDeletingPollTeam(null);
    }
  };

  const deleteRegistration = async (id: string, teamName: string) => {
    if (!confirm(`Naozaj zmazať registráciu tímu „${teamName}"?`)) return;
    setDeletingRegId(id);
    try {
      const res = await fetch(`/api/admin/registrations?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (res.ok) {
        loadRegistrations();
        setMsg({ text: "Registrácia zmazaná", ok: true });
      } else {
        setMsg({ text: "Chyba pri mazaní registrácie", ok: false });
      }
    } finally {
      setDeletingRegId(null);
    }
  };

  const clearAllRegistrations = async () => {
    if (registrations.length === 0) return;
    if (
      !confirm(
        `Naozaj vymazať všetkých ${registrations.length} registrácií pre ${form.venue}? Použi to pred novým kvízom — staré registrácie zmiznú.`
      )
    ) {
      return;
    }
    setClearingRegs(true);
    try {
      const res = await fetch(
        `/api/admin/registrations?slug=${encodeURIComponent(params.slug)}&venue=${encodeURIComponent(form.venue)}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        loadRegistrations();
        setMsg({ text: "Všetky registrácie vymazané", ok: true });
      } else {
        setMsg({ text: "Chyba pri mazaní registrácií", ok: false });
      }
    } finally {
      setClearingRegs(false);
    }
  };

  const set = (key: keyof QuizEvent, value: unknown) => setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    setSaving(true);
    setMsg(null);
    const includeLeagueData = tab === "liga" || tab === "vysledky";
    let toSave: QuizEvent & { _includeLeagueData?: boolean } = { ...form };
    if (includeLeagueData) {
      toSave.leagueTable = sortLeagueTable(toSave.leagueTable ?? []);
      toSave._includeLeagueData = true;
    }
    try {
      const res = await fetch(
        isNew ? "/api/admin/events" : `/api/admin/events/${params.slug}`,
        {
          method: isNew ? "POST" : "PUT",
          cache: "no-store",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(toSave),
        }
      );
      if (res.ok) {
        const fresh = !isNew ? await loadEventFromServer(params.slug) : null;
        if (fresh) {
          setForm(normalizeEvent(fresh));
        } else if (!isNew) {
          const data = await res.json();
          setForm(normalizeEvent(data));
        }
        setMsg({ text: "Uložené!", ok: true });
        if (isNew) router.push("/admin/udalosti");
      } else {
        const err = await res.json();
        setMsg({ text: err.error ?? "Chyba pri ukladaní", ok: false });
      }
    } catch {
      setMsg({ text: "Sieťová chyba pri ukladaní", ok: false });
    } finally {
      setSaving(false);
    }
  };

  const toggleQuizActive = async () => {
    const turningOff = form.active;
    const msg = turningOff
      ? "Naozaj vypnúť tento kvíz? Zmizne z verejného zoznamu kvízov a registrácie."
      : "Naozaj znova zapnúť tento kvíz? Zobrazí sa na webe v najbližších kvízoch.";
    if (!confirm(msg)) return;

    const newActive = !form.active;
    setForm((f) => ({ ...f, active: newActive }));
    if (!isNew) {
      const res = await fetch(`/api/admin/events/${params.slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: newActive, _quizToggle: true }),
      });
      if (res.ok) {
        const data = await res.json();
        setForm(normalizeEvent(data));
        setMsg({ text: newActive ? "Kvíz aktivovaný" : "Kvíz vypnutý", ok: true });
      } else {
        setForm((f) => ({ ...f, active: !newActive }));
        setMsg({ text: "Chyba pri ukladaní", ok: false });
      }
    }
  };

  const toggleRegistrationOpen = async () => {
    const open = form.registrationOpen !== false;
    const newOpen = !open;
    setForm((f) => ({ ...f, registrationOpen: newOpen }));
    if (!isNew) {
      const res = await fetch(`/api/admin/events/${params.slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationOpen: newOpen, _registrationToggle: true }),
      });
      if (res.ok) {
        const data = await res.json();
        setForm(normalizeEvent(data));
        setMsg({
          text: newOpen ? "Registrácie zapnuté" : "Registrácie vypnuté — na webe sa zobrazí „Kvíz je plný“",
          ok: true,
        });
      } else {
        setForm((f) => ({ ...f, registrationOpen: open }));
        setMsg({ text: "Chyba pri ukladaní", ok: false });
      }
    }
  };

  const toggleLeagueActive = async () => {
    const leagueOn = form.leagueActive !== false;
    const msg = leagueOn
      ? "Naozaj vypnúť ligu? Zmizne z verejného zoznamu na /liga."
      : "Naozaj znova zapnúť ligu? Zobrazí sa hneď na /liga.";
    if (!confirm(msg)) return;

    const newActive = !leagueOn;
    setMsg(null);

    try {
      const serverEv = await fetchFreshEvent(params.slug);
      let workingForm = form;
      if (serverEv) {
        workingForm = mergeFormWithServer(form, normalizeEvent(serverEv));
        setForm(workingForm);
      }

      if (newActive && (workingForm.leagueTable.length > 0 || workingForm.pastResults.length > 0)) {
        const saveRes = await fetch(`/api/admin/events/${params.slug}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...workingForm, _includeLeagueData: true }),
        });
        if (saveRes.ok) {
          workingForm = normalizeEvent(await saveRes.json());
          setForm(workingForm);
        }
      }

      setForm((f) => ({ ...f, leagueActive: newActive }));

      const res = await fetch(`/api/admin/events/${params.slug}?_=${Date.now()}`, {
        method: "PUT",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          _leagueToggle: true,
          leagueActive: newActive,
          leagueTable: workingForm.leagueTable,
          pastResults: workingForm.pastResults,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setForm(normalizeEvent(data));
        setMsg({ text: newActive ? "Liga zapnutá" : "Liga vypnutá", ok: true });
      } else {
        setForm((f) => ({ ...f, leagueActive: leagueOn }));
        const err = await res.json().catch(() => ({}));
        const text = err.error ?? `Chyba ${res.status} pri ukladaní ligy`;
        setMsg({ text, ok: false });
      }
    } catch {
      setForm((f) => ({ ...f, leagueActive: leagueOn }));
      setMsg({ text: "Sieťová chyba pri prepínaní ligy", ok: false });
    }
  };

  const recalculateLeague = async (fromQuizzes = false) => {
    if (
      fromQuizzes &&
      !confirm(
        "Prepočítať ligu z kvízov? Detailné kvízy (prezentácia) sa prepočítajú presne. Súhrnné výsledky bez tímov a existujúca tabuľka sa zachovajú — nič sa nevymaže."
      )
    ) {
      return;
    }
    setRecalculating(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/events/${params.slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _recalculateLeague: true, fromQuizzes }),
      });
      if (res.ok) {
        const data = await res.json();
        setForm(normalizeEvent(data));
        setMsg({ text: fromQuizzes ? "Liga prepočítaná z kvízov" : "Poradie prepočítané (nezapísané kvízy doplnené)", ok: true });
      } else {
        const err = await res.json().catch(() => ({}));
        setMsg({ text: err.error ?? "Chyba pri prepočítaní", ok: false });
      }
    } catch {
      setMsg({ text: "Sieťová chyba pri prepočítaní", ok: false });
    } finally {
      setRecalculating(false);
    }
  };

  const restoreLeagueFromSeed = async () => {
    if (
      !confirm(
        "Obnoviť ligu zo zálohy v projekte? Prepíše aktuálnu ligovú tabuľku a súhrnné výsledky (napr. 14 tímov pre Lili Cafe)."
      )
    ) {
      return;
    }
    setRecalculating(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/events/${params.slug}/restore-league`, {
        method: "POST",
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setForm(normalizeEvent(data.event));
        setMsg({
          text: `Liga obnovená (${data.restoredTeams} tímov, ${data.restoredResults} výsledkov). Skontroluj tabuľku a klikni Uložiť zmeny, ak treba.`,
          ok: true,
        });
      } else {
        setMsg({ text: data.error ?? "Obnova ligy zlyhala.", ok: false });
      }
    } catch {
      setMsg({ text: "Sieťová chyba pri obnove ligy.", ok: false });
    } finally {
      setRecalculating(false);
    }
  };

  const resetLeague = async () => {
    if (!confirm("Naozaj resetovať ligu? Vymaže sa tabuľka aj výsledky a liga zmizne z verejného zoznamu na /liga.")) return;
    const updated = { ...form, leagueTable: [], pastResults: [], leagueActive: false };
    setForm(updated);
    if (!isNew) {
      const res = await fetch(`/api/admin/events/${params.slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...updated, _resetLeague: true }),
      });
      if (res.ok) {
        const data = await res.json();
        setForm(normalizeEvent(data));
        setMsg({ text: "Liga resetovaná a skrytá z verejného zoznamu", ok: true });
      } else {
        setMsg({ text: "Chyba pri resetovaní ligy", ok: false });
      }
    }
  };

  const deleteQuiz = async (quizId: string) => {
    if (!confirm("Naozaj zmazať tento kvíz? Odstránia sa aj ligové body.")) return;
    const res = await fetch(`/api/admin/events/${params.slug}/kviz/${encodeURIComponent(quizId)}`, {
      method: "DELETE",
      cache: "no-store",
    });
    if (res.ok) {
      const ev = await loadEventFromServer(params.slug);
      if (ev) setForm(normalizeEvent(ev));
      setMsg({ text: "Kvíz zmazaný", ok: true });
    } else {
      setMsg({ text: "Chyba pri mazaní kvízu", ok: false });
    }
  };

  const deleteEvent = async () => {
    if (
      !confirm(
        "Naozaj navždy zmazať celú udalosť vrátane ligy a výsledkov? Toto nie je reset hlasov ankety."
      )
    ) {
      return;
    }
    const typed = prompt(`Pre potvrdenie napíš presne slug: ${params.slug}`);
    if (typed?.trim() !== params.slug) {
      setMsg({ text: "Zmazanie zrušené — slug nesedí.", ok: false });
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/events/${params.slug}`, { method: "DELETE" });
      if (!res.ok) {
        setMsg({ text: "Nepodarilo sa zmazať udalosť.", ok: false });
        return;
      }
      router.push("/admin/udalosti");
    } finally {
      setDeleting(false);
    }
  };

  const addLeagueRow = () =>
    set("leagueTable", [
      ...form.leagueTable,
      { rank: form.leagueTable.length + 1, teamName: "", points: 0, quizzesPlayed: 0 },
    ]);

  const updateLeagueRow = (i: number, key: keyof LeagueEntry, val: string | number) => {
    const updated = form.leagueTable.map((r, idx) => (idx === i ? { ...r, [key]: val } : r));
    set("leagueTable", key === "points" || key === "quizzesPlayed" ? sortLeagueTable(updated) : updated);
  };

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
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: fd,
        credentials: "same-origin",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ text: data.error ?? "Nepodarilo sa nahrať fotku.", ok: false });
        return;
      }
      if (data.url) {
        set("imageUrl", data.url);
        setMsg({ text: "Fotka nahraná. Klikni Uložiť zmeny.", ok: true });
      }
    } catch {
      setMsg({ text: "Chyba pri nahrávaní fotky.", ok: false });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const tabClass = (t: Tab) =>
    `px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
      tab === t ? "bg-brand-orange text-brand-btn-fg shadow-sm" : "text-brand-muted hover:text-brand-text hover:bg-brand-hover"
    }`;

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/admin/udalosti" className="text-brand-muted-light hover:text-brand-text transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h1 className="font-display text-3xl text-brand-text tracking-wide">
            {isNew ? "Nová udalosť" : form.venue || params.slug}
          </h1>
          {!isNew && (
            <>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${form.active ? "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300" : "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"}`}>
                {form.active ? "Kvíz aktívny" : "Kvíz vypnutý"}
              </span>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${form.leagueActive !== false ? "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300" : "bg-brand-surface text-brand-muted border border-brand-border"}`}>
                {form.leagueActive !== false ? "Liga zapnutá" : "Liga vypnutá"}
              </span>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${pollAdmin?.config?.active ? "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300" : "bg-brand-surface text-brand-muted border border-brand-border"}`}>
                {pollAdmin?.config?.active ? "Anketa zapnutá" : "Anketa vypnutá"}
              </span>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${form.registrationOpen !== false ? "bg-teal-100 text-teal-800 dark:bg-teal-950/50 dark:text-teal-300" : "bg-brand-surface text-brand-muted border border-brand-border"}`}>
                {form.registrationOpen !== false ? "Registrácie otvorené" : "Registrácie zatvorené"}
              </span>
            </>
          )}
        </div>
        {!isNew && (
          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
            <button
              onClick={toggleRegistrationOpen}
              className={`flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl border transition-colors ${
                form.registrationOpen !== false
                  ? "border-brand-border text-brand-muted hover:bg-brand-hover"
                  : "border-teal-500/40 text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/30 hover:bg-teal-100 dark:hover:bg-teal-950/50"
              }`}
            >
              {form.registrationOpen !== false ? <UserX className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
              {form.registrationOpen !== false ? "Vypnúť registrácie" : "Zapnúť registrácie"}
            </button>
            <button
              onClick={toggleQuizActive}
              className={`flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl border transition-colors ${
                form.active
                  ? "border-brand-orange/40 text-brand-orange-readable bg-brand-tint/40 hover:bg-brand-tint"
                  : "border-green-500/40 text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950/30 hover:bg-green-100 dark:hover:bg-green-950/50"
              }`}
            >
              {form.active ? <PauseCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
              {form.active ? "Vypnúť kvíz" : "Zapnúť kvíz"}
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-1 bg-brand-surface p-1 rounded-xl mb-6 w-fit flex-wrap border border-brand-border">
        <button className={tabClass("pridat")} onClick={() => setTab("pridat")}>+ Pridať kvíz</button>
        <button className={tabClass("info")} onClick={() => setTab("info")}>Základné info</button>
        <button className={tabClass("liga")} onClick={() => setTab("liga")}>Liga ({form.leagueTable.length})</button>
        <button className={tabClass("vysledky")} onClick={() => setTab("vysledky")}>Výsledky ({form.pastResults.length})</button>
        <button className={tabClass("registracie")} onClick={() => setTab("registracie")}>Registrácie ({registrations.length})</button>
        <button className={tabClass("anketa")} onClick={() => setTab("anketa")}>Anketa ({pollAdmin?.teamCount ?? 0})</button>
        <button className={tabClass("pravidla")} onClick={() => setTab("pravidla")}>Pravidlá ({(form.rules ?? []).length})</button>
      </div>

      {tab === "info" && (
        <div className="bg-brand-card rounded-2xl border border-brand-border p-6 space-y-5">
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
            <label className="label">Región (SEO)</label>
            <select className="input" value={form.regionSlug ?? "prievidza"} onChange={(e) => set("regionSlug", e.target.value)}>
              {REGION_OPTIONS.map((region) => (
                <option key={region.slug} value={region.slug}>
                  {region.name}
                </option>
              ))}
            </select>
            <p className="text-brand-muted text-xs mt-1">Určuje URL stránky kvízu, napr. /kvizy/prievidza/...</p>
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
                <div className="relative w-24 h-16 rounded-xl overflow-hidden border border-brand-border shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={form.imageUrl} alt="" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-24 h-16 rounded-xl border-2 border-dashed border-brand-border flex items-center justify-center shrink-0">
                  <ImageIcon className="w-6 h-6 text-brand-muted-light" />
                </div>
              )}
              <label className="btn-outline text-sm py-2 px-4 cursor-pointer">
                <Upload className="w-4 h-4" />
                {uploading ? "Nahrávam..." : "Nahrať fotku"}
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
              </label>
              {form.imageUrl && (
                <button onClick={() => set("imageUrl", "")} className="text-sm text-brand-muted hover:text-red-400 transition-colors">Odstrániť</button>
              )}
            </div>
          </div>
          {isNew && (
            <div>
              <label className="label">Slug (URL identifikátor)</label>
              <input className="input" value={form.slug} onChange={(e) => set("slug", e.target.value)} placeholder="lili-cafe" />
              <p className="text-brand-muted text-xs mt-1">Nechaj prázdne — vygeneruje sa automaticky z názvu podniku</p>
            </div>
          )}
        </div>
      )}

      {tab === "liga" && (
        <div className="bg-brand-card rounded-2xl border border-brand-border p-6">
          {!isNew && (
            <div className="flex flex-wrap gap-3 mb-6 pb-6 border-b border-brand-border">
              <button
                onClick={toggleLeagueActive}
                className={`flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl border transition-colors ${
                  form.leagueActive !== false
                    ? "border-brand-orange/40 text-brand-orange-readable bg-brand-tint/40 hover:bg-brand-tint"
                    : "border-green-500/40 text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950/30 hover:bg-green-100 dark:hover:bg-green-950/50"
                }`}
              >
                {form.leagueActive !== false ? <PauseCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
                {form.leagueActive !== false ? "Vypnúť ligu" : "Zapnúť ligu"}
              </button>
              <button
                onClick={() => recalculateLeague(false)}
                disabled={recalculating || form.leagueTable.length === 0}
                className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-xl border border-brand-border text-brand-muted hover:bg-brand-hover transition-colors disabled:opacity-40"
              >
                <RefreshCw className={`w-4 h-4 ${recalculating ? "animate-spin" : ""}`} />
                Prepočítať poradie
              </button>
              {form.pastResults.length > 0 && (
                <button
                  onClick={() => recalculateLeague(true)}
                  disabled={recalculating}
                  className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-xl border border-brand-border text-brand-muted hover:bg-brand-hover transition-colors disabled:opacity-40"
                >
                  <RefreshCw className={`w-4 h-4 ${recalculating ? "animate-spin" : ""}`} />
                  Prepočítať z kvízov
                </button>
              )}
              <button
                onClick={resetLeague}
                className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Resetovať ligu
              </button>
              {!isNew && hasSeedLeagueBackup(params.slug) && (
                <button
                  onClick={restoreLeagueFromSeed}
                  disabled={recalculating}
                  className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl border border-green-500/40 text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950/30 hover:bg-green-100 dark:hover:bg-green-950/50 transition-colors disabled:opacity-40"
                >
                  <RefreshCw className={`w-4 h-4 ${recalculating ? "animate-spin" : ""}`} />
                  Obnoviť ligu zo zálohy
                </button>
              )}
            </div>
          )}
          {form.leagueTable.length > 0 && (
            <div className="grid grid-cols-[2rem_1fr_6rem_6rem_2rem] gap-2 text-xs text-brand-muted mb-2 px-0.5">
              <span>#</span>
              <span>Názov tímu</span>
              <span className="text-center">Body</span>
              <span className="text-center">Kvízy</span>
              <span />
            </div>
          )}
          <div className="space-y-2 mb-4">
            {form.leagueTable.length === 0 && (
              <p className="text-brand-muted text-sm py-4 text-center">
                Zatiaľ žiadne tímy v lige. Použi zelené tlačidlo „Obnoviť ligu zo zálohy“ vyššie.
              </p>
            )}
            {form.leagueTable.map((row, i) => (
              <div key={i} className="grid grid-cols-[2rem_1fr_6rem_6rem_2rem] gap-2 items-center">
                <span className="text-brand-muted text-sm text-center">{row.rank}.</span>
                <input className="input text-sm py-2" value={row.teamName} onChange={(e) => updateLeagueRow(i, "teamName", e.target.value)} placeholder="Názov tímu" />
                <input className="input text-sm py-2 text-center" type="number" value={row.points} onChange={(e) => updateLeagueRow(i, "points", Number(e.target.value))} />
                <input className="input text-sm py-2 text-center" type="number" value={row.quizzesPlayed} onChange={(e) => updateLeagueRow(i, "quizzesPlayed", Number(e.target.value))} />
                <button onClick={() => removeLeagueRow(i)} className="text-brand-muted-light hover:text-red-400 transition-colors">
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
        <div className="bg-brand-card rounded-2xl border border-brand-border p-6">
          <p className="text-brand-muted text-sm mb-6">
            Zadaj výsledky kvízu. Prázdne riadky sa automaticky ignorujú.
          </p>
          <div className="mb-6">
            <label className="label">Dátum kvízu</label>
            <div className="max-w-xs">
              <AdminDatePicker value={quizDate} onChange={setQuizDate} />
            </div>
          </div>
          <div className="grid gap-3 mb-2 pr-9" style={{ gridTemplateColumns: `1fr repeat(${form.rounds || 4}, 5rem) 4.5rem` }}>
            <span className="text-xs text-brand-muted uppercase tracking-wider font-medium">Tím</span>
            {Array.from({ length: form.rounds || 4 }, (_, i) => (
              <span key={i} className="text-xs text-brand-muted uppercase tracking-wider font-medium text-center">K{i + 1}</span>
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
                <button onClick={() => removeQuizTeam(i)} className="text-brand-muted-light hover:text-red-400 transition-colors flex justify-center">
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
            <div className="bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-xl p-5">
              <div className="font-semibold text-green-700 dark:text-green-300 mb-3">Kvíz uložený! Víťaz: {quizResult.winnerTeam}</div>
              <div className="space-y-1.5">
                {quizResult.ligaPoints.sort((a, b) => b.total - a.total).map((t, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <span className="text-brand-muted w-5 text-right font-medium">{i + 1}.</span>
                    <span className="flex-1 font-semibold text-brand-text">{t.name}</span>
                    <span className="text-brand-muted">{t.total} bodov</span>
                    <span className="text-brand-orange font-bold">+{t.liga} lig. b.</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "registracie" && !isNew && (
        <div className="bg-brand-card rounded-2xl border border-brand-border p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-6 border-b border-brand-border">
            <p className="text-brand-muted text-sm">
              {form.registrationOpen !== false
                ? "Registrácie sú otvorené — nové tímy sa môžu prihlásiť cez web."
                : "Registrácie sú zatvorené — na webe sa zobrazí „Kvíz je plný“."}
            </p>
            <button
              onClick={toggleRegistrationOpen}
              className={`flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl border transition-colors ${
                form.registrationOpen !== false
                  ? "border-brand-border text-brand-muted hover:bg-brand-hover"
                  : "border-teal-500/40 text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/30"
              }`}
            >
              {form.registrationOpen !== false ? <UserX className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
              {form.registrationOpen !== false ? "Vypnúť registrácie" : "Zapnúť registrácie"}
            </button>
          </div>
          {registrations.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-6 border-b border-brand-border">
              <p className="text-brand-muted text-sm">
                {registrations.length} {registrations.length === 1 ? "registrácia" : "registrácií"} pre tento podnik
              </p>
              <button
                onClick={clearAllRegistrations}
                disabled={clearingRegs}
                className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                {clearingRegs ? "Mažem..." : "Vymazať všetky registrácie"}
              </button>
            </div>
          )}
          {regsLoading && <p className="text-brand-muted text-sm">Načítavam...</p>}
          {!regsLoading && registrations.length === 0 && (
            <p className="text-brand-muted text-sm py-8 text-center">Zatiaľ žiadne registrácie pre tento podnik.</p>
          )}
          <div className="space-y-3">
            {registrations.map((r) => (
              <div
                key={r.id}
                className="rounded-xl border border-brand-border p-4 flex items-start justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="font-display text-xl text-brand-text">{r.teamName}</div>
                  <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-brand-muted">
                    <span className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" />
                      {r.players} hráčov
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5" />
                      {r.phone}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      {r.createdAt}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => deleteRegistration(r.id, r.teamName)}
                  disabled={deletingRegId === r.id}
                  className="shrink-0 flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  {deletingRegId === r.id ? "..." : "Zmazať"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "anketa" && !isNew && (
        <div className="bg-brand-card rounded-2xl border border-brand-border p-6 space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4 pb-6 border-b border-brand-border">
            <div>
              <h2 className="font-display text-2xl text-brand-text tracking-wide">Letná anketa</h2>
              <p className="text-brand-muted text-sm mt-2 max-w-xl">
                Nezáväžné hlasovanie o termín. Zapni len u podnikov, kde chceš zisťovať letný záujem. U ostatných nechaj vypnuté.
              </p>
            </div>
            <button
              onClick={togglePollActive}
              disabled={pollToggling}
              className={`flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl border transition-colors disabled:opacity-50 ${
                pollAdmin?.config?.active
                  ? "border-brand-orange/40 text-brand-orange-readable bg-brand-tint/40 hover:bg-brand-tint"
                  : "border-green-500/40 text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950/30 hover:bg-green-100 dark:hover:bg-green-950/50"
              }`}
            >
              {pollAdmin?.config?.active ? <PauseCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
              {pollToggling ? "Ukladám…" : pollAdmin?.config?.active ? "Vypnúť anketu" : "Zapnúť anketu"}
            </button>
          </div>

          {pollLoading && <p className="text-brand-muted text-sm">Načítavam…</p>}

          {!pollLoading && pollAdmin && (
            <>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="rounded-xl border border-brand-border bg-brand-surface/50 p-4">
                  <div className="text-brand-muted text-xs uppercase tracking-wider mb-1">Stav</div>
                  <div className="font-semibold text-brand-text">
                    {pollAdmin.config?.active ? "Anketa je zapnutá" : "Anketa je vypnutá"}
                  </div>
                </div>
                <div className="rounded-xl border border-brand-border bg-brand-surface/50 p-4">
                  <div className="text-brand-muted text-xs uppercase tracking-wider mb-1">Hlasy</div>
                  <div className="font-semibold text-brand-text">
                    {pollAdmin.teamCount} {pollAdmin.teamCount === 1 ? "tím" : "tímov"}
                  </div>
                </div>
                <div className="rounded-xl border border-brand-border bg-brand-surface/50 p-4">
                  <div className="text-brand-muted text-xs uppercase tracking-wider mb-1">Uložisko</div>
                  <div className="font-semibold text-brand-text">
                    {pollAdmin.storage === "supabase"
                      ? "Supabase"
                      : pollAdmin.storage === "local"
                        ? "Lokálny súbor (dev)"
                        : "Nenastavené"}
                  </div>
                </div>
                <div className="rounded-xl border border-brand-border bg-brand-surface/50 p-4">
                  <div className="text-brand-muted text-xs uppercase tracking-wider mb-1">Verejná stránka</div>
                  <div className={`font-semibold ${pollAdmin.publicVisible ? "text-green-700 dark:text-green-300" : "text-amber-700 dark:text-amber-300"}`}>
                    {pollAdmin.publicVisible ? "Viditeľná" : "Skrytá"}
                  </div>
                </div>
              </div>

              {!pollAdmin.publicVisible && pollAdmin.config?.active && (
                <p className="text-amber-700 dark:text-amber-300 text-sm rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 px-4 py-3">
                  {pollAdmin.teamCount > 0
                    ? "Hlasy sú uložené v admin rozhraní, ale verejná anketa nie je viditeľná. Pridaj aspoň jeden budúci termín v kalendári nižšie."
                    : "Anketa je zapnutá, ale verejná stránka sa zobrazí až po pridaní aspoň jedného budúceho termínu v kalendári."}
                </p>
              )}

              <div className="rounded-2xl border border-brand-border p-5 space-y-4">
                <div>
                  <h3 className="font-display text-xl text-brand-text tracking-wide">Termíny v ankete</h3>
                  <p className="text-brand-muted text-sm mt-2">
                    Otvor kalendár, označ viac termínov naraz (napr. všetky piatky) a potom klikni „Uložiť termíny“.
                  </p>
                </div>

                <PollAdminMultiDatePicker
                  selected={pollSelectedDates}
                  onChange={setPollSelectedDates}
                  onSave={saveSelectedPollDates}
                  saving={pollOptionsSaving}
                />

                {pollAdmin.configOptions.length > 0 ? (
                  <div className="space-y-2 pt-2 border-t border-brand-border">
                    <p className="text-brand-muted text-xs uppercase tracking-wider">Uložené termíny</p>
                    {pollAdmin.configOptions.map((option) => {
                      const isPast = !pollAdmin.upcomingOptions.some((entry) => pollOptionsMatch(entry, option));
                      return (
                        <div
                          key={option}
                          className="flex items-center justify-between gap-3 rounded-xl border border-brand-border px-4 py-3"
                        >
                          <div>
                            <div className="font-medium text-brand-text">{formatPollOptionLabel(option)}</div>
                            {isPast && (
                              <div className="text-xs text-brand-muted mt-1">
                                Minulý termín — na verejnej stránke sa nezobrazí.
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => removePollDate(option)}
                            disabled={pollOptionsSaving}
                            className="shrink-0 flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors disabled:opacity-50"
                          >
                            <Trash2 className="w-4 h-4" />
                            Odstrániť
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-brand-muted text-sm py-4 text-center border border-dashed border-brand-border rounded-xl">
                    Zatiaľ žiadne uložené termíny. Vyber dátumy v kalendári a ulož ich naraz.
                  </p>
                )}
              </div>

              {pollAdmin.config?.active && pollAdmin.publicPath && (
                <a
                  href={pollAdmin.publicPath}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-brand-orange-readable hover:underline"
                >
                  <ExternalLink className="w-4 h-4" />
                  Otvoriť verejnú anketu
                </a>
              )}

              {pollAdmin.config?.active && pollAdmin.upcomingOptions.length > 0 && (
                <p className="text-brand-muted text-sm">
                  Aktívne termíny na webe: {pollAdmin.upcomingOptions.map(formatPollOptionLabel).join(" · ")}
                </p>
              )}

              {pollAdmin.teamCount > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <p className="text-brand-muted text-sm">Zoznam tímov, ktoré už hlasovali</p>
                  <button
                    onClick={resetPollVotes}
                    disabled={pollResetting}
                    className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    {pollResetting ? "Mažem…" : "Resetovať hlasy"}
                  </button>
                </div>
              )}

              {pollAdmin.teamCount === 0 && !pollLoading && (
                <p className="text-brand-muted text-sm py-6 text-center">Zatiaľ žiadne hlasy.</p>
              )}

              <div className="space-y-3">
                {pollAdmin.votes.map((vote) => (
                  <div
                    key={vote.id}
                    className="rounded-xl border border-brand-border p-4 flex items-start justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <div className="font-display text-xl text-brand-text">{vote.teamName}</div>
                      <div className="text-brand-muted text-sm mt-2">
                        {vote.optionDates.map(formatPollOptionLabel).join(", ")}
                      </div>
                      <div className="text-brand-muted text-xs mt-1 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        {vote.updatedAt}
                      </div>
                    </div>
                    <button
                      onClick={() => deletePollTeam(vote.id, vote.teamName)}
                      disabled={deletingPollTeam === vote.id}
                      className="shrink-0 flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                      {deletingPollTeam === vote.id ? "..." : "Zmazať hlas"}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {tab === "pravidla" && (
        <div className="bg-brand-card rounded-2xl border border-brand-border p-6">
          <p className="text-brand-muted text-sm mb-4">Každé pravidlo je jeden riadok.</p>
          <div className="space-y-2 mb-4">
            {(form.rules ?? []).length === 0 && (
              <p className="text-brand-muted text-sm py-4 text-center">Žiadne pravidlá. Pridaj prvé.</p>
            )}
            {(form.rules ?? []).map((rule, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-brand-muted-light text-sm w-5 text-right shrink-0">{i + 1}.</span>
                <input
                  className="input text-sm py-2 flex-1"
                  value={rule}
                  onChange={(e) => updateRule(i, e.target.value)}
                  placeholder="Text pravidla..."
                />
                <button onClick={() => removeRule(i)} className="text-brand-muted-light hover:text-red-400 transition-colors shrink-0">
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
        <div className="bg-brand-card rounded-2xl border border-brand-border p-6">
          <div className="space-y-2 mb-4">
            {form.pastResults.length === 0 && (
              <p className="text-brand-muted text-sm py-4 text-center">Zatiaľ žiadne výsledky.</p>
            )}
            {[...form.pastResults].reverse().map((r, i) => {
              const hasDetail = !!(r.teams && r.teams.length > 0);
              const quizKey = encodeURIComponent(quizResultKey(r));
              return (
                <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${hasDetail ? "border-brand-border hover:border-brand-orange hover:bg-brand-warm group" : "border-brand-border bg-brand-surface"}`}>
                  {hasDetail ? (
                    <>
                      <Link href={`/admin/udalosti/${params.slug}/kviz/${quizKey}`} className="flex items-center gap-3 flex-1">
                        <span className="font-semibold text-brand-text text-sm">{r.date}</span>
                        <span className="text-brand-muted text-sm">víťaz</span>
                        <span className="font-semibold text-brand-orange text-sm">{r.winnerTeam}</span>
                        <span className="ml-auto text-brand-muted text-sm">{r.points} bodov</span>
                        <ChevronLeft className="w-4 h-4 text-brand-muted-light group-hover:text-brand-orange rotate-180 transition-all" />
                      </Link>
                      <button
                        onClick={() => deleteQuiz(quizResultKey(r))}
                        className="text-brand-muted-light hover:text-red-500 transition-colors shrink-0 p-1"
                        title="Zmazať kvíz"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="font-semibold text-brand-muted text-sm">{r.date}</span>
                      <span className="text-brand-muted text-sm">víťaz</span>
                      <span className="font-semibold text-brand-muted text-sm">{r.winnerTeam}</span>
                      <span className="ml-auto text-brand-muted text-sm">{r.points} bodov</span>
                      <button
                        onClick={() => {
                          if (!confirm("Naozaj zmazať tento výsledok?")) return;
                          removeResult(form.pastResults.length - 1 - i);
                        }}
                        className="text-brand-muted-light hover:text-red-500 transition-colors shrink-0 p-1"
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
            <button
              onClick={deleteEvent}
              disabled={deleting}
              className="text-sm text-red-400 hover:text-red-600 transition-colors flex items-center gap-1.5"
              title="Natrvalo zmazať celý podnik z databázy"
            >
              <Trash2 className="w-4 h-4" />
              {deleting ? "Mažem..." : "Zmazať celú udalosť (podnik)"}
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          {msg && (
            <span className={`text-sm font-medium ${msg.ok ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>
              {msg.text}
            </span>
          )}
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
