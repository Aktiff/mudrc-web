"use client";

import {
  formatVideoClipDuplicateMessage,
  normalizeVideoBankItem,
  parseVideoBankList,
  type NewVideoBankItemInput,
  type VideoBankItem,
  type VideoClipDuplicateConflict,
} from "@/lib/video-bank";

export async function fetchVideoBankFromServer(): Promise<VideoBankItem[]> {
  try {
    const res = await fetch(`/api/admin/video-bank?_=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return parseVideoBankList(data.clips);
  } catch {
    return [];
  }
}

export async function findVideoClipConflictAsync(
  label: string,
  answer: string
): Promise<VideoClipDuplicateConflict | null> {
  try {
    const params = new URLSearchParams({ label, answer });
    const res = await fetch(`/api/admin/video-bank?${params.toString()}`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { conflict?: VideoClipDuplicateConflict | null };
    return data.conflict ?? null;
  } catch {
    return null;
  }
}

export async function addVideoBankItemAsync(input: NewVideoBankItemInput): Promise<VideoBankItem> {
  const res = await fetch("/api/admin/video-bank", {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : "Uloženie zlyhalo");
  }
  const clip = normalizeVideoBankItem(data.clip);
  if (!clip) throw new Error("Neplatná odpoveď servera");
  return clip;
}

export async function removeVideoBankItemAsync(id: string): Promise<void> {
  await fetch(`/api/admin/video-bank?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    cache: "no-store",
  });
}

export { formatVideoClipDuplicateMessage };
