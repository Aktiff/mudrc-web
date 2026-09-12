"use client";

import { useEffect, useRef, useState } from "react";
import {
  createPresentationVoiceRecognition,
  isSpeechRecognitionSupported,
  matchVoiceCommand,
  voiceControlErrorMessage,
  type VoiceCommand,
} from "@/lib/presentation-voice-control";

const COMMAND_COOLDOWN_MS = 2800;

const RECOGNITION_LANGS = ["sk-SK", "cs-CZ"] as const;

function commandKey(command: VoiceCommand): string {
  if (command.type === "goto_question") return `goto-${command.questionNumber}`;
  return command.type;
}

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
  onCommand: (command: VoiceCommand) => void
) {
  const [listening, setListening] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [failed, setFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastTranscript, setLastTranscript] = useState("");
  const [recognitionLang, setRecognitionLang] = useState<string>(RECOGNITION_LANGS[0]);
  const enabledRef = useRef(enabled);
  const activeRef = useRef(active);
  const onCommandRef = useRef(onCommand);
  enabledRef.current = enabled;
  activeRef.current = active;
  onCommandRef.current = onCommand;

  useEffect(() => {
    if (!active || !enabled) {
      setListening(false);
      setConnecting(false);
      setFailed(false);
      setLastTranscript("");
      setError(null);
      setRecognitionLang(RECOGNITION_LANGS[0]);
      return;
    }

    let recognition = createPresentationVoiceRecognition();
    if (!recognition) {
      setError("Prehliadač nepodporuje rozpoznávanie reči (skús Chrome alebo Edge).");
      setFailed(true);
      return;
    }

    let lastFire = 0;
    let lastKey = "";
    let networkRetries = 0;
    let stopped = false;
    let fatal = false;
    const langIndexRef = { current: 0 };

    const applyLang = (index: number) => {
      langIndexRef.current = index;
      const lang = RECOGNITION_LANGS[index] ?? RECOGNITION_LANGS[0];
      recognition!.lang = lang;
      setRecognitionLang(lang);
    };

    applyLang(0);

    const stopRecognition = () => {
      fatal = true;
      stopped = true;
      setListening(false);
      setConnecting(false);
      try {
        recognition?.abort();
      } catch {
        /* ignore */
      }
    };

    const tryNextLang = (): boolean => {
      const next = langIndexRef.current + 1;
      if (next >= RECOGNITION_LANGS.length) return false;
      applyLang(next);
      return true;
    };

    const scheduleRestart = (delayMs: number) => {
      window.setTimeout(() => {
        if (stopped || fatal || !enabledRef.current || !activeRef.current) return;
        try {
          recognition!.start();
          setListening(true);
          setConnecting(false);
        } catch {
          setListening(false);
          setConnecting(false);
        }
      }, delayMs);
    };

    const handleFinalTranscript = (transcript: string) => {
      const trimmed = transcript.trim();
      if (!trimmed) return;
      setLastTranscript(trimmed);

      const command = matchVoiceCommand(trimmed);
      if (!command) return;

      const key = commandKey(command);
      const now = Date.now();
      if (key === lastKey && now - lastFire < COMMAND_COOLDOWN_MS) return;
      if (now - lastFire < COMMAND_COOLDOWN_MS) return;

      lastFire = now;
      lastKey = key;
      networkRetries = 0;
      setConnecting(false);
      setError(null);
      setFailed(false);
      onCommandRef.current(command);
    };

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (!result.isFinal) continue;
        const transcripts = collectTranscripts(result);
        for (const text of transcripts) {
          handleFinalTranscript(text);
        }
      }
    };

    recognition.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      if (fatal || stopped) return;

      if (event.error === "network") {
        networkRetries += 1;
        if (networkRetries <= 4) {
          setConnecting(true);
          setError(`Pripájam rozpoznávanie… (${networkRetries}/4)`);
          return;
        }
        setFailed(true);
        setError(voiceControlErrorMessage("network"));
        stopRecognition();
        return;
      }

      if (event.error === "language-not-supported" && tryNextLang()) {
        setConnecting(true);
        scheduleRestart(400);
        return;
      }

      const message = voiceControlErrorMessage(event.error);
      if (message) {
        setError(message);
      }
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setFailed(true);
        stopRecognition();
      }
    };

    recognition.onend = () => {
      if (stopped || fatal || !enabledRef.current || !activeRef.current) {
        setListening(false);
        setConnecting(false);
        return;
      }

      const delay =
        networkRetries > 0 && networkRetries <= 4 ? Math.min(1500 * networkRetries, 6000) : 300;
      scheduleRestart(delay);
    };

    try {
      recognition.start();
      setListening(true);
      setConnecting(false);
      setFailed(false);
      setError(null);
    } catch {
      setError("Nepodarilo sa spustiť rozpoznávanie reči.");
      setFailed(true);
      setListening(false);
    }

    const activeRecognition = recognition;

    return () => {
      stopped = true;
      fatal = true;
      activeRecognition.onend = null;
      activeRecognition.onresult = null;
      activeRecognition.onerror = null;
      try {
        activeRecognition.abort();
      } catch {
        /* ignore */
      }
      setListening(false);
      setConnecting(false);
    };
  }, [active, enabled]);

  return {
    listening,
    connecting,
    failed,
    error,
    lastTranscript,
    recognitionLang,
    supported: isSpeechRecognitionSupported(),
  };
}
