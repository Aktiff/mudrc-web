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

const PREV_SUBSTRINGS = ["spat", "naspat", "predchadzajuci", "predchadzajuca"];

const QUESTION_NUMBER_WORDS: Record<string, number> = {
  jedna: 1,
  jeden: 1,
  jedno: 1,
  prva: 1,
  prvy: 1,
  prve: 1,
  dva: 2,
  dve: 2,
  druha: 2,
  druhy: 2,
  dvojka: 2,
  tri: 3,
  tretia: 3,
  treti: 3,
  trojka: 3,
  styri: 4,
  stvrta: 4,
  stvrty: 4,
  styrka: 4,
  pat: 5,
  pata: 5,
  piaty: 5,
  piatka: 5,
  sest: 6,
  sesta: 6,
  siesty: 6,
  sestka: 6,
  sedem: 7,
  siedma: 7,
  siedmy: 7,
  osem: 8,
  osma: 8,
  osmy: 8,
  devat: 9,
  devata: 9,
  devaty: 9,
  desat: 10,
  desata: 10,
  desaty: 10,
};

export type VoiceCommand =
  | { type: "goto_question"; questionNumber: number }
  | { type: "goto_round"; roundNumber: number }
  | { type: "next" }
  | { type: "prev" };

export function normalizeSpeechText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseQuestionNumberFromSpeech(normalized: string): number | null {
  if (!normalized.includes("otazk")) return null;

  const digitMatch = normalized.match(/otazk\w*\s*(\d{1,2})\b/);
  if (digitMatch) {
    const num = Number(digitMatch[1]);
    return num >= 1 && num <= 55 ? num : null;
  }

  const afterOtazka = normalized.match(/otazk\w*\s+([a-z0-9]+)/);
  if (afterOtazka?.[1] && QUESTION_NUMBER_WORDS[afterOtazka[1]] != null) {
    return QUESTION_NUMBER_WORDS[afterOtazka[1]];
  }

  for (const [word, num] of Object.entries(QUESTION_NUMBER_WORDS)) {
    if (normalized.includes(`otazk ${word}`) || normalized.includes(`otazka ${word}`)) {
      return num;
    }
  }

  return null;
}

function parseRoundNumberFromSpeech(normalized: string): number | null {
  if (!normalized.includes("kolo")) return null;

  if (/prv\w*\s+kolo|kolo\s+prv\w*|prve\s+kolo|prva\s+kolo/.test(normalized)) return 1;
  if (/druh\w*\s+kolo|kolo\s+druh\w*|druhe\s+kolo/.test(normalized)) return 2;
  if (/tret\w*\s+kolo|kolo\s+tret\w*|tretie\s+kolo/.test(normalized)) return 3;
  if (/stvrt\w*\s+kolo|stvr\w*\s+kolo|kolo\s+stvrt\w*|kolo\s+stvr\w*|stvrte\s+kolo/.test(normalized)) {
    return 4;
  }

  const digitMatch = normalized.match(/kolo\s*(\d)/);
  if (digitMatch) {
    const num = Number(digitMatch[1]);
    if (num >= 1 && num <= 4) return num;
  }

  return null;
}

export function matchVoiceCommand(transcript: string): VoiceCommand | null {
  const n = normalizeSpeechText(transcript);
  if (!n) return null;

  const questionNumber = parseQuestionNumberFromSpeech(n);
  if (questionNumber != null) {
    return { type: "goto_question", questionNumber };
  }

  const roundNumber = parseRoundNumberFromSpeech(n);
  if (roundNumber != null) {
    return { type: "goto_round", roundNumber };
  }

  for (const phrase of PREV_SUBSTRINGS) {
    if (n.includes(normalizeSpeechText(phrase))) return { type: "prev" };
  }

  if (/\botazk\w*\s+(dalsi|dalsia)\b/.test(n)) return { type: "next" };
  if (n === "dalej" || n === "dalsi" || n === "pokracuj" || n === "next") return { type: "next" };

  return null;
}

export function voiceControlErrorMessage(code: string): string | null {
  switch (code) {
    case "not-allowed":
      return "Prístup k mikrofónu bol zamietnutý.";
    case "service-not-allowed":
      return "Prehliadač blokuje službu rozpoznávania reči (Google). Vo Vivaldi skús vypnúť blokovanie Google služieb, alebo otestuj v Chrome.";
    case "network":
      return "Prehliadač sa nevie pripojiť k Google rozpoznávaniu reči (Vo Vivaldi často blokujú trackery). Vypni blokovanie pre mudrc.sk alebo použij Chrome.";
    case "audio-capture":
      return "Mikrofón sa nepodarilo spustiť — skontroluj, či ho nepoužíva iná aplikácia.";
    default:
      return null;
  }
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
