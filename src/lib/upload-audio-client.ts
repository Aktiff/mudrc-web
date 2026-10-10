"use client";

import {
  MAX_AUDIO_BYTES,
  MAX_AUDIO_SERVER_BYTES,
} from "@/lib/audio-upload";
import { uploadFileInParts } from "@/lib/upload-media-parts-client";

function messageFromUploadResponse(res: Response, text: string): string {
  try {
    const data = JSON.parse(text) as { error?: string };
    if (data.error) return data.error;
  } catch {
    /* not JSON */
  }
  if (res.status === 413) {
    return "Súbor je príliš veľký na upload cez server.";
  }
  if (text.trim()) return text.slice(0, 280);
  return `Nepodarilo sa nahrať audio (HTTP ${res.status}).`;
}

async function uploadViaServer(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/admin/upload?kind=audio", {
    method: "POST",
    body: formData,
    credentials: "same-origin",
    signal: AbortSignal.timeout(45000),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(messageFromUploadResponse(res, text));
  }
  let data: { url?: string } = {};
  try {
    data = JSON.parse(text) as { url?: string };
  } catch {
    throw new Error("Neplatná odpoveď servera pri nahrávaní.");
  }
  if (!data.url) throw new Error("Server nevrátil URL súboru.");
  return data.url;
}

export async function uploadAudioFileClient(file: File): Promise<string> {
  if (file.size > MAX_AUDIO_BYTES) {
    throw new Error("Maximálna veľkosť audio je 20 MB — skráť ukážku na ~30 s.");
  }

  try {
    if (file.size > MAX_AUDIO_SERVER_BYTES) {
      return await uploadFileInParts("audio", file);
    }
    return await uploadViaServer(file);
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new Error("Nahrávanie trvalo príliš dlho. Skús to znova.");
    }
    throw error;
  }
}
