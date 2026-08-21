"use client";

import { useState } from "react";
import { Upload, X } from "lucide-react";

type Props = {
  label?: string;
  value: string;
  onChange: (url: string) => void;
  onUploadError?: (message: string) => void;
  onUploadSuccess?: (message: string) => void;
  placeholder?: string;
};

export default function ImageUrlField({
  label = "Obrázok",
  value,
  onChange,
  onUploadError,
  onUploadSuccess,
  placeholder = "https://… alebo nahraj súbor",
}: Props) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
        credentials: "same-origin",
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok) {
        onUploadError?.(data.error ?? "Nepodarilo sa nahrať fotku.");
        return;
      }
      if (data.url) {
        onChange(data.url);
        onUploadSuccess?.("Fotka nahraná.");
      }
    } catch {
      onUploadError?.("Chyba pri nahrávaní fotky.");
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
          placeholder={placeholder}
        />
        <label className="btn-outline text-sm py-2 px-3 inline-flex items-center gap-2 cursor-pointer shrink-0">
          <Upload className="w-4 h-4" />
          {uploading ? "Nahrávam…" : "Nahrať"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
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
            Odstrániť
          </button>
        )}
      </div>
      {value.trim() && (
        <div className="mt-2 w-full max-w-sm h-36 rounded-xl overflow-hidden border border-brand-border bg-brand-warm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className="w-full h-full object-contain" />
        </div>
      )}
    </div>
  );
}
