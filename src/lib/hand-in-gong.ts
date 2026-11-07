/** Gong na konci 90 sekúnd. Kontext sa otvorí pri kliknutí, ktoré časomieru spustí. */
let gongContext: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctx = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!gongContext) {
    try {
      gongContext = new Ctx();
    } catch {
      gongContext = null;
    }
  }
  return gongContext;
}

export function prepareHandInGong(): void {
  const ctx = audioContext();
  if (!ctx) return;
  void ctx.resume();
}

export function playHandInGong(): void {
  const ctx = audioContext();
  if (!ctx) return;
  void ctx.resume().then(() => {
    strikeGong(ctx);
  });
}

function strikeGong(ctx: AudioContext): void {
  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.85, now);
  master.connect(ctx.destination);

  const partials = [
    { freq: 196, gain: 0.7, decay: 2.6 },
    { freq: 294, gain: 0.38, decay: 1.9 },
    { freq: 392, gain: 0.22, decay: 1.4 },
    { freq: 523, gain: 0.12, decay: 1.0 },
  ];
  for (const partial of partials) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(partial.freq, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(partial.gain, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + partial.decay);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + partial.decay + 0.05);
  }
}
