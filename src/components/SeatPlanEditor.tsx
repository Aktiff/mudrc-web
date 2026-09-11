"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Armchair,
  ChevronLeft,
  Copy,
  ExternalLink,
  Plus,
  Printer,
  RotateCcw,
  RotateCw,
  Trash2,
  Users,
} from "lucide-react";
import SeatPlanCanvas from "@/components/SeatPlanCanvas";
import {
  assignedReservationKeys,
  clampPercent,
  createFixture,
  createTable,
  layoutTablesFromTeams,
  nextTableNumber,
  parsePlayerCount,
  seatsForPeople,
  tableSizeForSeats,
  waiterSharePath,
  type SeatFixtureKind,
  type SeatPlan,
  type SeatPlanTable,
  type SeatTableShape,
} from "@/lib/seat-plan";

type EventOption = { slug: string; venue: string; date: string };
type Registration = { id: string; eventSlug: string; venue: string; teamName: string; players: string };

type SaveState = "idle" | "pending" | "saving" | "saved" | "error";

const TABLE_PRESETS: { label: string; seats: number; shape: SeatTableShape }[] = [
  { label: "Okrúhly 4", seats: 4, shape: "round" },
  { label: "Okrúhly 6", seats: 6, shape: "round" },
  { label: "Okrúhly 8", seats: 8, shape: "round" },
  { label: "Hranatý 6", seats: 6, shape: "rect" },
  { label: "Hranatý 8", seats: 8, shape: "rect" },
  { label: "Hranatý 10", seats: 10, shape: "rect" },
];

const FIXTURE_PRESETS: { label: string; kind: SeatFixtureKind }[] = [
  { label: "Bar", kind: "bar" },
  { label: "Vchod", kind: "door" },
  { label: "Moderátor", kind: "stage" },
  { label: "WC", kind: "wc" },
];

