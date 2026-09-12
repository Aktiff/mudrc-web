type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionResultEventLike = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [altIndex: number]: { transcript: string };
    };
  };
};

const NEXT_SUBSTRINGS = [
  "dalej",
  "dalsi",
  "dalsia otazka",
  "dalsia otázka",
  "pokracuj",
  "nasledujuci",
  "nasledujuca",
];

const PREV_SUBSTRINGS = ["spat", "naspat", "predchadzajuci", "predchadzajuca"];

export function normalizeSpeechText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchVoiceCommand(transcript: string): "next" | "prev" | null {
  const n = normalizeSpeechText(transcript);
  if (!n) return null;

  for (const phrase of PREV_SUBSTRINGS) {
    if (n.includes(normalizeSpeechText(phrase))) return "prev";
  }

  for (const phrase of NEXT_SUBSTRINGS) {
    if (n.includes(normalizeSpeechText(phrase))) return "next";
  }

  if (/\b(dalsi|dalsia|dalej|pokracuj)\b/.test(n)) return "next";

  return null;
}

export function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionCtor() !== null;
}

export type PresentationVoiceRecognition = SpeechRecognitionLike;

export function createPresentationVoiceRecognition(): PresentationVoiceRecognition | null {
  const Ctor = getSpeechRecognitionCtor();
  if (!Ctor) return null;
  const recognition = new Ctor();
  recognition.lang = "sk-SK";
  recognition.continuous = true;
  recognition.interimResults = false;
  return recognition;
}
