export type SeatTableShape = "round" | "rect";
export type SeatFixtureKind = "bar" | "door" | "stage" | "wc" | "label";

export type SeatPlanTable = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  seats: number;
  people: number;
  shape: SeatTableShape;
  number: string;
  reservation: string;
};

export type SeatPlanFixture = {
  id: string;
  kind: SeatFixtureKind;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  label: string;
};

export type SeatPlan = {
  id: string;
  shareToken: string;
  title: string;
  venue: string;
  eventSlug: string;
  date: string;
  notes: string;
  tables: SeatPlanTable[];
  fixtures: SeatPlanFixture[];
  createdAt: string;
  updatedAt: string;
};

export type SeatPlanSummary = {
  id: string;
  title: string;
  venue: string;
  eventSlug: string;
  date: string;
  tableCount: number;
  assignedCount: number;
  peopleCount: number;
  updatedAt: string;
};

export type SeatTeamInput = {
  name: string;
  people: number;
};

const TABLE_WIDTH_BY_SEATS: Record<number, number> = {
  1: 8,
  2: 10,
  3: 11,
  4: 12,
  5: 13,
  6: 14,
  7: 15,
  8: 16,
  9: 17,
  10: 18,
};

export const MIN_TABLE_SEATS = 1;
export const MAX_TABLE_SEATS = 10;
export const MIN_TABLE_SIZE = 6;
export const MAX_TABLE_SIZE = 48;

