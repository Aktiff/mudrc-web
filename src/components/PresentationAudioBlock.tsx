"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { resolveMediaSrc } from "@/lib/media-url";

type Props = {
  questionId: string;
  storedUrl?: string;
  /** URL z MP3 vybraného na tomto počítači (pre celý kvíz v pamäti). */
  localOverrideUrl?: string;
  onLocalOverride?: (questionId: string, objectUrl: string | null) => void;
  presentationAudioRef?: RefObject<HTMLAudioElement>;
  /** Tmavé plátno kvízu vs. svetlý editor */
  theme?: "presentation" | "editor";
};

export default function PresentationAudioBlock({
  questionId,
  storedUrl,
  localOverrideUrl,
  onLocalOverride,
  presentationAudioRef,
  theme = "presentation",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [onlineFailed, setOnlineFailed] = useState(false);

  const serverSrc = storedUrl?.trim() ? resolveMediaSrc(storedUrl) : undefined;
  const src = localOverrideUrl || serverSrc;

  useEffect(() => {
    setOnlineFailed(false);
  }, [questionId, storedUrl, localOverrideUrl]);

  useEffect(() => {
    const el = presentationAudioRef?.current ?? audioRef.current;
    if (el && src) {
      el.load();
    }
  }, [src, presentationAudioRef]);

  const pickLocal = (file: File | undefined) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    onLocalOverride?.(questionId, url);
    setOnlineFailed(false);
  };

  const isDark = theme === "presentation";

  return (
    <div
      className={`w-full max-w-xl space-y-2 ${isDark ? "text-white" : "text-brand-text"}`}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
    >
      {src ? (
        <audio
          ref={presentationAudioRef ?? audioRef}
          controls
          src={src}
          className="w-full"
          preload="auto"
          onError={() => {
            if (!localOverrideUrl && serverSrc) setOnlineFailed(true);
          }}
        />
      ) : (
        <p className={`text-sm ${isDark ? "text-white/80" : "text-brand-muted"}`}>
          Ukážka z webu nie je k dispozícii — vyber MP3 nižšie.
        </p>
      )}

      {(onlineFailed || !serverSrc) && !localOverrideUrl && (
        <p className={`text-sm font-medium ${isDark ? "text-[#f0c800]" : "text-brand-orange"}`}>
          {onlineFailed ? "Súbor z internetu nejde prehrať." : "Chýba nahraná ukážka."}
        </p>
      )}

      <label
        className={
          isDark
            ? "inline-flex items-center justify-center gap-2 rounded-xl border border-[#f0c800]/50 bg-[#f0c800]/15 px-4 py-2.5 text-sm font-semibold text-[#f0c800] cursor-pointer hover:bg-[#f0c800]/25"
            : "btn-primary text-sm py-2.5 px-4 inline-flex items-center gap-2 cursor-pointer"
        }
      >
        MP3 z počítača
        <input
          ref={inputRef}
          type="file"
          accept="audio/*,.mp3,.m4a,.wav,.ogg"
          className="hidden"
          onChange={(e) => {
            pickLocal(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>

      {localOverrideUrl && (
        <button
          type="button"
          className={`text-xs underline ${isDark ? "text-white/70" : "text-brand-muted"}`}
          onClick={() => onLocalOverride?.(questionId, null)}
        >
          Zrušiť lokálnu ukážku
        </button>
      )}
    </div>
  );
}