export default function SeatPlanEditor({ planId }: { planId: string }) {
  const [plan, setPlan] = useState<SeatPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedKind, setSelectedKind] = useState<"table" | "fixture" | null>(null);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [manualName, setManualName] = useState("");
  const [manualPeople, setManualPeople] = useState("4");
  const [copyMsg, setCopyMsg] = useState("");
  const pendingRef = useRef<SeatPlan | null>(null);
  const savingRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const skipSaveRef = useRef(true);

  const flushSave = useCallback(async () => {
    if (savingRef.current) return;
    const payload = pendingRef.current;
    if (!payload) return;
    pendingRef.current = null;
    savingRef.current = true;
    setSaveState("saving");
    try {
      const res = await fetch(`/api/admin/seat-plans/${payload.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("save failed");
      setSaveState("saved");
    } catch {
      pendingRef.current = payload;
      setSaveState("error");
    } finally {
      savingRef.current = false;
      if (pendingRef.current) void flushSave();
    }
  }, []);

  const queueSave = useCallback(
    (next: SeatPlan) => {
      pendingRef.current = next;
      setSaveState("pending");
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        void flushSave();
      }, 700);
    },
    [flushSave]
  );

  const updatePlan = useCallback(
    (updater: (current: SeatPlan) => SeatPlan) => {
      setPlan((current) => {
        if (!current) return current;
        const next = updater(current);
        if (!skipSaveRef.current) queueSave(next);
        return next;
      });
    },
    [queueSave]
  );

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`/api/admin/seat-plans/${planId}?_=${Date.now()}`, { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/admin/events", { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([planData, eventsData]) => {
        if (cancelled) return;
        if (!planData?.id) {
          setPlan(null);
          return;
        }
        skipSaveRef.current = true;
        setPlan(planData as SeatPlan);
        setEvents(
          (eventsData.events ?? []).map((event: EventOption) => ({
            slug: event.slug,
            venue: event.venue,
            date: event.date,
          }))
        );
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          window.setTimeout(() => {
            skipSaveRef.current = false;
          }, 0);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [planId]);

  useEffect(() => {
    if (!plan?.eventSlug && !plan?.venue) {
      setRegistrations([]);
      return;
    }
    const params = new URLSearchParams();
    if (plan.eventSlug) params.set("slug", plan.eventSlug);
    if (plan.venue) params.set("venue", plan.venue);
    fetch(`/api/register?${params}&_=${Date.now()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setRegistrations(d.registrations ?? []))
      .catch(() => setRegistrations([]));
  }, [plan?.eventSlug, plan?.venue]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!plan || !selectedId) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) return;
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteSelected();
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowRight" || event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
        const dx = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
        const dy = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
        nudgeSelected(dx, dy);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, selectedId, selectedKind]);

  useEffect(() => {
    const onLeave = (event: BeforeUnloadEvent) => {
      if (pendingRef.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, []);

  const selectedTable = plan?.tables.find((table) => table.id === selectedId) ?? null;
  const selectedFixture = plan?.fixtures.find((fixture) => fixture.id === selectedId) ?? null;

  const assigned = useMemo(() => (plan ? assignedReservationKeys(plan) : new Set<string>()), [plan]);
  const unassigned = registrations.filter((reg) => !assigned.has(reg.teamName.trim().toLocaleLowerCase("sk")));
  const peopleCount = plan?.tables.reduce((sum, table) => sum + (table.people || 0), 0) ?? 0;

  const waiterUrl = plan ? `${typeof window !== "undefined" ? window.location.origin : ""}${waiterSharePath(plan.shareToken)}` : "";

  function addTable(seats: number, shape: SeatTableShape) {
    if (!plan) return;
    const offset = plan.tables.length;
    updatePlan((current) => ({
      ...current,
      tables: [
        ...current.tables,
        createTable({
          seats,
          shape,
          number: nextTableNumber(current.tables),
          x: 40 + (offset % 4) * 6,
          y: 40 + Math.floor(offset / 4) * 6,
        }),
      ],
    }));
  }

  function addFixture(kind: SeatFixtureKind) {
    updatePlan((current) => ({
      ...current,
      fixtures: [...current.fixtures, createFixture(kind, 50, 50)],
    }));
  }

  function addManualReservation() {
    const name = manualName.trim();
    if (!name || !plan) return;
    const people = parsePlayerCount(manualPeople) || 4;
    const seats = seatsForPeople(people);
    const offset = plan.tables.length;
    updatePlan((current) => ({
      ...current,
      tables: [
        ...current.tables,
        createTable({
          seats,
          people,
          reservation: name,
          number: nextTableNumber(current.tables),
          x: 38 + (offset % 4) * 7,
          y: 38 + Math.floor(offset / 4) * 8,
        }),
      ],
    }));
    setManualName("");
  }

  function placeTeamOnNewTable(reg: Registration) {
    const people = parsePlayerCount(reg.players) || 4;
    const seats = seatsForPeople(people);
    updatePlan((current) => ({
      ...current,
      tables: [
        ...current.tables,
        createTable({
          seats,
          people,
          reservation: reg.teamName,
          number: nextTableNumber(current.tables),
          x: 36 + (current.tables.length % 4) * 8,
          y: 36 + Math.floor(current.tables.length / 4) * 8,
        }),
      ],
    }));
  }

  function assignTeamToSelected(reg: Registration) {
    if (!selectedTable) {
      placeTeamOnNewTable(reg);
      return;
    }
    const people = parsePlayerCount(reg.players) || 4;
    patchTable(selectedTable.id, {
      reservation: reg.teamName,
      people,
      seats: Math.max(selectedTable.seats, seatsForPeople(people)),
    });
  }

  function layoutFromUnassigned() {
    if (unassigned.length === 0) return;
    updatePlan((current) => {
      const extras = layoutTablesFromTeams(
        unassigned.map((reg) => ({ name: reg.teamName, people: parsePlayerCount(reg.players) || 4 }))
      );
      const numbered = extras.reduce<SeatPlanTable[]>((acc, table) => {
        acc.push({ ...table, number: nextTableNumber([...current.tables, ...acc]) });
        return acc;
      }, []);
      return { ...current, tables: [...current.tables, ...numbered] };
    });
  }

  function replaceWithRegistrationLayout() {
    if (registrations.length === 0) return;
    if (plan?.tables.some((table) => table.reservation) && !confirm("Nahradiť aktuálne stoly stolmi z registrácií?")) return;
    updatePlan((current) => ({
      ...current,
      tables: layoutTablesFromTeams(
        registrations.map((reg) => ({ name: reg.teamName, people: parsePlayerCount(reg.players) || 4 }))
      ),
    }));
  }

  function patchTable(id: string, patch: Partial<SeatPlanTable>) {
    updatePlan((current) => ({
      ...current,
      tables: current.tables.map((table) => {
        if (table.id !== id) return table;
        const next = { ...table, ...patch };
        if (patch.seats != null || patch.shape != null) {
          const size = tableSizeForSeats(next.seats, next.shape);
          next.w = size.w;
          next.h = size.h;
        }
        return next;
      }),
    }));
  }

  function deleteSelected() {
    if (!selectedId) return;
    updatePlan((current) => ({
      ...current,
      tables: selectedKind === "table" ? current.tables.filter((table) => table.id !== selectedId) : current.tables,
      fixtures: selectedKind === "fixture" ? current.fixtures.filter((fixture) => fixture.id !== selectedId) : current.fixtures,
    }));
    setSelectedId(null);
    setSelectedKind(null);
  }

  function nudgeSelected(dx: number, dy: number) {
    if (!selectedId || !selectedKind) return;
    updatePlan((current) => ({
      ...current,
      tables:
        selectedKind === "table"
          ? current.tables.map((table) =>
              table.id === selectedId ? { ...table, x: clampPercent(table.x + dx), y: clampPercent(table.y + dy) } : table
            )
          : current.tables,
      fixtures:
        selectedKind === "fixture"
          ? current.fixtures.map((fixture) =>
              fixture.id === selectedId
                ? { ...fixture, x: clampPercent(fixture.x + dx), y: clampPercent(fixture.y + dy) }
                : fixture
            )
          : current.fixtures,
    }));
  }

  function rotateSelected(delta: number) {
    if (!selectedId || !selectedKind) return;
    updatePlan((current) => ({
      ...current,
      tables:
        selectedKind === "table"
          ? current.tables.map((table) => (table.id === selectedId ? { ...table, rotation: table.rotation + delta } : table))
          : current.tables,
      fixtures:
        selectedKind === "fixture"
          ? current.fixtures.map((fixture) =>
              fixture.id === selectedId ? { ...fixture, rotation: fixture.rotation + delta } : fixture
            )
          : current.fixtures,
    }));
  }

  async function copyWaiterLink() {
    if (!waiterUrl) return;
    try {
      await navigator.clipboard.writeText(waiterUrl);
      setCopyMsg("Odkaz skopírovaný");
    } catch {
      setCopyMsg(waiterUrl);
    }
    window.setTimeout(() => setCopyMsg(""), 2500);
  }

  async function shareWaiterLink() {
    if (!plan) return;
    const url = waiterUrl;
    const title = `${plan.venue || "Kvíz"} — zasadací poriadok`;
    if (navigator.share) {
      try {
        await navigator.share({ title, url, text: title });
        return;
      } catch {
        /* user cancelled or share failed — fall through to copy */
      }
    }
    await copyWaiterLink();
  }

  if (loading) {
    return <p className="text-brand-muted text-sm">Načítavam zasadací…</p>;
  }

  if (!plan) {
    return (
      <div>
        <p className="text-brand-muted text-sm mb-4">Tento zasadací poriadok sa nenašiel.</p>
        <Link href="/admin/zasadacie" className="btn-outline text-sm py-2 px-4">
          Späť na zoznam
        </Link>
      </div>
    );
  }

  const saveLabel =
    saveState === "saving"
      ? "Ukladám…"
      : saveState === "pending"
        ? "Zmeny…"
        : saveState === "error"
          ? "Uloženie zlyhalo"
          : saveState === "saved"
            ? "Uložené"
            : " ";

  return (
    <div className="w-full">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <Link href="/admin/zasadacie" className="text-brand-muted-light hover:text-brand-text">
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <Armchair className="h-5 w-5 text-brand-orange" />
            <h1 className="font-display text-3xl tracking-wide text-brand-text">Zasadací poriadok</h1>
          </div>
          <p className="text-sm text-brand-muted">
            {plan.tables.length} stolov · {peopleCount} ľudí · {saveLabel}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void copyWaiterLink()} className="btn-outline py-2 px-4 text-sm">
            <Copy className="h-4 w-4" /> Kopírovať odkaz
          </button>
          <button type="button" onClick={() => void shareWaiterLink()} className="btn-outline py-2 px-4 text-sm">
            <ExternalLink className="h-4 w-4" /> Poslať čašníkovi
          </button>
          <Link href={waiterSharePath(plan.shareToken)} target="_blank" className="btn-primary py-2 px-4 text-sm">
            <Printer className="h-4 w-4" /> Náhľad / tlač
          </Link>
        </div>
      </div>
      {copyMsg && <p className="mb-3 text-sm text-green-700 dark:text-green-300">{copyMsg}</p>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Názov</label>
              <input className="input" value={plan.title} onChange={(e) => updatePlan((c) => ({ ...c, title: e.target.value }))} />
            </div>
            <div>
              <label className="label">Podnik</label>
              <input className="input" value={plan.venue} onChange={(e) => updatePlan((c) => ({ ...c, venue: e.target.value }))} />
            </div>
            <div>
              <label className="label">Dátum</label>
              <input className="input" value={plan.date} onChange={(e) => updatePlan((c) => ({ ...c, date: e.target.value }))} placeholder="11.4.2026" />
            </div>
            <div>
              <label className="label">Prepojiť s udalosťou</label>
              <select
                className="input"
                value={plan.eventSlug}
                onChange={(e) => {
                  const slug = e.target.value;
                  const event = events.find((item) => item.slug === slug);
                  updatePlan((c) => ({
                    ...c,
                    eventSlug: slug,
                    venue: event?.venue || c.venue,
                    date: event?.date || c.date,
                    title: event ? `Zasadací — ${event.venue}` : c.title,
                  }));
                }}
              >
                <option value="">— bez udalosti —</option>
                {events.map((event) => (
                  <option key={event.slug} value={event.slug}>
                    {event.venue} ({event.date})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {TABLE_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => addTable(preset.seats, preset.shape)}
                className="rounded-xl border border-brand-border bg-brand-card px-3 py-2 text-xs font-semibold text-brand-text hover:border-brand-orange"
              >
                <Plus className="mr-1 inline h-3.5 w-3.5" />
                {preset.label}
              </button>
            ))}
            {FIXTURE_PRESETS.map((preset) => (
              <button
                key={preset.kind}
                type="button"
                onClick={() => addFixture(preset.kind)}
                className="rounded-xl border border-dashed border-brand-border px-3 py-2 text-xs font-semibold text-brand-muted hover:border-brand-orange hover:text-brand-text"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <SeatPlanCanvas
            plan={plan}
            selectedId={selectedId}
            interactive
            onSelect={(id, kind) => {
              setSelectedId(id);
              setSelectedKind(kind);
            }}
            onMove={(id, kind, x, y) => {
              updatePlan((current) => ({
                ...current,
                tables:
                  kind === "table"
                    ? current.tables.map((table) =>
                        table.id === id ? { ...table, x: clampPercent(x), y: clampPercent(y) } : table
                      )
                    : current.tables,
                fixtures:
                  kind === "fixture"
                    ? current.fixtures.map((fixture) =>
                        fixture.id === id ? { ...fixture, x: clampPercent(x), y: clampPercent(y) } : fixture
                      )
                    : current.fixtures,
              }));
            }}
          />
          <p className="text-xs text-brand-muted">Ťahaj stoly myšou. Šípky posunú výber, Delete zmaže. Odkaz pre čašníka funguje aj bez prihlásenia.</p>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-brand-border bg-brand-card p-4">
            <h2 className="font-display text-xl tracking-wide text-brand-text">Výber</h2>
            {!selectedTable && !selectedFixture && (
              <p className="mt-2 text-sm text-brand-muted">Klikni na stôl alebo značku v miestnosti.</p>
            )}
            {selectedTable && (
              <div className="mt-3 space-y-3">
                <div>
                  <label className="label">Číslo stola</label>
                  <input className="input" value={selectedTable.number} onChange={(e) => patchTable(selectedTable.id, { number: e.target.value })} />
                </div>
                <div>
                  <label className="label">Rezervácia / tím</label>
                  <input
                    className="input"
                    value={selectedTable.reservation}
                    onChange={(e) => patchTable(selectedTable.id, { reservation: e.target.value })}
                    placeholder="názov tímu alebo meno"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label">Ľudí</label>
                    <input
                      className="input"
                      type="number"
                      min={0}
                      value={selectedTable.people}
                      onChange={(e) => patchTable(selectedTable.id, { people: Math.max(0, Number(e.target.value) || 0) })}
                    />
                  </div>
                  <div>
                    <label className="label">Stoličky</label>
                    <input
                      className="input"
                      type="number"
                      min={2}
                      value={selectedTable.seats}
                      onChange={(e) => patchTable(selectedTable.id, { seats: Math.max(2, Number(e.target.value) || 2) })}
                    />
                  </div>
                </div>
                <div>
                  <label className="label">Tvar</label>
                  <select
                    className="input"
                    value={selectedTable.shape}
                    onChange={(e) => patchTable(selectedTable.id, { shape: e.target.value as SeatTableShape })}
                  >
                    <option value="round">Okrúhly</option>
                    <option value="rect">Hranatý</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button type="button" className="btn-outline flex-1 py-2 text-sm" onClick={() => rotateSelected(-15)}>
                    <RotateCcw className="h-4 w-4" />
                  </button>
                  <button type="button" className="btn-outline flex-1 py-2 text-sm" onClick={() => rotateSelected(15)}>
                    <RotateCw className="h-4 w-4" />
                  </button>
                  <button type="button" className="btn-outline py-2 px-3 text-sm text-red-600" onClick={deleteSelected}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
            {selectedFixture && (
              <div className="mt-3 space-y-3">
                <div>
                  <label className="label">Popis</label>
                  <input
                    className="input"
                    value={selectedFixture.label}
                    onChange={(e) =>
                      updatePlan((current) => ({
                        ...current,
                        fixtures: current.fixtures.map((fixture) =>
                          fixture.id === selectedFixture.id ? { ...fixture, label: e.target.value } : fixture
                        ),
                      }))
                    }
                  />
                </div>
                <div className="flex gap-2">
                  <button type="button" className="btn-outline flex-1 py-2 text-sm" onClick={() => rotateSelected(-15)}>
                    <RotateCcw className="h-4 w-4" />
                  </button>
                  <button type="button" className="btn-outline flex-1 py-2 text-sm" onClick={() => rotateSelected(15)}>
                    <RotateCw className="h-4 w-4" />
                  </button>
                  <button type="button" className="btn-outline py-2 px-3 text-sm text-red-600" onClick={deleteSelected}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-brand-border bg-brand-card p-4">
            <h2 className="font-display text-xl tracking-wide text-brand-text">Nová rezervácia</h2>
            <p className="mt-1 text-xs text-brand-muted">Meno hostí alebo názov tímu — pridá sa ako nový stôl.</p>
            <div className="mt-3 space-y-2">
              <input className="input" placeholder="napr. Kvízáci / Novák" value={manualName} onChange={(e) => setManualName(e.target.value)} />
              <input className="input" type="number" min={1} value={manualPeople} onChange={(e) => setManualPeople(e.target.value)} />
              <button type="button" className="btn-primary w-full justify-center py-2 text-sm" onClick={addManualReservation}>
                <Plus className="h-4 w-4" /> Pridať stôl
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-brand-border bg-brand-card p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-xl tracking-wide text-brand-text">Registrácie</h2>
              <Users className="h-4 w-4 text-brand-muted" />
            </div>
            {registrations.length === 0 ? (
              <p className="mt-2 text-sm text-brand-muted">Vyber udalosť hore a natiahnu sa prihlásené tímy.</p>
            ) : (
              <>
                <div className="mt-3 flex flex-col gap-2">
                  <button type="button" className="btn-outline w-full justify-center py-2 text-xs" onClick={replaceWithRegistrationLayout}>
                    Rozložiť všetky tímy do miestnosti
                  </button>
                  {unassigned.length > 0 && unassigned.length < registrations.length && (
                    <button type="button" className="btn-outline w-full justify-center py-2 text-xs" onClick={layoutFromUnassigned}>
                      Doplniť chýbajúce ({unassigned.length})
                    </button>
                  )}
                </div>
                <div className="mt-3 max-h-72 space-y-2 overflow-auto">
                  {registrations.map((reg) => {
                    const taken = assigned.has(reg.teamName.trim().toLocaleLowerCase("sk"));
                    return (
                      <button
                        key={reg.id}
                        type="button"
                        onClick={() => assignTeamToSelected(reg)}
                        className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${
                          taken
                            ? "border-brand-border text-brand-muted"
                            : "border-brand-orange/40 bg-brand-tint/40 text-brand-text hover:border-brand-orange"
                        }`}
                      >
                        <div className="font-semibold">{reg.teamName}</div>
                        <div className="text-xs opacity-80">
                          {reg.players} hráčov{taken ? " · už pri stole" : selectedTable ? " · dať na vybraný stôl" : " · nový stôl"}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <div className="rounded-2xl border border-brand-border bg-brand-card p-4">
            <label className="label">Poznámka pre čašníka</label>
            <textarea
              className="input min-h-[5rem]"
              value={plan.notes}
              onChange={(e) => updatePlan((c) => ({ ...c, notes: e.target.value }))}
              placeholder="napr. veľké tímy k oknu, bar vľavo od vchodu"
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
