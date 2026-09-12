"use client";

import { useEffect, useRef, useState } from "react";
import {
  commandKeyFromVoiceCommand,
  createPresentationVoiceRecognition,
  isSpeechRecognitionSupported,
  matchVoiceCommandFromResults,
  shouldAcceptVoiceCommand,
  voiceControlErrorMessage,
  type VoiceCommand,
} from "@/lib/presentation-voice-control";

const RECOGNITION_LANGS = ["sk-SK", "cs-CZ"] as const;

function collectTranscripts(
  result: {
    isFinal: boolean;
    length?: number;
    [altIndex: number]: { transcript: string } | boolean;
  }
): string[] {
  const out: string[] = [];
  const altCount = typeof result.length === "number" ? Math.min(result.length, 5) : 1;
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
    let restartTimer: number | null = null;
    let interimConfirmKey = "";
    let interimConfirmCount = 0;
    const langIndexRef = { current: 0 };

    const applyLang = (index: number) => {
      langIndexRef.current = index;
      const lang = RECOGNITION_LANGS[index] ?? RECOGNITION_LANGS[0];
      recognition!.lang = lang;
      setRecognitionLang(lang);
    };

    applyLang(0);

    const clearRestartTimer = () => {
      if (restartTimer != null) {
        window.clearTimeout(restartTimer);
        restartTimer = null;
      }
    };

    const stopRecognition = () => {
      fatal = true;
      stopped = true;
      clearRestartTimer();
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
      clearRestartTimer();
      setConnecting(true);
      restartTimer = window.setTimeout(() => {
        restartTimer = null;
        if (stopped || fatal || !enabledRef.current || !activeRef.current) return;
        try {
          recognition!.start();
          setListening(true);
          setConnecting(false);
        } catch {
          scheduleRestart(Math.min(delayMs + 200, 1200));
        }
      }, delayMs);
    };

    const tryDispatchCommand = (command: VoiceCommand, isFinal: boolean) => {
      const key = commandKeyFromVoiceCommand(command);
      const now = Date.now();

      if (!isFinal && (command.type === "next" || command.type === "prev")) return;

      if (!isFinal) {
        if (key === interimConfirmKey) interimConfirmCount += 1;
        else {
          interimConfirmKey = key;
          interimConfirmCount = 1;
        }
        if (interimConfirmCount < 2) return;
      } else {
        interimConfirmKey = "";
        interimConfirmCount = 0;
      }

      if (!shouldAcceptVoiceCommand(command, key, lastKey, now - lastFire)) return;

      lastFire = now;
      lastKey = key;
      networkRetries = 0;
      setConnecting(false);
      setError(null);
      setFailed(false);
      onCommandRef.current(command);
    };

    const handleResultBundle = (transcripts: string[], isFinal: boolean) => {
      const joined = transcripts.join(" · ");
      if (joined.trim()) setLastTranscript(joined);

      const command = matchVoiceCommandFromResults(transcripts);
      if (!command) {
        if (isFinal) {
          interimConfirmKey = "";
          interimConfirmCount = 0;
        }
        return;
      }
      tryDispatchCommand(command, isFinal);
    };

    recognition.onstart = () => {
      setListening(true);
      setConnecting(false);
    };

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcripts = collectTranscripts(result);
        handleResultBundle(transcripts, result.isFinal);
      }
    };

    recognition.onerror = (event) => {
      if (event.error === "no-speech") {
        scheduleRestart(80);
        return;
      }
      if (event.error === "aborted") return;
      if (fatal || stopped) return;

      if (event.error === "network") {
        networkRetries += 1;
        if (networkRetries <= 4) {
          setError(`Pripájam rozpoznávanie… (${networkRetries}/4)`);
          scheduleRestart(Math.min(800 * networkRetries, 3200));
          return;
        }
        setFailed(true);
        setError(voiceControlErrorMessage("network"));
        stopRecognition();
        return;
      }

      if (event.error === "language-not-supported" && tryNextLang()) {
        scheduleRestart(200);
        return;
      }

      const message = voiceControlErrorMessage(event.error);
      if (message) setError(message);
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
      scheduleRestart(networkRetries > 0 ? 400 : 60);
    };

    try {
      recognition.start();
      setListening(true);
      setConnecting(false);
      setFailed(false);
      setError(null);
    } catch {
      scheduleRestart(300);
    }

    const activeRecognition = recognition;

    return () => {
      stopped = true;
      fatal = true;
      clearRestartTimer();
      activeRecognition.onstart = null;
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
