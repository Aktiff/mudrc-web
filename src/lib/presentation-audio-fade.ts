import { getMediaVolume, subscribeMediaVolume } from "@/lib/media-volume";

/** Nabeh a dobeh. Web Audio sa nepoužíva — po ňom vie prehrávač ostať ticho. */
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

export function restorePresentationAudio(audio: HTMLAudioElement) {
  audio.volume = getMediaVolume();
}

export function attachPresentationEdgeFade(audio: HTMLAudioElement): () => void {
  let frame = 0;
  let running = false;

  const apply = () => {
    const next = getMediaVolume() * fadeGain(audio);
    if (Math.abs(audio.volume - next) > 0.004) audio.volume = next;
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
  const unsubscribe = subscribeMediaVolume(apply);

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
    restorePresentationAudio(audio);
  };
}
