"use client";

import { useRef } from "react";
import {
  clampTableSize,
  isTableVertical,
  ROOM_UNIT_PX,
  type SeatFixtureKind,
  type SeatPlan,
  type SeatPlanFixture,
  type SeatPlanTable,
} from "@/lib/seat-plan";

type SelectedKind = "table" | "fixture";
type ResizeHandle = "nw" | "ne" | "sw" | "se";

type Props = {
  plan: SeatPlan;
  selectedId?: string | null;
  interactive?: boolean;
  variant?: "edit" | "waiter";
  onSelect?: (id: string | null, kind: SelectedKind | null) => void;
  onMove?: (id: string, kind: SelectedKind, x: number, y: number) => void;
  onResize?: (id: string, kind: SelectedKind, w: number, h: number) => void;
};

function chairsForRound(seats: number) {
  return Array.from({ length: seats }, (_, i) => {
    const angle = (i / seats) * 360 - 90;
    const rad = (angle * Math.PI) / 180;
    return {
      left: `${50 + Math.cos(rad) * 56}%`,
      top: `${50 + Math.sin(rad) * 56}%`,
      rotate: `${angle + 90}deg`,
    };
  });
}

function chairsForRect(seats: number, vertical: boolean) {
  const longCount = Math.ceil(seats / 2);
  const shortCount = seats - longCount;
  const chairs: { left: string; top: string; rotate: string }[] = [];
  const place = (count: number, along: "h" | "v", edge: number, rotate: string) => {
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0.5 : (i + 1) / (count + 1);
      if (along === "h") {
        chairs.push({ left: `${10 + t * 80}%`, top: `${edge}%`, rotate });
      } else {
        chairs.push({ left: `${edge}%`, top: `${10 + t * 80}%`, rotate });
      }
    }
  };
  if (vertical) {
    place(longCount, "v", 3, "270deg");
    place(shortCount, "v", 97, "90deg");
  } else {
    place(longCount, "h", 3, "0deg");
    place(shortCount, "h", 97, "180deg");
  }
  return chairs;
}

function fixtureClass(kind: SeatFixtureKind, selected: boolean) {
  const ring = selected ? "ring-2 ring-brand-orange z-20" : "";
  if (kind === "bar") return `bg-neutral-800 text-amber-100 border border-neutral-700 ${ring}`;
  if (kind === "door") return `bg-emerald-700 text-white border border-emerald-800 ${ring}`;
  if (kind === "stage") return `bg-brand-orange text-brand-btn-fg border border-amber-700 ${ring}`;
  if (kind === "wc") return `bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-100 border border-sky-300 ${ring}`;
  return `bg-white/50 text-neutral-700 border border-dashed border-neutral-500 ${ring}`;
}

function TableBody({ table, selected, waiter }: { table: SeatPlanTable; selected: boolean; waiter: boolean }) {
  const assigned = Boolean(table.reservation);
  const overflow = table.people > table.seats;
  const chairs =
    table.shape === "round" ? chairsForRound(table.seats) : chairsForRect(table.seats, isTableVertical(table));

  return (
    <div className="relative h-full w-full">
      {chairs.map((chair, i) => (
        <span
          key={i}
          className="pointer-events-none absolute h-2 w-3 rounded-[3px] bg-neutral-600/85 dark:bg-neutral-300/80"
          style={{
            left: chair.left,
            top: chair.top,
            transform: `translate(-50%, -50%) rotate(${chair.rotate})`,
          }}
        />
      ))}
      <div
        className={`absolute inset-[14%] flex flex-col items-center justify-center overflow-hidden px-1 text-center shadow-md ${
          table.shape === "round" ? "rounded-full" : "rounded-2xl"
        } ${
          overflow
            ? "border-2 border-red-500 bg-red-50 text-red-900"
            : assigned
              ? "border border-amber-900/30 bg-gradient-to-b from-amber-50 to-amber-200 text-neutral-900"
              : "border-2 border-dashed border-neutral-500/70 bg-neutral-100/90 text-neutral-500"
        } ${selected ? "ring-2 ring-brand-orange" : ""}`}
      >
        <div className={`font-display leading-none tracking-wide ${waiter ? "text-base sm:text-xl" : "text-sm"}`}>
          {table.number}
        </div>
        <div className={`mt-0.5 line-clamp-2 font-semibold leading-tight ${waiter ? "text-[10px] sm:text-xs" : "text-[10px]"}`}>
          {table.reservation || (waiter ? "—" : "prázdny")}
        </div>
        {table.people > 0 && (
          <div className={`leading-none ${overflow ? "font-bold text-red-700" : "opacity-80"} ${waiter ? "text-[10px]" : "text-[9px]"}`}>
            {table.people} os.
          </div>
        )}
      </div>
    </div>
  );
}

const HANDLE_POS: Record<ResizeHandle, string> = {
  nw: "left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize",
  ne: "right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize",
  sw: "left-0 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize",
  se: "right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize",
};

