"use client";

import { forwardRef, useEffect, useState, type ComponentProps, type ForwardedRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  MEDIA_VOLUME_EVENT,
  attachVolumeWheel,
  getMediaVolume,
  setMediaVolume,
  subscribeMediaVolume,
} from "@/lib/media-volume";
import { attachPresentationEdgeFade, restorePresentationAudio } from "@/lib/presentation-audio-fade";

function assignRef<T>(ref: ForwardedRef<T>, value: T | null) {
  if (typeof ref === "function") ref(value);
  else if (ref) ref.current = value;
}

function useAppliedVolume(node: HTMLMediaElement | null, edgeFade: boolean) {
  useEffect(() => {
    if (!node || edgeFade) return;
    const apply = () => {
      const next = getMediaVolume();
      if (Math.abs(node.volume - next) > 0.001) node.volume = next;
    };
    apply();
    const unsubscribe = subscribeMediaVolume(apply);
    const onVolume = () => {
      if (Math.abs(node.volume - getMediaVolume()) > 0.001) {
        setMediaVolume(node.volume, { user: true });
      }
    };
    node.addEventListener("volumechange", onVolume);
    return () => {
      unsubscribe();
      node.removeEventListener("volumechange", onVolume);
    };
  }, [node, edgeFade]);
}

function useWheelTarget(node: HTMLElement | null, enabled: boolean) {
  useEffect(() => {
    if (!enabled || !node) return;
    return attachVolumeWheel(node);
  }, [enabled, node]);
}

function VolumeCaption() {
  const [pct, setPct] = useState(70);
  useEffect(() => {
    const show = () => setPct(Math.round(getMediaVolume() * 100));
    show();
    return subscribeMediaVolume(show);
  }, []);
  return <p className="text-[11px] text-brand-muted mt-1">Hlasitosť {pct} % · koliesko hore pridá, dole uberá</p>;
}

function useEdgeFade(node: HTMLAudioElement | null, enabled: boolean) {
  useEffect(() => {
    if (!node) return;
    if (!enabled) {
      restorePresentationAudio(node);
      return;
    }
    return attachPresentationEdgeFade(node);
  }, [enabled, node]);
}

type Extra = {
  hint?: boolean;
  captureWheel?: boolean;
  /** Len prezentácia. Prvá a posledná sekunda. */
  edgeFade?: boolean;
  /** Zastaví prehrávanie na tejto sekunde. Prázdne = celé video. */
  playUntilSeconds?: number;
};

function usePlayUntil(node: HTMLMediaElement | null, seconds: number | undefined) {
  useEffect(() => {
    if (!node || seconds == null || !(seconds > 0)) return;
    const clamp = () => {
      if (node.currentTime < seconds - 0.08) return;
      if (!node.paused) node.pause();
      if (node.currentTime > seconds) node.currentTime = Math.max(0, seconds - 0.05);
    };
    node.addEventListener("timeupdate", clamp);
    node.addEventListener("seeked", clamp);
    node.addEventListener("playing", clamp);
    return () => {
      node.removeEventListener("timeupdate", clamp);
      node.removeEventListener("seeked", clamp);
      node.removeEventListener("playing", clamp);
    };
  }, [node, seconds]);
}

function VolumeShell({
  hint,
  captureWheel,
  box,
  setBox,
  children,
}: {
  hint: boolean;
  captureWheel: boolean;
  box: HTMLDivElement | null;
  setBox: (node: HTMLDivElement | null) => void;
  children: ReactNode;
}) {
  useWheelTarget(box, captureWheel);
  if (!hint && !captureWheel) return children;
  return (
    <div ref={setBox} className="w-full max-w-md">
      {children}
      {hint ? <VolumeCaption /> : null}
    </div>
  );
}

export const VolumeAudio = forwardRef<HTMLAudioElement, ComponentProps<"audio"> & Extra>(function VolumeAudio(
  { hint = false, captureWheel = true, edgeFade = false, playUntilSeconds, ...props },
  forwarded
) {
  const [node, setNode] = useState<HTMLAudioElement | null>(null);
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  useAppliedVolume(node, edgeFade);
  useEdgeFade(node, edgeFade);
  usePlayUntil(node, playUntilSeconds);
  return (
    <VolumeShell hint={hint} captureWheel={captureWheel} box={box} setBox={setBox}>
      <audio
        {...props}
        ref={(el) => {
          setNode(el);
          assignRef(forwarded, el);
        }}
      />
    </VolumeShell>
  );
});

export const VolumeVideo = forwardRef<HTMLVideoElement, ComponentProps<"video"> & Extra>(function VolumeVideo(
  { hint = false, captureWheel = true, playUntilSeconds, ...props },
  forwarded
) {
  const [node, setNode] = useState<HTMLVideoElement | null>(null);
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  useAppliedVolume(node, false);
  usePlayUntil(node, playUntilSeconds);
  return (
    <VolumeShell hint={hint} captureWheel={captureWheel} box={box} setBox={setBox}>
      <video
        {...props}
        ref={(el) => {
          setNode(el);
          assignRef(forwarded, el);
        }}
      />
    </VolumeShell>
  );
});

export function MediaVolumeHint() {
  const [pct, setPct] = useState<number | null>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let timer = 0;
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<number>).detail;
      setPct(Math.round((Number.isFinite(detail) ? detail : getMediaVolume()) * 100));
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setPct(null), 1200);
    };
    const syncFullscreen = () => {
      setPortalTarget(document.fullscreenElement instanceof HTMLElement ? document.fullscreenElement : null);
    };
    window.addEventListener(MEDIA_VOLUME_EVENT, onChange);
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => {
      window.removeEventListener(MEDIA_VOLUME_EVENT, onChange);
      document.removeEventListener("fullscreenchange", syncFullscreen);
      window.clearTimeout(timer);
    };
  }, []);

  if (pct == null) return null;

  const hint = (
    <div className="fixed bottom-8 left-1/2 z-[10000] -translate-x-1/2 rounded-full bg-black/80 px-4 py-2 text-sm font-semibold text-white shadow-lg pointer-events-none">
      Hlasitosť {pct} %
    </div>
  );

  if (portalTarget) return createPortal(hint, portalTarget);
  return hint;
}