export function parsePlayerCount(value: string | number | null | undefined): number {
  const n = parseInt(String(value ?? "").replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function clampSeatCount(value: number): number {
  if (!Number.isFinite(value)) return 4;
  return Math.min(MAX_TABLE_SEATS, Math.max(MIN_TABLE_SEATS, Math.round(value)));
}

export function seatsForPeople(people: number): number {
  return clampSeatCount(Math.max(1, people));
}

export function clampTableSize(value: number): number {
  return clampPercent(value, MIN_TABLE_SIZE, MAX_TABLE_SIZE);
}

export function tableSizeForSeats(seats: number, shape: SeatTableShape, vertical = false): { w: number; h: number } {
  const clamped = clampSeatCount(seats);
  const w = TABLE_WIDTH_BY_SEATS[clamped] ?? Math.min(22, 7 + clamped);
  if (shape === "round") return { w, h: w };
  const h = clamped >= 9 ? 11 : clamped >= 6 ? 10 : clamped >= 3 ? 9 : 8;
  const rect = { w: clamped >= 6 ? w + 4 : w + 1, h };
  if (vertical) return { w: rect.h, h: rect.w };
  return rect;
}

export function isTableVertical(table: Pick<SeatPlanTable, "shape" | "w" | "h">): boolean {
  return table.shape === "rect" && table.h > table.w + 0.4;
}

export function flipTableOrientation(table: SeatPlanTable): { w: number; h: number } {
  if (table.shape === "round") return { w: table.w, h: table.w };
  return { w: table.h, h: table.w };
}

export function scaleTableSize(table: SeatPlanTable, factor: number): { w: number; h: number } {
  const w = clampTableSize(table.w * factor);
  if (table.shape === "round") return { w, h: w };
  return { w, h: clampTableSize(table.h * factor) };
}

export function suggestedShape(seats: number): SeatTableShape {
  return seats >= 8 ? "rect" : "round";
}

export function newId(): string {
  return crypto.randomUUID();
}

export function newShareToken(): string {
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function clampPercent(value: number, min = 4, max = 96): number {
  if (!Number.isFinite(value)) return 50;
  return Math.min(max, Math.max(min, value));
}

export function defaultFixtures(): SeatPlanFixture[] {
  return [
    { id: newId(), kind: "stage", x: 50, y: 9, w: 28, h: 10, rotation: 0, label: "Moderátor" },
    { id: newId(), kind: "bar", x: 9, y: 48, w: 10, h: 34, rotation: 0, label: "Bar" },
    { id: newId(), kind: "door", x: 50, y: 94, w: 16, h: 8, rotation: 0, label: "Vchod" },
  ];
}

export function emptySeatPlan(partial?: Partial<SeatPlan>): SeatPlan {
  const now = new Date().toISOString();
  return {
    id: partial?.id || newId(),
    shareToken: partial?.shareToken || newShareToken(),
    title: partial?.title?.trim() || "Zasadací poriadok",
    venue: partial?.venue?.trim() || "",
    eventSlug: partial?.eventSlug?.trim() || "",
    date: partial?.date?.trim() || "",
    notes: partial?.notes?.trim() || "",
    tables: partial?.tables ?? [],
    fixtures: partial?.fixtures ?? defaultFixtures(),
    createdAt: partial?.createdAt || now,
    updatedAt: partial?.updatedAt || now,
  };
}

function asNumber(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function normalizeTable(raw: unknown, index: number): SeatPlanTable | null {
  if (!raw || typeof raw !== "object") return null;
  const table = raw as Partial<SeatPlanTable>;
  const seats = clampSeatCount(asNumber(table.seats, 4));
  const shape: SeatTableShape = table.shape === "rect" ? "rect" : "round";
  const size = tableSizeForSeats(seats, shape);
  return {
    id: asString(table.id) || newId(),
    x: clampPercent(asNumber(table.x, 50)),
    y: clampPercent(asNumber(table.y, 50)),
    w: clampTableSize(asNumber(table.w, size.w)),
    h: clampTableSize(asNumber(table.h, size.h)),
    rotation: asNumber(table.rotation, 0),
    seats,
    people: Math.max(0, Math.round(asNumber(table.people, 0))),
    shape,
    number: asString(table.number) || String(index + 1),
    reservation: asString(table.reservation).trim(),
  };
}

export function normalizeFixture(raw: unknown): SeatPlanFixture | null {
  if (!raw || typeof raw !== "object") return null;
  const fixture = raw as Partial<SeatPlanFixture>;
  const kind: SeatFixtureKind =
    fixture.kind === "bar" || fixture.kind === "door" || fixture.kind === "stage" || fixture.kind === "wc" || fixture.kind === "label"
      ? fixture.kind
      : "label";
  return {
    id: asString(fixture.id) || newId(),
    kind,
    x: clampPercent(asNumber(fixture.x, 50)),
    y: clampPercent(asNumber(fixture.y, 50)),
    w: clampPercent(asNumber(fixture.w, 14), 6, 50),
    h: clampPercent(asNumber(fixture.h, 10), 5, 50),
    rotation: asNumber(fixture.rotation, 0),
    label: asString(fixture.label).trim() || defaultFixtureLabel(kind),
  };
}

export function defaultFixtureLabel(kind: SeatFixtureKind): string {
  if (kind === "bar") return "Bar";
  if (kind === "door") return "Vchod";
  if (kind === "stage") return "Moderátor";
  if (kind === "wc") return "WC";
  return "";
}

export function defaultFixtureSize(kind: SeatFixtureKind): { w: number; h: number } {
  if (kind === "bar") return { w: 10, h: 32 };
  if (kind === "door") return { w: 16, h: 8 };
  if (kind === "stage") return { w: 26, h: 10 };
  if (kind === "wc") return { w: 10, h: 10 };
  return { w: 16, h: 8 };
}

export function normalizeSeatPlan(raw: unknown): SeatPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const plan = raw as Partial<SeatPlan>;
  const id = asString(plan.id);
  const shareToken = asString(plan.shareToken);
  if (!id || !shareToken) return null;
  const tables = Array.isArray(plan.tables)
    ? plan.tables.map(normalizeTable).filter((table): table is SeatPlanTable => table !== null)
    : [];
  const fixtures = Array.isArray(plan.fixtures)
    ? plan.fixtures.map(normalizeFixture).filter((fixture): fixture is SeatPlanFixture => fixture !== null)
    : [];
  return {
    id,
    shareToken,
    title: asString(plan.title).trim() || "Zasadací poriadok",
    venue: asString(plan.venue).trim(),
    eventSlug: asString(plan.eventSlug).trim(),
    date: asString(plan.date).trim(),
    notes: asString(plan.notes).trim(),
    tables,
    fixtures,
    createdAt: asString(plan.createdAt) || new Date().toISOString(),
    updatedAt: asString(plan.updatedAt) || new Date().toISOString(),
  };
}

export function toSeatPlanSummary(plan: SeatPlan): SeatPlanSummary {
  return {
    id: plan.id,
    title: plan.title,
    venue: plan.venue,
    eventSlug: plan.eventSlug,
    date: plan.date,
    tableCount: plan.tables.length,
    assignedCount: plan.tables.filter((table) => table.reservation).length,
    peopleCount: plan.tables.reduce((sum, table) => sum + (table.people || 0), 0),
    updatedAt: plan.updatedAt,
  };
}

export function nextTableNumber(tables: SeatPlanTable[]): string {
  const used = new Set(tables.map((table) => table.number));
  let n = 1;
  while (used.has(String(n))) n += 1;
  return String(n);
}

export function createTable(partial: Partial<SeatPlanTable> & { seats?: number; vertical?: boolean }): SeatPlanTable {
  const seats = clampSeatCount(partial.seats ?? 4);
  const shape = partial.shape ?? suggestedShape(seats);
  const size = tableSizeForSeats(seats, shape, Boolean(partial.vertical));
  const w = clampTableSize(partial.w ?? size.w);
  const h = clampTableSize(partial.h ?? (shape === "round" ? w : size.h));
  return {
    id: newId(),
    x: clampPercent(partial.x ?? 50),
    y: clampPercent(partial.y ?? 48),
    w,
    h: shape === "round" ? w : h,
    rotation: partial.rotation ?? 0,
    seats,
    people: Math.max(0, partial.people ?? 0),
    shape,
    number: partial.number ?? "1",
    reservation: partial.reservation?.trim() ?? "",
  };
}

export function createFixture(kind: SeatFixtureKind, x = 50, y = 50): SeatPlanFixture {
  const size = defaultFixtureSize(kind);
  return {
    id: newId(),
    kind,
    x,
    y,
    w: size.w,
    h: size.h,
    rotation: 0,
    label: defaultFixtureLabel(kind),
  };
}

export function layoutTablesFromTeams(teams: SeatTeamInput[]): SeatPlanTable[] {
  const n = teams.length;
  if (n === 0) return [];
  const cols = Math.min(5, Math.max(2, Math.ceil(Math.sqrt(n))));
  const rows = Math.ceil(n / cols);
  const shrink = n >= 8 ? 0.86 : 1;
  return teams.map((team, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const people = Math.max(1, team.people);
    const seats = seatsForPeople(people);
    const table = createTable({
      x: 16 + ((col + 0.5) / cols) * 72,
      y: 22 + ((row + 0.5) / rows) * 62,
      seats,
      people,
      reservation: team.name,
      number: String(index + 1),
    });
    table.w = Math.max(8, table.w * shrink);
    table.h = Math.max(7, table.h * shrink);
    return table;
  });
}

export function duplicateSeatPlan(source: SeatPlan, clearReservations: boolean): SeatPlan {
  const now = new Date().toISOString();
  return {
    ...source,
    id: newId(),
    shareToken: newShareToken(),
    title: clearReservations ? `${source.venue || source.title} — nový večer` : `Kópia: ${source.title}`,
    tables: source.tables.map((table) => ({
      ...table,
      id: newId(),
      reservation: clearReservations ? "" : table.reservation,
      people: clearReservations ? 0 : table.people,
    })),
    fixtures: source.fixtures.map((fixture) => ({ ...fixture, id: newId() })),
    createdAt: now,
    updatedAt: now,
  };
}

export function assignedReservationKeys(plan: SeatPlan): Set<string> {
  return new Set(
    plan.tables
      .map((table) => table.reservation.trim().toLocaleLowerCase("sk"))
      .filter(Boolean)
  );
}

export function formatUpdatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("sk-SK", { dateStyle: "short", timeStyle: "short" });
}

export function waiterSharePath(shareToken: string): string {
  return `/zasadacie/${shareToken}`;
}
