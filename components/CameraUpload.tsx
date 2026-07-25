"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

interface CameraUploadProps {
  onImageSelected: (file: File, preview: string) => void;
  imagePreview?: string;
  imageName?: string;
  onRemove?: () => void;
  maxSizeMB?: number;
  /** Max pixel dimension (width or height). Images get resized before callback. Default 1600. */
  maxResolution?: number;
  /** JPEG-Qualität beim Resizing (0–1). Default 0.85. Für Batch-Uploads mit vielen
   *  Fotos empfiehlt sich ein niedrigerer Wert, damit die Gesamtmenge klein bleibt. */
  quality?: number;
  /** Bei true bleibt die Live-Kamera nach jeder Aufnahme offen, damit mehrere Fotos
   *  hintereinander aufgenommen werden können (z.B. Batch-Upload), statt nach jedem
   *  Foto zu schließen. Fällt die Live-Kamera auf die native Kamera-App zurück, wird
   *  diese nach jedem Foto automatisch erneut geöffnet, bis auf "Fertig" getippt wird. */
  multiple?: boolean;
}

/** Resize image client-side to save bandwidth and speed up AI analysis */
export function resizeImage(
  dataUrl: string,
  maxDim: number,
  quality = 0.85
): Promise<{ dataUrl: string; blob: Blob }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width <= maxDim && height <= maxDim) {
        // No resize needed, convert to jpeg anyway for consistency
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(
          (blob) => resolve({ dataUrl: canvas.toDataURL("image/jpeg", quality), blob: blob! }),
          "image/jpeg",
          quality
        );
        return;
      }
      // Scale down
      if (width > height) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      } else {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => resolve({ dataUrl: canvas.toDataURL("image/jpeg", quality), blob: blob! }),
        "image/jpeg",
        quality
      );
    };
    img.src = dataUrl;
  });
}

