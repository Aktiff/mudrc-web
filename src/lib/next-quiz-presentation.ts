/** Predvolený termín najbližšieho kvízu: o 14 dní o 20:00 (lokálny čas). */
export function defaultNextQuizDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  d.setHours(20, 0, 0, 0);
  return d;
}

export function toDatetimeLocalValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${h}:${min}`;
}

export function parseDatetimeLocalValue(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Napr. „Alipub - sobota 26.9. o 20:00“ */
export function formatNextQuizLine(venue: string, date: Date): string {
  const place = venue.trim() || "—";
  const weekday = date.toLocaleDateString("sk-SK", { weekday: "long" });
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const time = date.toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" });
  return `${place} - ${weekday} ${day}.${month}. o ${time}`;
}
