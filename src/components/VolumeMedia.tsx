"use client";

import { forwardRef, useEffect, useState, type ComponentProps, type ForwardedRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  MEDIA_VOLUME_EVENT,
  attachVolumeWheel,
  getBoostVolume,
  getMediaVolume,
  setBoostPlaybackReady,
  setBoostVolume,
  setMediaVolume,
  subscribeBoostVolume,
  subscribeMediaVolume,
} from "@/lib/media-volume";
import { attachPresentationEdgeFade, restorePresentationAudio } from "@/lib/presentation-audio-fade";
import {
  applyElementVolume,
  hasVolumeGraph,
  isApplyingElementVolume,
  resolveBoostSrc,
} from "@/lib/presentation-volume-boost";

function assignRef<T>(ref: ForwardedRef<T>, value: T | null) {
  if (typeof ref === "function") ref(value);
  else if (ref) ref.current = value;
}

function useAppliedVolume(
  node: HTMLMediaElement | null,
  edgeFade: boolean,
  boost: boolean,
  mediaSrc: string | undefined,
  boostMax?: number
) {
  useEffect(() => {
    if (!node || edgeFade) return;
    const level = () => {
      const raw = boost ? getBoostVolume() : getMediaVolume();
      return boostMax != null ? Math.min(raw, boostMax) : raw;
    };
    const apply = () => applyElementVolume(node, level());
    apply();
    const unsubscribe = (boost ? subscribeBoostVolume : subscribeMediaVolume)(apply);
    const onVolume = () => {
      if (isApplyingElementVolume() || hasVolumeGraph(node)) return;
      const next = node.volume;
      if (boost) {
        if (getBoostVolume() > 1.001 && next <= 1) return;
        if (Math.abs(next - getBoostVolume()) > 0.001) setBoostVolume(next, { user: true, max: boostMax });
        return;
      }
      if (Math.abs(next - getMediaVolume()) > 0.001) setMediaVolume(next, { user: true });
    };
    node.addEventListener("volumechange", onVolume);
    return () => {
      unsubscribe();
      node.removeEventListener("volumechange", onVolume);
    };
  }, [node, edgeFade, boost, mediaSrc, boostMax]);
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

function useEdgeFade(node: HTMLAudioElement | null, enabled: boolean, boost: boolean, mediaSrc: string | undefined) {
  useEffect(() => {
    if (!node) return;
    const level = () => (boost ? getBoostVolume() : getMediaVolume());
    const subscribe = boost ? subscribeBoostVolume : subscribeMediaVolume;
    if (!enabled) {
      restorePresentationAudio(node, level());
      return;
    }
    return attachPresentationEdgeFade(node, level, subscribe);
  }, [enabled, node, boost, mediaSrc]);
}

function useBoostPlayback(src: string | undefined, boost: boolean) {
  const [state, setState] = useState<{ src?: string; crossOrigin?: "anonymous" }>({
    src: boost ? undefined : src,
  });

  useEffect(() => {
    if (!boost) {
      setState({ src });
      return;
    }
    if (!src) {
      setState({});
      setBoostPlaybackReady(false);
      return;
    }
    let cancel = false;
    setState({ src: undefined });
    void resolveBoostSrc(src).then((next) => {
      if (cancel) return;
      setBoostPlaybackReady(next.boostReady);
      setState({ src: next.src, crossOrigin: next.crossOrigin });
    });
    return () => {
      cancel = true;
      if (boost) setBoostPlaybackReady(false);
    };
  }, [src, boost]);

  return state;
}

type Extra = {
  hint?: boolean;
  captureWheel?: boolean;
  /** Len prezentácia. Prvá a posledná sekunda. */
  edgeFade?: boolean;
  /** Zastaví prehrávanie na tejto sekunde. Prázdne = celé video. */
  playUntilSeconds?: number;
  /** Prezentácia: video a ukážky so zvukom môžu ísť až na 300 %. */
  boost?: boolean;
  /** Strop zosilnenia. Video v prezentácii má 2 (200 %). */
  boostMax?: number;
  /** Posuvník hlasitosti pod prehrávačom. */
  showBoostControl?: boolean;
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
  { hint = false, captureWheel = true, edgeFade = false, playUntilSeconds, boost = false, src, ...props },
  forwarded
) {
  const [node, setNode] = useState<HTMLAudioElement | null>(null);
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const playback = useBoostPlayback(typeof src === "string" ? src : undefined, boost);
  useAppliedVolume(node, edgeFade, boost, playback.src);
  useEdgeFade(node, edgeFade, boost, playback.src);
  usePlayUntil(node, playUntilSeconds);
  return (
    <VolumeShell hint={hint} captureWheel={captureWheel} box={box} setBox={setBox}>
      <audio
        {...props}
        crossOrigin={playback.crossOrigin}
        src={playback.src}
        ref={(el) => {
          setNode(el);
          assignRef(forwarded, el);
        }}
      />
    </VolumeShell>
  );
});

function BoostControl({ max }: { max: number }) {
  const [level, setLevel] = useState(0.7);
  useEffect(() => {
    const show = () => setLevel(getBoostVolume());
    show();
    return subscribeBoostVolume(show);
  }, []);
  const pct = Math.round(Math.min(level, max) * 100);
  const maxPct = Math.round(max * 100);
  return (
    <label
      className="mt-2 flex items-center gap-3 w-full text-white text-sm font-semibold"
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <span className="shrink-0 tabular-nums">Hlasitosť {pct} %</span>
      <input
        type="range"
        min={0}
        max={maxPct}
        step={5}
        value={pct}
        aria-label="Hlasitosť videa"
        onChange={(event) => setBoostVolume(Number(event.target.value) / 100, { snap: true, user: true, max })}
        className="flex-1 accent-[#f0c800] cursor-pointer"
      />
    </label>
  );
}

export const VolumeVideo = forwardRef<HTMLVideoElement, ComponentProps<"video"> & Extra>(function VolumeVideo(
  { hint = false, captureWheel = true, playUntilSeconds, boost = false, boostMax, showBoostControl = false, src, ...props },
  forwarded
) {
  const [node, setNode] = useState<HTMLVideoElement | null>(null);
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const playback = useBoostPlayback(typeof src === "string" ? src : undefined, boost);
  useAppliedVolume(node, false, boost, playback.src, boost ? boostMax : undefined);
  usePlayUntil(node, playUntilSeconds);
  const video = (
    <video
      {...props}
      crossOrigin={playback.crossOrigin}
      src={playback.src}
      ref={(el) => {
        setNode(el);
        assignRef(forwarded, el);
      }}
    />
  );
  return (
    <VolumeShell hint={hint} captureWheel={captureWheel} box={box} setBox={setBox}>
      {showBoostControl && boost && boostMax ? (
        <div className="w-full">
          {video}
          <BoostControl max={boostMax} />
        </div>
      ) : (
        video
      )}
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
