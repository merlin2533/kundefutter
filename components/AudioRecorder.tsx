"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface AudioRecorderProps {
  onTranscript: (text: string) => void;
  feature: "crm" | "sprachmemo";
  maxDurationSec?: number;
  placeholder?: string;
  className?: string;
}

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t));
}

export default function AudioRecorder({
  onTranscript,
  feature,
  maxDurationSec = 120,
  placeholder = "Diktieren starten...",
  className = "",
}: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [supported, setSupported] = useState(true);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    const hasSupport =
      typeof navigator !== "undefined" &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof MediaRecorder !== "undefined";
    setSupported(hasSupport);
  }, []);

  const cleanupStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const uploadAndTranscribe = useCallback(
    async (blob: Blob) => {
      setIsTranscribing(true);
      setError("");
      try {
        const fd = new FormData();
        const ext = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
        fd.append("audio", blob, `aufnahme.${ext}`);
        fd.append("feature", feature);

        const res = await fetch("/api/ki/transcribe", { method: "POST", body: fd });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error ?? `Fehler ${res.status}`);
        }
        const data = await res.json();
        const text = typeof data.text === "string" ? data.text.trim() : "";
        if (text) onTranscript(text);
        else setError("Keine Sprache erkannt. Bitte erneut versuchen.");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Transkription fehlgeschlagen.");
      } finally {
        setIsTranscribing(false);
      }
    },
    [feature, onTranscript]
  );

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    cleanupStream();
    setIsRecording(false);
  }, [cleanupStream]);

  const startRecording = useCallback(async () => {
    setError("");
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType || "audio/webm" });
        chunksRef.current = [];
        if (blob.size > 0) uploadAndTranscribe(blob);
      };

      recorder.start();
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
    } catch (e) {
      const domError = e as DOMException;
      setError(
        domError?.name === "NotAllowedError"
          ? "Mikrofon-Zugriff verweigert. Bitte Berechtigung erteilen."
          : "Aufnahme konnte nicht gestartet werden."
      );
    }
  }, [maxDurationSec, stopRecording, uploadAndTranscribe]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
      cleanupStream();
    };
  }, [cleanupStream]);

  function formatTime(secs: number) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  if (!supported) {
    return (
      <div className={className}>
        <p className="text-xs text-red-500">
          Diktieren wird von diesem Browser nicht unterstützt (Mikrofonzugriff/MediaRecorder fehlt).
        </p>
      </div>
    );
  }

  if (isTranscribing) {
    return (
      <div className={`rounded-xl border-2 border-blue-200 bg-blue-50 p-4 space-y-3 ${className}`}>
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
          <span className="text-sm font-medium text-blue-700">Transkribiere Aufnahme…</span>
        </div>
      </div>
    );
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

        <div className="h-1 bg-red-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-red-500 transition-all duration-500"
            style={{ width: `${Math.min((elapsed / maxDurationSec) * 100, 100)}%` }}
          />
        </div>

        <button
          type="button"
          onClick={stopRecording}
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
