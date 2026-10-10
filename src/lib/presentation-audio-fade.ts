const FADE_SECONDS = 1;

type FadeGraph = {
  source: MediaElementAudioSourceNode;
  gain: GainNode;
};

let sharedCtx: AudioContext | null = null;
const graphs = new WeakMap<HTMLAudioElement, FadeGraph>();

function sharedAudioContext(): AudioContext {
  if (!sharedCtx || sharedCtx.state === "closed") {
    sharedCtx = new AudioContext();
  }
  return sharedCtx;
}

function envelope(currentTime: number, duration: number): number {
  let level = 1;
  if (currentTime < FADE_SECONDS) level = Math.max(0, currentTime / FADE_SECONDS);
  if (Number.isFinite(duration) && duration > 0 && duration - currentTime < FADE_SECONDS) {
    level = Math.min(level, Math.max(0, (duration - currentTime) / FADE_SECONDS));
  }
  return level;
}

function connect(graph: FadeGraph) {
  const ctx = sharedAudioContext();
  try {
    graph.source.disconnect();
  } catch {
    /* ešte nebolo zapojené */
  }
  try {
    graph.gain.disconnect();
  } catch {
    /* ešte nebolo zapojené */
  }
  graph.gain.gain.value = 1;
  graph.source.connect(graph.gain);
  graph.gain.connect(ctx.destination);
}

function ensureGraph(audio: HTMLAudioElement): FadeGraph {
  let graph = graphs.get(audio);
  if (!graph) {
    const ctx = sharedAudioContext();
    const source = ctx.createMediaElementSource(audio);
    const gain = ctx.createGain();
    graph = { source, gain };
    graphs.set(audio, graph);
  }
  connect(graph);
  return graph;
}

/** Keď slide už fade nepotrebuje, zvuk ostane počuť v plnej hlasitosti. */
export function restorePresentationAudio(audio: HTMLAudioElement) {
  const graph = graphs.get(audio);
  if (!graph) return;
  connect(graph);
}

/** Prvá a posledná sekunda ukážky v prezentácii. Súbor sa nemení. */
export function attachPresentationEdgeFade(audio: HTMLAudioElement): () => void {
  const graph = ensureGraph(audio);
  const ctx = sharedAudioContext();
  let raf = 0;

  const apply = () => {
    graph.gain.gain.value = envelope(audio.currentTime, audio.duration);
  };

  const loop = () => {
    apply();
    if (!audio.paused && !audio.ended) raf = requestAnimationFrame(loop);
  };

  const onPlay = () => {
    void ctx.resume();
    cancelAnimationFrame(raf);
    apply();
    raf = requestAnimationFrame(loop);
  };
  const onStop = () => cancelAnimationFrame(raf);

  audio.addEventListener("play", onPlay);
  audio.addEventListener("pause", onStop);
  audio.addEventListener("ended", onStop);
  audio.addEventListener("seeked", apply);
  audio.addEventListener("durationchange", apply);
  apply();
  if (!audio.paused) onPlay();

  return () => {
    cancelAnimationFrame(raf);
    audio.removeEventListener("play", onPlay);
    audio.removeEventListener("pause", onStop);
    audio.removeEventListener("ended", onStop);
    audio.removeEventListener("seeked", apply);
    audio.removeEventListener("durationchange", apply);
    audio.pause();
    graph.gain.gain.value = 1;
    try {
      graph.source.disconnect();
    } catch {
      /* už odpojené */
    }
    try {
      graph.gain.disconnect();
    } catch {
      /* už odpojené */
    }
  };
}