export default function SeatPlanCanvas({
  plan,
  selectedId = null,
  interactive = false,
  variant = "edit",
  onSelect,
  onMove,
  onResize,
}: Props) {
  const roomRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; kind: SelectedKind; dx: number; dy: number } | null>(null);
  const resizeRef = useRef<{
    id: string;
    kind: SelectedKind;
    round: boolean;
    cx: number;
    cy: number;
  } | null>(null);
  const waiter = variant === "waiter";

  const toPercent = (clientX: number, clientY: number) => {
    const room = roomRef.current;
    if (!room) return { x: 50, y: 50 };
    const rect = room.getBoundingClientRect();
    const width = rect.width || 1;
    const height = rect.height || 1;
    return {
      x: ((clientX - rect.left) / width) * 100,
      y: ((clientY - rect.top) / height) * 100,
    };
  };

  const startDrag = (event: React.PointerEvent, id: string, kind: SelectedKind, x: number, y: number) => {
    if (!interactive || resizeRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    const point = toPercent(event.clientX, event.clientY);
    dragRef.current = { id, kind, dx: point.x - x, dy: point.y - y };
    onSelect?.(id, kind);
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  const startResize = (
    event: React.PointerEvent,
    id: string,
    kind: SelectedKind,
    round: boolean,
    cx: number,
    cy: number
  ) => {
    if (!interactive) return;
    event.preventDefault();
    event.stopPropagation();
    resizeRef.current = { id, kind, round, cx, cy };
    dragRef.current = null;
    onSelect?.(id, kind);
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  const movePointer = (event: React.PointerEvent) => {
    if (!interactive) return;
    const point = toPercent(event.clientX, event.clientY);
    if (resizeRef.current && onResize) {
      const dx = Math.abs(point.x - resizeRef.current.cx);
      const dy = Math.abs(point.y - resizeRef.current.cy);
      const w = clampTableSize(dx * 2);
      const h = resizeRef.current.round ? w : clampTableSize(dy * 2);
      onResize(resizeRef.current.id, resizeRef.current.kind, w, h);
      return;
    }
    if (!dragRef.current) return;
    onMove?.(dragRef.current.id, dragRef.current.kind, point.x - dragRef.current.dx, point.y - dragRef.current.dy);
  };

  const endPointer = () => {
    dragRef.current = null;
    resizeRef.current = null;
  };

  return (
    <div
      ref={roomRef}
      className={`relative shrink-0 overflow-hidden rounded-xl border-[3px] border-neutral-700 ${
        interactive ? "touch-none" : ""
      }`}
      style={{
        width: Math.max(8, plan.roomW) * (variant === "waiter" ? ROOM_UNIT_PX + 4 : ROOM_UNIT_PX),
        height: Math.max(8, plan.roomH) * (variant === "waiter" ? ROOM_UNIT_PX + 4 : ROOM_UNIT_PX),
        backgroundColor: "#d9c7a3",
        backgroundImage:
          "linear-gradient(rgba(80,60,30,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(80,60,30,0.07) 1px, transparent 1px)",
        backgroundSize: "5% 5%",
      }}
      onPointerDown={() => {
        if (interactive) onSelect?.(null, null);
      }}
    >
      {plan.fixtures.map((fixture: SeatPlanFixture) => (
        <div
          key={fixture.id}
          className={`absolute flex items-center justify-center rounded-xl px-1 text-center font-semibold uppercase tracking-wider ${
            interactive ? "cursor-grab active:cursor-grabbing" : ""
          } ${fixtureClass(fixture.kind, selectedId === fixture.id)}`}
          style={{
            left: `${fixture.x}%`,
            top: `${fixture.y}%`,
            width: `${fixture.w}%`,
            height: `${fixture.h}%`,
            transform: `translate(-50%, -50%) rotate(${fixture.rotation}deg)`,
          }}
          onPointerDown={(event) => startDrag(event, fixture.id, "fixture", fixture.x, fixture.y)}
          onPointerMove={movePointer}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
        >
          <span className={`leading-tight ${waiter ? "text-[11px] sm:text-sm" : "text-[10px]"}`}>{fixture.label}</span>
          {interactive && selectedId === fixture.id &&
            (["nw", "ne", "sw", "se"] as ResizeHandle[]).map((handle) => (
              <span
                key={handle}
                className={`absolute z-30 h-3 w-3 rounded-sm border border-white bg-brand-orange shadow ${HANDLE_POS[handle]}`}
                onPointerDown={(event) => startResize(event, fixture.id, "fixture", false, fixture.x, fixture.y)}
                onPointerMove={movePointer}
                onPointerUp={endPointer}
                onPointerCancel={endPointer}
              />
            ))}
        </div>
      ))}

      {plan.tables.map((table: SeatPlanTable) => (
        <div
          key={table.id}
          className={`absolute ${interactive ? "cursor-grab active:cursor-grabbing" : ""}`}
          style={{
            left: `${table.x}%`,
            top: `${table.y}%`,
            width: `${table.w}%`,
            height: table.shape === "round" ? undefined : `${table.h}%`,
            aspectRatio: table.shape === "round" ? "1" : undefined,
            transform: `translate(-50%, -50%) rotate(${table.rotation}deg)`,
          }}
          onPointerDown={(event) => startDrag(event, table.id, "table", table.x, table.y)}
          onPointerMove={movePointer}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
        >
          <TableBody table={table} selected={selectedId === table.id} waiter={waiter} />
          {interactive && selectedId === table.id &&
            (["nw", "ne", "sw", "se"] as ResizeHandle[]).map((handle) => (
              <span
                key={handle}
                className={`absolute z-30 h-3.5 w-3.5 rounded-sm border border-white bg-brand-orange shadow ${HANDLE_POS[handle]}`}
                onPointerDown={(event) => startResize(event, table.id, "table", table.shape === "round", table.x, table.y)}
                onPointerMove={movePointer}
                onPointerUp={endPointer}
                onPointerCancel={endPointer}
              />
            ))}
        </div>
      ))}
    </div>
  );
}
