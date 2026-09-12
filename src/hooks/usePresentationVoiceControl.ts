"use client";

import { useEffect, useRef, useState } from "react";
import {
  createPresentationVoiceRecognition,
  isSpeechRecognitionSupported,
  matchVoiceCommand,
} from "@/lib/presentation-voice-control";

const COMMAND_COOLDOWN_MS = 1400;

export function usePresentationVoiceControl(
  active: boolean,
  enabled: boolean,
  onNext: () => void,
  onPrev: () => void
) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enabledRef = useRef(enabled);
  const activeRef = useRef(active);
  const onNextRef = useRef(onNext);
  const onPrevRef = useRef(onPrev);
  enabledRef.current = enabled;
  activeRef.current = active;
  onNextRef.current = onNext;
  onPrevRef.current = onPrev;

  useEffect(() => {
    if (!active || !enabled) {
      setListening(false);
      return;
    }

    const recognition = createPresentationVoiceRecognition();
    if (!recognition) {
      setError("Prehliadač nepodporuje rozpoznávanie reči (skús Chrome alebo Edge).");
      return;
    }

    let lastFire = 0;

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (!result.isFinal) continue;
        const transcript = result[0]?.transcript ?? "";
        const command = matchVoiceCommand(transcript);
        if (!command) continue;

        const now = Date.now();
        if (now - lastFire < COMMAND_COOLDOWN_MS) continue;
        lastFire = now;

        if (command === "next") onNextRef.current();
        else onPrevRef.current();
      }
    };

    recognition.onerror = (event) => {
      if (event.error === "not-allowed") {
        setError("Prístup k mikrofónu bol zamietnutý.");
        setListening(false);
      }
    };

    recognition.onend = () => {
      if (!enabledRef.current || !activeRef.current) {
        setListening(false);
        return;
      }
      try {
        recognition.start();
        setListening(true);
      } catch {
        setListening(false);
      }
    };

    try {
      recognition.start();
      setListening(true);
      setError(null);
    } catch {
      setError("Nepodarilo sa spustiť rozpoznávanie reči.");
      setListening(false);
    }

    return () => {
      recognition.onend = null;
      recognition.onresult = null;
      recognition.onerror = null;
      try {
        recognition.abort();
      } catch {
        /* ignore */
      }
      setListening(false);
    };
  }, [active, enabled]);

  return {
    listening,
    error,
    supported: isSpeechRecognitionSupported(),
  };
}
