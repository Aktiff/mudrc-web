import { MEDIA_BOOST_MAX } from "@/lib/media-volume";

/**
 * Prehrávač vie len 0–100 %. Nad 100 % ide zosilnenie cez Web Audio.
 * Graf sa pripojí raz a ostane pripojený — odpojenie nechá prehrávač ticho.
 * Cudzí súbor bez CORS sa nezapája, lebo by stíchol.
 */

type Graph = {
  ctx: AudioContext;
  gain: GainNode;
};

const graphs = new WeakMap<HTMLMediaElement, Graph>();
let sharedCtx: AudioContext | null = null;
let applying = false;

let playPhpProbe: Promise<boolean> | null = null;

function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (sharedCtx) return sharedCtx;
  const Ctx = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  try {
    sharedCtx = new Ctx();
  } catch {
    sharedCtx = null;
  }
  return sharedCtx;
}

export function isApplyingElementVolume(): boolean {
  return applying;
}

export function hasVolumeGraph(node: HTMLMediaElement): boolean {
  return graphs.has(node);
}

function elementCanBoost(node: HTMLMediaElement): boolean {
  const raw = node.currentSrc || node.src;
  if (!raw || typeof window === "undefined") return false;
  try {
    const url = new URL(raw, window.location.href);
    if (url.origin === window.location.origin) return true;
    return url.hostname === "media.mudrc.sk" && url.pathname === "/play.php";
  } catch {
    return false;
  }
}

function ensureGraph(node: HTMLMediaElement): Graph | null {
  const existing = graphs.get(node);
  if (existing) return existing;
  if (!elementCanBoost(node)) return null;
  const ctx = audioContext();
  if (!ctx) return null;
  try {
    const source = ctx.createMediaElementSource(node);
    const gain = ctx.createGain();
    gain.gain.value = 1;
    source.connect(gain);
    gain.connect(ctx.destination);
    const graph = { ctx, gain };
    graphs.set(node, graph);
    const resume = () => {
      void ctx.resume();
    };
    node.addEventListener("play", resume);
    resume();
    return graph;
  } catch {
    return null;
  }
}

/** `level` je 0–3 (300 %). `fade` je 0–1 na nabeh a dobeh. */
export function applyElementVolume(node: HTMLMediaElement, level: number, fade = 1): void {
  const base = Number.isFinite(level) ? Math.min(MEDIA_BOOST_MAX, Math.max(0, level)) : 0;
  const linear = base * (Number.isFinite(fade) ? Math.min(1, Math.max(0, fade)) : 1);
  const wantsBoost = base > 1 && elementCanBoost(node);
  applying = true;
  try {
    if (!wantsBoost && !graphs.has(node)) {
      const next = Math.min(1, Math.max(0, linear));
      if (Math.abs(node.volume - next) > 0.004) node.volume = next;
      return;
    }
    const graph = ensureGraph(node);
    if (!graph) {
      const next = Math.min(1, Math.max(0, linear));
      if (Math.abs(node.volume - next) > 0.004) node.volume = next;
      return;
    }
    if (Math.abs(node.volume - 1) > 0.001) node.volume = 1;
    const gain = Math.max(0, linear);
    if (Math.abs(graph.gain.gain.value - gain) > 0.004) graph.gain.gain.value = gain;
    void graph.ctx.resume();
  } finally {
    applying = false;
  }
}

function mediaHostPath(src: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const url = new URL(src, window.location.href);
    if (url.hostname !== "media.mudrc.sk") return null;
    const path = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
    if (path.includes("..") || path.includes("\\") || path.includes("\0")) return null;
    if (!/^(audio|video)\/[^/]+$/.test(path)) return null;
    return path;
  } catch {
    return null;
  }
}

function isSameOrigin(src: string): boolean {
  if (src.startsWith("/")) return true;
  if (typeof window === "undefined") return false;
  try {
    return new URL(src, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
}

function playPhpReady(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (!playPhpProbe) {
    playPhpProbe = fetch("https://media.mudrc.sk/play.php?probe=1", { mode: "cors" })
      .then((res) => res.status === 204 || res.status === 200)
      .catch(() => false);
  }
  return playPhpProbe;
}

export async function resolveBoostSrc(src: string): Promise<{
  src: string;
  crossOrigin?: "anonymous";
  boostReady: boolean;
}> {
  if (isSameOrigin(src)) return { src, boostReady: true };
  const path = mediaHostPath(src);
  if (!path) return { src, boostReady: false };
  const ready = await playPhpReady();
  if (!ready) return { src, boostReady: false };
  return {
    src: `https://media.mudrc.sk/play.php?f=${encodeURIComponent(path)}`,
    crossOrigin: "anonymous",
    boostReady: true,
  };
}
