"use client";

import { useEffect, useRef } from "react";
import { playbackMediaSrc } from "@/lib/media-url";

const STOP_EVENT = "mudrc-bank-preview-stop";

type Props = {
  src: string;
  kind: "audio" | "video";
};

/** Rovnaký prehrávač ako v editore kvízu: natívne audio/video controls. */
export default function BankMediaPreview({ src, kind }: Props) {
  const url = playbackMediaSrc(src);
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = kind === "video" ? videoRef.current : audioRef.current;
    if (!el) return;

    const onPlay = () => {
      window.dispatchEvent(new CustomEvent(STOP_EVENT, { detail: el }));
    };
    const stopOthers = (event: Event) => {
      const current = (event as CustomEvent<HTMLMediaElement>).detail;
      if (current !== el && !el.paused) el.pause();
    };

    el.addEventListener("play", onPlay);
    window.addEventListener(STOP_EVENT, stopOthers);
    return () => {
      el.removeEventListener("play", onPlay);
      window.removeEventListener(STOP_EVENT, stopOthers);
      el.pause();
    };
  }, [kind, url]);

  if (!url) return null;

  if (kind === "video") {
    return (
      <video
        ref={videoRef}
        controls
        playsInline
        preload="metadata"
        src={url}
        className="w-full max-w-md rounded-lg border border-brand-border"
      />
    );
  }

  return <audio ref={audioRef} controls preload="metadata" src={url} className="w-full max-w-md" />;
}
