"use client";

import { useMemo, useState } from "react";
import { MessageSquare } from "lucide-react";
import { smsPreview, toSmsNumber } from "@/lib/sms-number";

export type SmsRecipient = { id: string; name: string; phones: string[] };

function countLabel(count: number, one: string, few: string, many: string): string {
  if (count === 1) return `1 ${one}`;
  if (count >= 2 && count <= 4) return `${count} ${few}`;
  return `${count} ${many}`;
}

export function TeamSmsPanel({
  recipients,
  selectedIds,
  onSelectedIds,
}: {
  recipients: SmsRecipient[];
  selectedIds: string[];
  onSelectedIds: (ids: string[]) => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);
  const preview = smsPreview(text);
  const reachable = useMemo(
    () =>
      recipients.filter((team) => team.phones.some((phone) => toSmsNumber(phone))),
    [recipients]
  );
  const selected = reachable.filter((team) => selectedIds.includes(team.id));
  const numbers = selected.reduce(
    (sum, team) => sum + new Set(team.phones.map(toSmsNumber).filter((phone): phone is string => Boolean(phone))).size,
    0
  );

  const send = async () => {
    const message = text.trim();
    if (!message || selected.length === 0 || busy) return;
    const teamLabel = countLabel(selected.length, "tímu", "tímom", "tímom");
    const numberLabel = countLabel(numbers, "číslo", "čísla", "čísel");
    if (!confirm(`Poslať túto SMS ${teamLabel} (${numberLabel})?`)) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/sms", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          recipients: selected.flatMap((team) => team.phones.map((phone) => ({ name: team.name, phone }))),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        sent?: number;
        failed?: { name: string; error: string }[];
      };
      if (!res.ok) {
        setNotice({ text: data.error || "SMS sa nepodarilo odoslať.", ok: false });
        return;
      }
      const failed = data.failed ?? [];
      if (failed.length === 0) {
        setNotice({ text: `SMS odišla (${data.sent ?? numbers}).`, ok: true });
        setText("");
        onSelectedIds([]);
        return;
      }
      const names = Array.from(new Set(failed.map((item) => `${item.name}: ${item.error}`))).join(" ");
      setNotice({
        text: `Odoslané: ${data.sent ?? 0}. Neodoslané: ${names}`,
        ok: (data.sent ?? 0) > 0,
      });
    } catch {
      setNotice({ text: "Sieťová chyba pri odosielaní SMS.", ok: false });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-brand-border bg-brand-surface/40 p-4 mb-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-brand-text inline-flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-brand-orange" />
          SMS označeným tímom
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            className="text-sm font-semibold text-brand-text"
            onClick={() => onSelectedIds(reachable.map((team) => team.id))}
            disabled={reachable.length === 0}
          >
            Označiť všetky s číslom
          </button>
          <button
            type="button"
            className="text-sm font-semibold text-brand-muted"
            onClick={() => onSelectedIds([])}
            disabled={selectedIds.length === 0}
          >
            Zrušiť výber
          </button>
        </div>
      </div>
      <textarea
        className="input w-full min-h-[88px] text-sm"
        maxLength={preview.max}
        placeholder="Text správy, napríklad pripomenutie termínu kvízu."
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-brand-muted">
          {countLabel(selected.length, "tím", "tímy", "tímov")}
          {" · "}
          {countLabel(numbers, "číslo", "čísla", "čísel")}
          {text.length > 0 ? ` · ${text.length} znakov · ${preview.parts} SMS na číslo` : ""}
        </p>
        <button
          type="button"
          onClick={() => void send()}
          disabled={busy || !text.trim() || numbers === 0}
          className="text-sm font-semibold px-4 py-2 rounded-xl bg-brand-orange text-white disabled:opacity-50"
        >
          {busy ? "Posielam..." : "Poslať SMS"}
        </button>
      </div>
      {notice ? (
        <p className={`text-sm ${notice.ok ? "text-teal-700 dark:text-teal-300" : "text-red-600 dark:text-red-400"}`}>
          {notice.text}
        </p>
      ) : (
        <p className="text-xs text-brand-muted">Správa ide na každé uložené číslo označeného tímu. Rovnaké číslo dostane SMS len raz.</p>
      )}
    </div>
  );
}
