"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { playbackMediaSrc } from "@/lib/media-url";

const STOP_EVENT = "mudrc-bank-preview-stop";

type Props = {
  src: string;
  kind: "audio" | "video";
};

export default function BankMediaPreview({ src, kind }: Props) {
  const url = playbackMediaSrc(src);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const stop = () => {
      audioRef.current?.pause();
      if (videoRef.current) videoRef.current.pause();
      setPlaying(false);
    };
    window.addEventListener(STOP_EVENT, stop);
    return () => {
      window.removeEventListener(STOP_EVENT, stop);
      audioRef.current?.pause();
      videoRef.current?.pause();
    };
  }, []);

  if (!url) return null;

  const fail = () => {
    setPlaying(false);
    setError(kind === "video" ? "Video sa nepodarilo prehrať." : "Ukážku sa nepodarilo prehrať.");
  };

  const toggle = () => {
    setError("");
    const media = kind === "video" ? videoRef.current : audioRef.current;
    if (playing) {
      media?.pause();
      setPlaying(false);
      return;
    }

    window.dispatchEvent(new Event(STOP_EVENT));

    if (kind === "audio" && !audioRef.current) {
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setPlaying(false);
      audio.onerror = fail;
    }

    const next = kind === "video" ? videoRef.current : audioRef.current;
    if (!next) return;
    void next.play().then(() => setPlaying(true), fail);
  };

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        className={`text-xs py-1.5 px-2 inline-flex items-center gap-1 ${
          playing ? "rounded-lg border border-brand-orange bg-brand-orange text-brand-btn-fg" : "btn-outline"
        }`}
      >
        {playing ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
        {playing ? "Pozastaviť" : "Prehrať"}
      </button>
      {error && <p className="basis-full text-xs text-red-500">{error}</p>}
      {kind === "video" && (
        <video
          ref={videoRef}
          src={url}
          controls
          playsInline
          preload="none"
          onEnded={() => setPlaying(false)}
          onError={() => {
            if (playing) fail();
          }}
          className={
            playing
              ? "basis-full w-full max-w-md rounded-lg border border-brand-border"
              : "hidden"
          }
        />
      )}
    </>
  );
}
