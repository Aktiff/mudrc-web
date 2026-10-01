export const DEFAULT_MEDIA_VOLUME = 0.7;

const STORAGE_KEY = "mudrc-media-volume";
export const MEDIA_VOLUME_EVENT = "mudrc-media-volume";

type Listener = () => void;

let volume = DEFAULT_MEDIA_VOLUME;
let hydrated = false;
const listeners = new Set<Listener>();

function clamp(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_MEDIA_VOLUME;
  return Math.min(1, Math.max(0, Math.round(value * 100) / 100));
}

function clampStep(value: number): number {
  return Math.min(1, Math.max(0, Math.round(clamp(value) * 20) / 20));
}

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw == null) return;
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) volume = clamp(parsed);
  } catch {
    /* súkromné prehliadanie */
  }
}

export function getMediaVolume(): number {
  hydrate();
  return volume;
}

export function subscribeMediaVolume(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setMediaVolume(next: number, options?: { snap?: boolean; user?: boolean }) {
  hydrate();
  const value = options?.snap ? clampStep(next) : clamp(next);
  if (value !== volume) {
    volume = value;
    try {
      localStorage.setItem(STORAGE_KEY, String(volume));
    } catch {
      /* súkromné prehliadanie */
    }
    listeners.forEach((listener) => listener());
  }
  if (options?.user && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(MEDIA_VOLUME_EVENT, { detail: volume }));
  }
}

export function bumpMediaVolume(delta: number) {
  setMediaVolume(getMediaVolume() + delta, { snap: true, user: true });
}

/** Koliesko hore pridá hlasitosť, dole ju uberá. Jeden krok je 5 %. */
export function attachVolumeWheel(target: HTMLElement): () => void {
  let acc = 0;
  const onWheel = (event: WheelEvent) => {
    event.preventDefault();
    event.stopPropagation();
    let pixels = event.deltaY;
    if (event.deltaMode === 1) pixels *= 16;
    else if (event.deltaMode === 2) pixels *= 800;
    acc += pixels;
    const notch = 80;
    let delta = 0;
    while (Math.abs(acc) >= notch) {
      delta += acc > 0 ? -0.05 : 0.05;
      acc -= Math.sign(acc) * notch;
    }
    if (delta !== 0) bumpMediaVolume(delta);
  };
  target.addEventListener("wheel", onWheel, { passive: false });
  return () => target.removeEventListener("wheel", onWheel);
}