export default function CameraUpload({
  onImageSelected,
  imagePreview,
  imageName,
  onRemove,
  maxSizeMB = 20,
  maxResolution = 1600,
  quality = 0.85,
  multiple = false,
}: CameraUploadProps) {
  const [dragging, setDragging] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [multiShotCount, setMultiShotCount] = useState(0);
  // Bleibt true, solange im multiple-Modus die native Kamera-App (Fallback ohne
  // Live-Vorschau) nach jedem Foto automatisch erneut geöffnet werden soll.
  const [nativeLoopActive, setNativeLoopActive] = useState(false);
  // Ref-Spiegel von nativeLoopActive für den verzögerten Re-Open-Check unten —
  // vermeidet einen stale closure, falls "Fertig" zwischen Planung und
  // Ausführung des setTimeout getippt wird.
  const nativeLoopActiveRef = useRef(false);
  useEffect(() => {
    nativeLoopActiveRef.current = nativeLoopActive;
  }, [nativeLoopActive]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
  }, []);

  const handleFile = useCallback(
    (file: File) => {
      if (file.size > maxSizeMB * 1024 * 1024) return;

      // PDFs pass through unresized and use a data URL as preview sentinel
      if (file.type === "application/pdf") {
        const reader = new FileReader();
        reader.onload = (e) => {
          const dataUrl = e.target?.result as string;
          onImageSelected(file, dataUrl);
        };
        reader.readAsDataURL(file);
        return;
      }

      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = async (e) => {
        const rawDataUrl = e.target?.result as string;
        // Resize for faster upload & AI analysis
        const { dataUrl, blob } = await resizeImage(rawDataUrl, maxResolution, quality);
        const resizedFile = new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
          type: "image/jpeg",
        });
        onImageSelected(resizedFile, dataUrl);
      };
      reader.readAsDataURL(file);
    },
    [onImageSelected, maxSizeMB, maxResolution, quality]
  );

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  // Hängt den aktuellen Stream an <video> — läuft als Effekt statt direkt in
  // startCamera()/switchCamera(), weil videoRef.current dort noch null ist:
  // das <video>-Element existiert erst NACH dem Re-Render durch
  // setCameraActive(true), nicht schon während der auslösenden Funktion.
  useEffect(() => {
    if (!cameraActive) return;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (video && stream) {
      video.srcObject = stream;
      video.play().catch((err) => {
        Sentry.captureException(err);
      });
    }
  }, [cameraActive]);

  // Start live camera stream (for devices that support getUserMedia)
  async function startCamera() {
    setCameraError("");
    setMultiShotCount(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);
    } catch (err) {
      Sentry.captureException(err);
      // Fallback: Gerät/Browser unterstützt keine Live-Vorschau (getUserMedia) —
      // native Kamera-App nutzen. Im multiple-Modus wird sie nach jedem Foto
      // automatisch erneut geöffnet (siehe onChange unten), damit trotzdem eine
      // Fotoserie ohne erneutes Antippen von "Kamera verwenden" möglich ist.
      if (cameraInputRef.current) {
        if (multiple) setNativeLoopActive(true);
        cameraInputRef.current.click();
      } else {
        setCameraError("Kamera konnte nicht gestartet werden.");
      }
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }

  async function capturePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    const rawDataUrl = canvas.toDataURL("image/jpeg", 0.9);
    const { dataUrl, blob } = await resizeImage(rawDataUrl, maxResolution, quality);
    const file = new File([blob], `kamera-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`, { type: "image/jpeg" });
    onImageSelected(file, dataUrl);
    if (multiple) {
      setMultiShotCount((c) => c + 1);
    } else {
      stopCamera();
    }
  }

  function switchCamera() {
    const next = facingMode === "environment" ? "user" : "environment";
    setFacingMode(next);
    if (cameraActive) {
      stopCamera();
      // Restart with new facing mode after a small delay
      setTimeout(() => {
        navigator.mediaDevices
          .getUserMedia({
            video: { facingMode: next, width: { ideal: 1920 }, height: { ideal: 1080 } },
            audio: false,
          })
          .then((stream) => {
            streamRef.current = stream;
            setCameraActive(true);
          })
          .catch((err) => {
            Sentry.captureException(err);
            return setCameraError("Kamera wechseln fehlgeschlagen.");
          });
      }, 100);
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Camera view
  if (cameraActive) {
    return (
      <div className="space-y-3">
        <div className="relative rounded-xl overflow-hidden bg-black aspect-[4/3] sm:aspect-video">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          {/* Zähler-Badge im Mehrfach-Modus */}
          {multiple && (
            <div className="absolute top-3 inset-x-0 flex justify-center">
              <span className="px-3 py-1 rounded-full bg-black/60 backdrop-blur text-white text-xs font-semibold">
                {multiShotCount === 0
                  ? "Foto aufnehmen…"
                  : `${multiShotCount} Foto${multiShotCount === 1 ? "" : "s"} aufgenommen`}
              </span>
            </div>
          )}
          {/* Overlay controls */}
          <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/60 to-transparent flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={stopCamera}
              className="w-10 h-10 rounded-full bg-white/20 backdrop-blur text-white flex items-center justify-center hover:bg-white/30 transition-colors"
              title="Abbrechen"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <button
              type="button"
              onClick={capturePhoto}
              className="w-16 h-16 rounded-full bg-white border-4 border-white/50 shadow-lg flex items-center justify-center hover:scale-105 transition-transform active:scale-95"
              title="Foto aufnehmen"
            >
              <div className="w-12 h-12 rounded-full bg-red-500" />
            </button>
            <button
              type="button"
              onClick={switchCamera}
              className="w-10 h-10 rounded-full bg-white/20 backdrop-blur text-white flex items-center justify-center hover:bg-white/30 transition-colors"
              title="Kamera wechseln"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            {multiple && (
              <button
                type="button"
                onClick={stopCamera}
                disabled={multiShotCount === 0}
                className="w-10 h-10 rounded-full bg-green-600 disabled:bg-white/20 disabled:cursor-not-allowed text-white flex items-center justify-center hover:bg-green-700 transition-colors"
                title="Fertig"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </button>
            )}
          </div>
        </div>
        <canvas ref={canvasRef} className="hidden" />
      </div>
    );
  }

  // Preview view
  if (imagePreview) {
    const isPdf = imagePreview.startsWith("data:application/pdf") || /\.pdf$/i.test(imageName || "");
    return (
      <div className="space-y-3">
        <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center min-h-48">
          {isPdf ? (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
              <svg className="w-16 h-16 text-red-500 mb-2" fill="currentColor" viewBox="0 0 24 24">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm4 18H6V4h7v5h5v11zM8 13h8v1H8v-1zm0 3h8v1H8v-1zm0-6h5v1H8v-1z" />
              </svg>
              <p className="text-sm font-medium text-gray-700 break-all">{imageName || "PDF-Dokument"}</p>
              <p className="text-xs text-gray-400 mt-1">PDF-Datei</p>
            </div>
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={imagePreview}
              alt="Vorschau"
              className="max-h-72 max-w-full object-contain"
            />
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm text-gray-600 truncate flex-1 min-w-0">{imageName}</span>
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="text-xs text-red-500 hover:underline shrink-0"
            >
              Entfernen
            </button>
          )}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-xs text-green-700 hover:underline shrink-0"
          >
            Andere Datei
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        {/* Hidden camera input fallback for mobile */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </div>
    );
  }

  // Upload / Camera selection view
  return (
    <div className="space-y-3">
      {/* Fotoserie läuft über die native Kamera-App (kein Live-Vorschau-Support) */}
      {nativeLoopActive ? (
        <div className="rounded-xl border-2 border-green-200 bg-green-50 p-6 text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-full bg-green-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-green-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-green-800">
            Fotoserie läuft — Kamera-App öffnet sich nach jedem Foto automatisch erneut
          </p>
          <p className="text-xs text-green-700">
            {multiShotCount === 0
              ? "Noch kein Foto aufgenommen"
              : `${multiShotCount} Foto${multiShotCount === 1 ? "" : "s"} aufgenommen`}
          </p>
          <button
            type="button"
            onClick={() => setNativeLoopActive(false)}
            disabled={multiShotCount === 0}
            className="px-5 py-2 rounded-lg text-sm font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Fertig
          </button>
        </div>
      ) : (
        <>
          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 sm:p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors ${
              dragging
                ? "border-green-500 bg-green-50"
                : "border-gray-300 hover:border-green-400 hover:bg-gray-50"
            }`}
          >
            <svg
              className="w-12 h-12 text-gray-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-700">
                Datei hier ablegen oder <span className="text-green-700 underline">Datei auswählen</span>
              </p>
              <p className="text-xs text-gray-400 mt-1">JPG, PNG, WEBP, HEIC, PDF</p>
            </div>
          </div>

          {/* Camera button */}
          <button
            type="button"
            onClick={isMobile && !multiple ? () => cameraInputRef.current?.click() : startCamera}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-green-200 bg-green-50 text-green-700 font-medium text-sm hover:bg-green-100 hover:border-green-300 transition-colors active:scale-[0.98]"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {multiple ? "Kamera verwenden (mehrere Fotos)" : "Kamera verwenden"}
          </button>

          {cameraError && (
            <p className="text-xs text-red-500 text-center">{cameraError}</p>
          )}
        </>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      {/* Hidden camera input for mobile native capture */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          const hadFile = !!file;
          if (file) handleFile(file);
          // Input zurücksetzen, damit dieselbe Datei erneut ausgewählt werden
          // könnte und der nächste .click()-Aufruf zuverlässig ein change auslöst.
          e.target.value = "";
          if (multiple) {
            if (hadFile) {
              setMultiShotCount((c) => c + 1);
              // Kamera-App nach kurzer Verzögerung automatisch erneut öffnen,
              // solange die Fotoserie noch nicht mit "Fertig" beendet wurde.
              window.setTimeout(() => {
                if (nativeLoopActiveRef.current) cameraInputRef.current?.click();
              }, 150);
            } else {
              // Nutzer hat die Kamera-App ohne Foto verlassen (Abbrechen) —
              // Fotoserie beenden statt in einer Schleife hängen zu bleiben.
              setNativeLoopActive(false);
            }
          }
        }}
      />
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
