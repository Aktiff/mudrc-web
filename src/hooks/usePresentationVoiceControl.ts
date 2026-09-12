"use client";

import { useEffect, useRef, useState } from "react";
import {
  createPresentationVoiceRecognition,
  isSpeechRecognitionSupported,
  matchVoiceCommand,
  voiceControlErrorMessage,
} from "@/lib/presentation-voice-control";

const COMMAND_COOLDOWN_MS = 1200;
const MAX_NETWORK_RETRIES = 10;

const RECOGNITION_LANGS = ["sk-SK", "cs-CZ"] as const;

function collectTranscripts(
  result: {
    isFinal: boolean;
    length?: number;
    [altIndex: number]: { transcript: string } | boolean;
  }
): string[] {
  const out: string[] = [];
  const altCount = typeof result.length === "number" ? result.length : 1;
  for (let j = 0; j < altCount; j += 1) {
    const alt = result[j];
    if (alt && typeof alt === "object" && "transcript" in alt && alt.transcript) {
      out.push(alt.transcript);
    }
  }
  const first = result[0];
  if (!out.length && first && typeof first === "object" && "transcript" in first && first.transcript) {
    out.push(first.transcript);
  }
  return out;
}

export function usePresentationVoiceControl(
  active: boolean,
  enabled: boolean,
  onNext: () => void,
  onPrev: () => void
) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastTranscript, setLastTranscript] = useState("");
  const [recognitionLang, setRecognitionLang] = useState<string>(RECOGNITION_LANGS[0]);
  const enabledRef = useRef(enabled);
  const activeRef = useRef(active);
  const onNextRef = useRef(onNext);
  const onPrevRef = useRef(onPrev);
  const langIndexRef = useRef(0);
  enabledRef.current = enabled;
  activeRef.current = active;
  onNextRef.current = onNext;
  onPrevRef.current = onPrev;

  useEffect(() => {
    if (!active || !enabled) {
      setListening(false);
      setLastTranscript("");
      setError(null);
      langIndexRef.current = 0;
      setRecognitionLang(RECOGNITION_LANGS[0]);
      return;
    }

    let recognition = createPresentationVoiceRecognition();
    if (!recognition) {
      setError("Prehliadač nepodporuje rozpoznávanie reči (skús Chrome alebo Edge).");
      return;
    }

    let lastFire = 0;
    let networkRetries = 0;
    let stopped = false;

    const applyLang = (index: number) => {
      langIndexRef.current = index;
      const lang = RECOGNITION_LANGS[index] ?? RECOGNITION_LANGS[0];
      recognition!.lang = lang;
      setRecognitionLang(lang);
    };

    applyLang(0);

    const tryNextLang = (): boolean => {
      const next = langIndexRef.current + 1;
      if (next >= RECOGNITION_LANGS.length) return false;
      applyLang(next);
      return true;
    };

    const handleResult = (transcript: string, isFinal: boolean) => {
      const trimmed = transcript.trim();
      if (!trimmed) return;
      setLastTranscript(trimmed);
      const command = matchVoiceCommand(trimmed);
      if (!command) return;
      if (!isFinal && trimmed.length < 4) return;

      const now = Date.now();
      if (now - lastFire < COMMAND_COOLDOWN_MS) return;
      lastFire = now;

      if (command === "next") onNextRef.current();
      else onPrevRef.current();
      networkRetries = 0;
      setError(null);
    };

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcripts = collectTranscripts(result);
        for (const text of transcripts) {
          handleResult(text, result.isFinal);
        }
      }
    };

    recognition.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") return;

      if (event.error === "network") {
        networkRetries += 1;
        if (networkRetries <= MAX_NETWORK_RETRIES) {
          setError(`Pripájam rozpoznávanie… (${networkRetries}/${MAX_NETWORK_RETRIES})`);
          setListening(false);
          return;
        }
        setError(voiceControlErrorMessage("network"));
        setListening(false);
        return;
      }

      if (event.error === "language-not-supported" && tryNextLang()) {
        window.setTimeout(() => {
          if (stopped || !enabledRef.current) return;
          try {
            recognition!.start();
            setListening(true);
          } catch {
            setListening(false);
          }
        }, 300);
        return;
      }

      const message = voiceControlErrorMessage(event.error);
      if (message) {
        setError(message);
      }
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setListening(false);
      }
    };

    recognition.onend = () => {
      if (stopped || !enabledRef.current || !activeRef.current) {
        setListening(false);
        return;
      }
      window.setTimeout(() => {
        if (stopped || !enabledRef.current || !activeRef.current) return;
        try {
          recognition!.start();
          setListening(true);
        } catch {
          setListening(false);
        }
      }, 250);
    };

    try {
      recognition.start();
      setListening(true);
      setError(null);
    } catch {
      setError("Nepodarilo sa spustiť rozpoznávanie reči.");
      setListening(false);
    }

    const activeRecognition = recognition;

    return () => {
      stopped = true;
      activeRecognition.onend = null;
      activeRecognition.onresult = null;
      activeRecognition.onerror = null;
      try {
        activeRecognition.abort();
      } catch {
        /* ignore */
      }
      setListening(false);
    };
  }, [active, enabled]);

  return {
    listening,
    error,
    lastTranscript,
    recognitionLang,
    supported: isSpeechRecognitionSupported(),
  };
}
