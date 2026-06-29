"use client";
import { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";

const DAY_LABELS = ["Po", "Ut", "St", "St", "Pi", "So", "Ne"];
const MONTH_LABELS = ["Januar","Februar","Marec","April","Maj","Jun","Jul","August","September","Oktober","November","December"];

function parseDate(val: string): Date | null {
  if (!val) return null;
  const parts = val.split(".");
  if (parts.length !== 3) return null;
  const d = parseInt(parts[0]), m = parseInt(parts[1]) - 1, y = parseInt(parts[2]);
  if (isNaN(d) || isNaN(m) || isNaN(y)) return null;
  return new Date(y, m, d);
}

function formatDate(d: Date): string {
  return `${String(d.getDate()).padStart(2,"0")}.${String(d.getMonth()+1).padStart(2,"0")}.${d.getFullYear()}`;
}

function getWeekdayMon(date: Date): number {
  return (date.getDay() + 6) % 7;
}

export function AdminDatePicker({ value, onChange, placeholder }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const parsed = parseDate(value);
  const today = new Date();
  const [view, setView] = useState<{ year: number; month: number }>({
    year: parsed?.getFullYear() ?? today.getFullYear(),
    month: parsed?.getMonth() ?? today.getMonth(),
  });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const prevMonth = () =>
    setView((v) => v.month === 0 ? { year: v.year - 1, month: 11 } : { ...v, month: v.month - 1 });
  const nextMonth = () =>
    setView((v) => v.month === 11 ? { year: v.year + 1, month: 0 } : { ...v, month: v.month + 1 });

  const firstDay = getWeekdayMon(new Date(view.year, view.month, 1));
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const select = (day: number) => {
    onChange(formatDate(new Date(view.year, view.month, day)));
    setOpen(false);
  };

  const isSelected = (day: number) =>
    !!parsed && parsed.getFullYear() === view.year && parsed.getMonth() === view.month && parsed.getDate() === day;
  const isToday = (day: number) =>
    today.getFullYear() === view.year && today.getMonth() === view.month && today.getDate() === day;

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        <input
          readOnly
          className="input pr-10 cursor-pointer"
          value={value}
          placeholder={placeholder ?? "DD.MM.RRRR"}
          onClick={() => setOpen((o) => !o)}
        />
        <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
      </div>
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 bg-white border border-stone-200 rounded-2xl shadow-xl p-4 w-72">
          <div className="flex items-center justify-between mb-3">
            <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-stone-100 transition-colors">
              <ChevronLeft className="w-4 h-4 text-stone-500" />
            </button>
            <span className="text-sm font-semibold text-stone-700">
              {MONTH_LABELS[view.month]} {view.year}
            </span>
            <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-stone-100 transition-colors">
              <ChevronRight className="w-4 h-4 text-stone-500" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {DAY_LABELS.map((d, i) => (
              <div key={i} className="text-center text-xs text-stone-400 font-medium py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((day, i) => (
              <div key={i} className="aspect-square flex items-center justify-center">
                {day !== null && (
                  <button
                    onClick={() => select(day)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${
                      isSelected(day)
                        ? "bg-brand-orange text-white shadow-sm"
                        : isToday(day)
                        ? "bg-orange-50 text-brand-orange border border-orange-200"
                        : "text-stone-700 hover:bg-stone-100"
                    }`}
                  >
                    {day}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const TIME_OPTIONS: string[] = [];
for (let h = 7; h <= 23; h++) {
  for (let m = 0; m < 60; m += 15) {
    TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
}

export function AdminTimePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
      {TIME_OPTIONS.map((t) => (
        <option key={t} value={t}>{t}</option>
      ))}
    </select>
  );
}
