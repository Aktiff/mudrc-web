"use client";

import {
  guessVideoContentType,
  MAX_VIDEO_BYTES,
  MAX_VIDEO_SERVER_BYTES,
} from "@/lib/video-upload";

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

async function uploadViaSupabaseStorage(file: File): Promise<string> {
  const contentType = guessVideoContentType(file.name, file.type || "");
  const prep = await fetch("/api/admin/upload/video", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      contentType,
      fileSize: file.size,
    }),
  });
  const prepText = await prep.text();
  if (!prep.ok) {
    throw new Error(messageFromUploadResponse(prep, prepText));
  }

  let signed: {
    signedUrl?: string;
    token?: string;
    publicUrl?: string;
    contentType?: string;
  } = {};
  try {
    signed = JSON.parse(prepText) as typeof signed;
  } catch {
    throw new Error("Neplatná odpoveď pri príprave uploadu.");
  }
  if (!signed.signedUrl || !signed.publicUrl) {
    throw new Error("Úložisko nevrátilo upload URL.");
  }

  const uploadType = signed.contentType || contentType;
  let uploadRes = await fetch(signed.signedUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": uploadType },
  });

  if (!uploadRes.ok && signed.token) {
    uploadRes = await fetch(signed.signedUrl, {
      method: "PUT",
      body: file,
      headers: {
        "Content-Type": uploadType,
        Authorization: `Bearer ${signed.token}`,
      },
    });
  }

  if (!uploadRes.ok) {
    throw new Error(`Upload do úložiska zlyhal (HTTP ${uploadRes.status}).`);
  }

  return signed.publicUrl;
}

export async function uploadVideoFileClient(file: File): Promise<string> {
  if (file.size > MAX_VIDEO_BYTES) {
    throw new Error("Maximálna veľkosť videa je 80 MB — skráť ukážku alebo zníž rozlíšenie.");
  }

  if (file.size > MAX_VIDEO_SERVER_BYTES) {
    return uploadViaSupabaseStorage(file);
  }

  try {
    return await uploadViaServer(file);
  } catch {
    return uploadViaSupabaseStorage(file);
  }
}
