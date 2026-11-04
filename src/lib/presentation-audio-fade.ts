import { getMediaVolume } from "@/lib/media-volume";
import { applyElementVolume } from "@/lib/presentation-volume-boost";

/** Nabeh a dobeh násobí hlasitosť. Nad 100 % zosilní prehrávač a graf ostane pripojený. */
const FADE_SECONDS = 1;

function fadeGain(audio: HTMLAudioElement): number {
  const time = audio.currentTime;
  let gain = 1;
  if (time < FADE_SECONDS) gain = Math.min(gain, Math.max(0, time) / FADE_SECONDS);
  const duration = audio.duration;
  if (Number.isFinite(duration) && duration > 0) {
    const remaining = duration - time;
    if (remaining < FADE_SECONDS) gain = Math.min(gain, Math.max(0, remaining) / FADE_SECONDS);
  }
  return gain;
}

export function restorePresentationAudio(audio: HTMLAudioElement, level = getMediaVolume()) {
  applyElementVolume(audio, level, 1);
}

export function attachPresentationEdgeFade(
  audio: HTMLAudioElement,
  level: () => number = getMediaVolume,
  subscribe: (listener: () => void) => () => void = () => () => undefined
): () => void {
  let frame = 0;
  let running = false;

  const apply = () => {
    applyElementVolume(audio, level(), fadeGain(audio));
  };

  const tick = () => {
    apply();
    if (running) frame = window.requestAnimationFrame(tick);
  };

  const start = () => {
    if (running) return;
    running = true;
    apply();
    frame = window.requestAnimationFrame(tick);
  };

  const stop = () => {
    running = false;
    window.cancelAnimationFrame(frame);
  };

  audio.addEventListener("play", start);
  audio.addEventListener("playing", start);
  audio.addEventListener("pause", stop);
  audio.addEventListener("ended", stop);
  audio.addEventListener("emptied", stop);
  const unsubscribe = subscribe(apply);

  apply();
  if (!audio.paused) start();

  return () => {
    stop();
    unsubscribe();
    audio.removeEventListener("play", start);
    audio.removeEventListener("playing", start);
    audio.removeEventListener("pause", stop);
    audio.removeEventListener("ended", stop);
    audio.removeEventListener("emptied", stop);
    restorePresentationAudio(audio, level());
  };
}
