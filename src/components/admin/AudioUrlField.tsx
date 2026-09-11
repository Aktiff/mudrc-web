"use client";

import { useState } from "react";
import { Upload, X } from "lucide-react";

type Props = {
  label?: string;
  value: string;
  onChange: (url: string) => void;
  onUploadError?: (message: string) => void;
  onUploadSuccess?: (message: string) => void;
};

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

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/upload?kind=audio", {
        method: "POST",
        body: formData,
        credentials: "same-origin",
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok) {
        onUploadError?.(data.error ?? "Nepodarilo sa nahrať audio.");
        return;
      }
      if (data.url) {
        onChange(data.url);
        onUploadSuccess?.("Audio nahrané.");
      }
    } catch {
      onUploadError?.("Chyba pri nahrávaní audio.");
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
      {value.trim() && (
        <audio controls src={value} className="w-full max-w-md mt-2" preload="metadata" />
      )}
    </div>
  );
}
