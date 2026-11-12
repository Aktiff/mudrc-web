export const DEFAULT_MEDIA_VOLUME = 0.7;
/** Video a všetky ukážky so zvukom v prezentácii môžu ísť nad 100 %. */
export const MEDIA_BOOST_MAX = 3;
/** Video v prezentácii: koliesko a posuvník skončia na 200 %. */
export const VIDEO_BOOST_MAX = 2;

const STORAGE_KEY = "mudrc-media-volume";
const BOOST_STORAGE_KEY = "mudrc-media-volume-boost";
export const MEDIA_VOLUME_EVENT = "mudrc-media-volume";

type Listener = () => void;

let volume = DEFAULT_MEDIA_VOLUME;
let boostVolume = DEFAULT_MEDIA_VOLUME;
let hydrated = false;
let boostHydrated = false;
/** Aktuálna ukážka vie zosilniť nad 100 %. Inak koliesko ostane na 100 %. */
let boostReady = false;
const listeners = new Set<Listener>();
const boostListeners = new Set<Listener>();

function clampTo(value: number, max: number): number {
  if (!Number.isFinite(value)) return DEFAULT_MEDIA_VOLUME;
  return Math.min(max, Math.max(0, Math.round(value * 100) / 100));
}

function clamp(value: number): number {
  return clampTo(value, 1);
}

function clampStep(value: number, max: number): number {
  return Math.min(max, Math.max(0, Math.round(clampTo(value, max) * 20) / 20));
}

function boostCap(): number {
  return boostReady ? MEDIA_BOOST_MAX : 1;
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

function hydrateBoost() {
  if (boostHydrated || typeof window === "undefined") return;
  boostHydrated = true;
  hydrate();
  boostVolume = volume;
  try {
    const raw = localStorage.getItem(BOOST_STORAGE_KEY);
    if (raw == null) return;
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) boostVolume = clampTo(parsed, MEDIA_BOOST_MAX);
  } catch {
    /* súkromné prehliadanie */
  }
}

export function getMediaVolume(): number {
  hydrate();
  return volume;
}

export function getBoostVolume(): number {
  hydrateBoost();
  return Math.min(boostVolume, boostCap());
}

export function setBoostPlaybackReady(ready: boolean) {
  if (boostReady === ready) return;
  boostReady = ready;
  boostListeners.forEach((listener) => listener());
}

export function subscribeMediaVolume(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function subscribeBoostVolume(listener: Listener): () => void {
  boostListeners.add(listener);
  return () => boostListeners.delete(listener);
}

export function setMediaVolume(next: number, options?: { snap?: boolean; user?: boolean }) {
  hydrate();
  const value = options?.snap ? clampStep(next, 1) : clamp(next);
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

export function setBoostVolume(next: number, options?: { snap?: boolean; user?: boolean; max?: number }) {
  hydrateBoost();
  const cap = Math.min(options?.max ?? MEDIA_BOOST_MAX, boostCap());
  const value = options?.snap ? clampStep(next, cap) : clampTo(next, cap);
  if (value !== boostVolume) {
    boostVolume = value;
    try {
      localStorage.setItem(BOOST_STORAGE_KEY, String(boostVolume));
    } catch {
      /* súkromné prehliadanie */
    }
    boostListeners.forEach((listener) => listener());
  }
  if (options?.user && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(MEDIA_VOLUME_EVENT, { detail: getBoostVolume() }));
  }
}

export function bumpMediaVolume(delta: number) {
  setMediaVolume(getMediaVolume() + delta, { snap: true, user: true });
}

export function bumpBoostVolume(delta: number, max = MEDIA_BOOST_MAX) {
  setBoostVolume(getBoostVolume() + delta, { snap: true, user: true, max });
}

/** Koliesko hore pridá hlasitosť, dole ju uberá. Vráti zvyšok akumulátora. */
export function consumeVolumeWheel(acc: number, event: WheelEvent, boost = false, max = MEDIA_BOOST_MAX): number {
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
  if (delta !== 0) {
    if (boost) bumpBoostVolume(delta, max);
    else bumpMediaVolume(delta);
  }
  return acc;
}

/** Koliesko hore pridá hlasitosť, dole ju uberá. Jeden krok je 5 %. */
export function attachVolumeWheel(target: HTMLElement): () => void {
  let acc = 0;
  const onWheel = (event: WheelEvent) => {
    event.preventDefault();
    event.stopPropagation();
    acc = consumeVolumeWheel(acc, event);
  };
  target.addEventListener("wheel", onWheel, { passive: false });
  return () => target.removeEventListener("wheel", onWheel);
}
