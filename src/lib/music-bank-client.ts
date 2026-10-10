"use client";

import {
  formatMusicTrackDuplicateMessage,
  normalizeMusicBankItem,
  parseMusicBankList,
  type MusicBankItem,
  type MusicTrackDuplicateConflict,
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

function tooSlow(): Error {
  return new Error("Nahrávanie trvalo príliš dlho. Skús to znova.");
}

function asUploadError(error: unknown, fallback: string): Error {
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) return tooSlow();
  return error instanceof Error ? error : new Error(fallback);
}

export async function findMusicTrackConflictAsync(
  artist: string,
  title: string
): Promise<MusicTrackDuplicateConflict | null> {
  try {
    const params = new URLSearchParams({ artist, title });
    const res = await fetch(`/api/admin/music-bank?${params.toString()}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { conflict?: MusicTrackDuplicateConflict | null };
    return data.conflict ?? null;
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) throw tooSlow();
    return null;
  }
}

export async function addMusicBankItemAsync(
  input: NewMusicBankItemInput,
  ignoreQuizId?: string
): Promise<MusicBankItem> {
  let res: Response;
  try {
    res = await fetch("/api/admin/music-bank", {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, ...(ignoreQuizId ? { ignoreQuizId } : {}) }),
      signal: AbortSignal.timeout(20000),
    });
  } catch (error) {
    throw asUploadError(error, "Uloženie zlyhalo");
  }
  const data = await res.json();
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : "Uloženie zlyhalo");
  }
  const track = normalizeMusicBankItem(data.track);
  if (!track) throw new Error("Neplatná odpoveď servera");
  return track;
}

export async function updateMusicBankItemAsync(
  id: string,
  input: NewMusicBankItemInput
): Promise<MusicBankItem> {
  const res = await fetch("/api/admin/music-bank", {
    method: "PATCH",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, ...input }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : "Uloženie zlyhalo");
  }
  const track = normalizeMusicBankItem(data.track);
  if (!track) throw new Error("Neplatná odpoveď servera");
  return track;
}

export async function refreshMusicTrackAutoTagsAsync(id: string): Promise<MusicBankItem> {
  const res = await fetch("/api/admin/music-bank", {
    method: "PATCH",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, refreshAutoTags: true }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : "Obnova tagov zlyhala");
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
