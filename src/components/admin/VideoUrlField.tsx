"use client";

import { useState } from "react";
import { Upload, X } from "lucide-react";
import { uploadVideoFileClient } from "@/lib/upload-video-client";

type Props = {
  label?: string;
  value: string;
  onChange: (url: string) => void;
  onUploadError?: (message: string) => void;
  onUploadSuccess?: (message: string) => void;
};

export default function VideoUrlField({
  label = "Video ukážka",
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
      const url = await uploadVideoFileClient(file);
      onChange(url);
      onUploadSuccess?.("Video nahrané do úložiska.");
    } catch (err) {
      const text = err instanceof Error ? err.message : "Chyba pri nahrávaní videa.";
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
          placeholder="https://…mp4 alebo nahraj súbor"
        />
        <label className="btn-outline text-sm py-2 px-3 inline-flex items-center gap-2 cursor-pointer shrink-0">
          <Upload className="w-4 h-4" />
          {uploading ? "Nahrávam…" : "Nahrať"}
          <input
            type="file"
            accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.m4v"
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
        MP4 alebo WEBM do Supabase Storage. Krátke filmové ukážky (~30–90 s) odporúčané.
      </p>
      {value.trim() && (
        <video controls src={value} className="w-full max-w-xl mt-2 rounded-xl border border-brand-border" preload="metadata" />
      )}
    </div>
  );
}
