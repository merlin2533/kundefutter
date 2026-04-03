"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  maxDurationSec?: number;
  placeholder?: string;
  className?: string;
}

export default function VoiceInput({
  onTranscript,
  maxDurationSec = 120,
  placeholder = "Spracheingabe starten...",
  className = "",
}: VoiceInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [supported, setSupported] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const finalTranscriptRef = useRef("");

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSupported(false);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
  }, []);

  const startRecording = useCallback(() => {
    setError("");
    setTranscript("");
    finalTranscriptRef.current = "";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError("Spracheingabe wird von diesem Browser nicht unterstützt.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "de-DE";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onresult = (event: any) => {
      let interim = "";
      let final = "";
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      finalTranscriptRef.current = final;
      setTranscript(final + (interim ? interim : ""));
    };

    recognition.onerror = (event: any) => {
      if (event.error === "no-speech") return;
      if (event.error === "aborted") return;
      setError(
        event.error === "not-allowed"
          ? "Mikrofon-Zugriff verweigert. Bitte Berechtigung erteilen."
          : `Fehler: ${event.error}`
      );
      stopRecording();
    };

    recognition.onend = () => {
      // If still supposed to be recording (auto-stop by browser), restart
      if (recognitionRef.current && isRecording) {
        try {
          recognition.start();
        } catch {
          // Already ended
        }
        return;
      }
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      // Send final transcript
      const text = finalTranscriptRef.current.trim();
      if (text) {
        onTranscript(text);
      }
    };

    try {
      recognition.start();
      setIsRecording(true);
      startTimeRef.current = Date.now();
      setElapsed(0);

      timerRef.current = setInterval(() => {
        const secs = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setElapsed(secs);
        if (secs >= maxDurationSec) {
          stopRecording();
        }
      }, 500);
    } catch {
      setError("Spracheingabe konnte nicht gestartet werden.");
    }
  }, [maxDurationSec, onTranscript, stopRecording, isRecording]);

  function handleStop() {
    const text = (finalTranscriptRef.current + "").trim() || transcript.trim();
    stopRecording();
    if (text) {
      onTranscript(text);
    }
  }

  // Cleanup
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  function formatTime(secs: number) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  if (!supported) {
    return null;
  }

  if (isRecording) {
    return (
      <div className={`rounded-xl border-2 border-red-200 bg-red-50 p-4 space-y-3 ${className}`}>
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center">
            <div className="w-4 h-4 rounded-full bg-red-500 animate-pulse" />
            <div className="absolute w-8 h-8 rounded-full bg-red-200 animate-ping opacity-30" />
          </div>
          <span className="text-sm font-medium text-red-700">Aufnahme läuft</span>
          <span className="text-xs text-red-500 ml-auto font-mono">
            {formatTime(elapsed)} / {formatTime(maxDurationSec)}
          </span>
        </div>

        {/* Live transcript */}
        {transcript && (
          <div className="rounded-lg bg-white border border-red-100 p-3 text-sm text-gray-700 max-h-32 overflow-y-auto">
            {transcript}
          </div>
        )}

        {/* Progress bar */}
        <div className="h-1 bg-red-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-red-500 transition-all duration-500"
            style={{ width: `${Math.min((elapsed / maxDurationSec) * 100, 100)}%` }}
          />
        </div>

        <button
          type="button"
          onClick={handleStop}
          className="w-full py-2.5 rounded-lg bg-red-600 text-white font-medium text-sm hover:bg-red-700 transition-colors flex items-center justify-center gap-2 active:scale-[0.98]"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
          Aufnahme beenden
        </button>
      </div>
    );
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={startRecording}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-blue-200 bg-blue-50 text-blue-700 font-medium text-sm hover:bg-blue-100 hover:border-blue-300 transition-colors active:scale-[0.98]"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-14 0m7 7v4m-4 0h8M12 1a3 3 0 00-3 3v7a3 3 0 006 0V4a3 3 0 00-3-3z" />
        </svg>
        {placeholder}
      </button>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
