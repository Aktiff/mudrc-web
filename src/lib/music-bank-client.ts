"use client";

import {
  normalizeMusicBankItem,
  parseMusicBankList,
  type MusicBankItem,
  type NewMusicBankItemInput,
} from "@/lib/music-bank";

export async function fetchMusicBankFromServer(): Promise<MusicBankItem[]> {
  try {
    const res = await fetch(`/api/admin/music-bank?_=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return parseMusicBankList(data.tracks);
  } catch {
    return [];
  }
}

export async function addMusicBankItemAsync(input: NewMusicBankItemInput): Promise<MusicBankItem> {
  const res = await fetch("/api/admin/music-bank", {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : "Uloženie zlyhalo");
  }
  const track = normalizeMusicBankItem(data.track);
  if (!track) throw new Error("Neplatná odpoveď servera");
  return track;
}

export async function removeMusicBankItemAsync(id: string): Promise<void> {
  await fetch(`/api/admin/music-bank?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    cache: "no-store",
  });
}
