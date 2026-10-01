"use client";

import {
  MAX_VIDEO_BYTES,
  MAX_VIDEO_SERVER_BYTES,
} from "@/lib/video-upload";
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
  return `Nepodarilo sa nahrať video (HTTP ${res.status}).`;
}

async function uploadViaServer(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/admin/upload?kind=video", {
    method: "POST",
    body: formData,
    credentials: "same-origin",
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

export async function uploadVideoFileClient(file: File): Promise<string> {
  if (file.size > MAX_VIDEO_BYTES) {
    throw new Error("Maximálna veľkosť videa je 80 MB — skráť ukážku alebo zníž rozlíšenie.");
  }

  if (file.size > MAX_VIDEO_SERVER_BYTES) {
    return uploadFileInParts("video", file);
  }

  return uploadViaServer(file);
}
