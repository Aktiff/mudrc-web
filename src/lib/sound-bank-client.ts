"use client";

import {
  formatSoundClipDuplicateMessage,
  normalizeSoundBankItem,
  parseSoundBankList,
  type NewSoundBankItemInput,
  type SoundBankItem,
  type SoundClipDuplicateConflict,
} from "@/lib/sound-bank";

export async function fetchSoundBankFromServer(): Promise<SoundBankItem[]> {
  try {
    const res = await fetch(`/api/admin/sound-bank?_=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return parseSoundBankList(data.clips);
  } catch {
    return [];
  }
}

export async function findSoundClipConflictAsync(
  label: string,
  answer: string
): Promise<SoundClipDuplicateConflict | null> {
  try {
    const params = new URLSearchParams({ label, answer });
    const res = await fetch(`/api/admin/sound-bank?${params.toString()}`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { conflict?: SoundClipDuplicateConflict | null };
    return data.conflict ?? null;
  } catch {
    return null;
  }
}

export async function addSoundBankItemAsync(input: NewSoundBankItemInput): Promise<SoundBankItem> {
  const res = await fetch("/api/admin/sound-bank", {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : "Uloženie zlyhalo");
  }
  const clip = normalizeSoundBankItem(data.clip);
  if (!clip) throw new Error("Neplatná odpoveď servera");
  return clip;
}

export async function removeSoundBankItemAsync(id: string): Promise<void> {
  await fetch(`/api/admin/sound-bank?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    cache: "no-store",
  });
}

export { formatSoundClipDuplicateMessage };
