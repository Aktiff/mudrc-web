"use client";

import { useState } from "react";
import { Upload, X } from "lucide-react";
import { MAX_AUDIO_BYTES, MAX_AUDIO_SERVER_BYTES } from "@/lib/audio-upload";

type Props = {
  label?: string;
  value: string;
  onChange: (url: string) => void;
  onUploadError?: (message: string) => void;
  onUploadSuccess?: (message: string) => void;
};

function messageFromUploadResponse(res: Response, text: string): string {
  try {
    const data = JSON.parse(text) as { error?: string };
    if (data.error) return data.error;
  } catch {
    /* not JSON */
  }
  if (res.status === 413) {
    return "Súbor je príliš veľký — skráť ukážku na ~30 s alebo vlož URL.";
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

async function uploadViaBlobClient(file: File): Promise<string> {
  const { upload } = await import("@vercel/blob/client");
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-") || "ukazka.mp3";
  const blob = await upload(`mudrc/audio/${Date.now()}-${safeName}`, file, {
    access: "public",
    handleUploadUrl: "/api/admin/upload/audio",
  });
  if (!blob.url) throw new Error("Blob upload nevrátil URL.");
  return blob.url;
}

export default function AudioUrlField({
  label = "Audio ukážka (~30 s)",
  value,
  onChange,
  onUploadError,
  onUploadSuccess,
}: Props) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_AUDIO_BYTES) {
      onUploadError?.("Maximálna veľkosť audio je 12 MB — skráť ukážku na približne 30 sekúnd.");
      event.target.value = "";
      return;
    }

    setUploading(true);
    try {
      let url: string;
      if (file.size > MAX_AUDIO_SERVER_BYTES) {
        url = await uploadViaBlobClient(file);
      } else {
        try {
          url = await uploadViaServer(file);
        } catch (serverErr) {
          try {
            url = await uploadViaBlobClient(file);
          } catch {
            throw serverErr;
          }
        }
      }
      onChange(url);
      onUploadSuccess?.("Audio nahrané.");
    } catch (err) {
      const text = err instanceof Error ? err.message : "Chyba pri nahrávaní audio.";
      onUploadError?.(text);
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex flex-wrap gap-2">
        <input
          className="input flex-1 min-w-[200px]"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="https://…mp3 alebo nahraj súbor"
        />
        <label className="btn-outline text-sm py-2 px-3 inline-flex items-center gap-2 cursor-pointer shrink-0">
          <Upload className="w-4 h-4" />
          {uploading ? "Nahrávam…" : "Nahrať"}
          <input
            type="file"
            accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/mp4,audio/x-m4a,.mp3,.m4a,.wav,.ogg"
            className="hidden"
            onChange={handleUpload}
            disabled={uploading}
          />
        </label>
        {value.trim() && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="btn-outline text-sm py-2 px-3 inline-flex items-center gap-1.5 text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-950/30 shrink-0"
          >
            <X className="w-4 h-4" />
            Zrušiť
          </button>
        )}
      </div>
      <p className="text-brand-muted text-xs mt-1.5">
        Odporúčaná dĺžka ~30 s. Veľké MP3 sa nahrávajú priamo do úložiska (nie cez server).
      </p>
      {value.trim() && (
        <audio controls src={value} className="w-full max-w-md mt-2" preload="metadata" />
      )}
    </div>
  );
}
