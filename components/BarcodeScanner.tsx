"use client";
import { useEffect, useRef, useState } from "react";

export interface BarcodeScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
}

declare class BarcodeDetector {
  constructor(options?: { formats?: string[] });
  detect(source: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement | ImageBitmap): Promise<Array<{ rawValue: string; format: string }>>;
  static getSupportedFormats(): Promise<string[]>;
}

export default function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [useFallback, setUseFallback] = useState(false);
  const [scanning, setScanning] = useState(false);

  const hasBarcodeDetector = typeof window !== "undefined" && "BarcodeDetector" in window;

  useEffect(() => {
    if (!hasBarcodeDetector) {
      setUseFallback(true);
      return;
    }

    async function startCamera() {
      try {
        setScanning(true);
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          startDetection();
        }
      } catch {
        setUseFallback(true);
        setScanning(false);
      }
    }

    function startDetection() {
      const detector = new BarcodeDetector({
        formats: ["ean_13", "ean_8", "qr_code", "code_128", "code_39"],
      });

      async function tick() {
        if (!videoRef.current || videoRef.current.readyState < 2) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes.length > 0) {
            stopCamera();
            onScan(barcodes[0].rawValue);
            return;
          }
        } catch {
          // detection error — keep scanning
        }
        rafRef.current = requestAnimationFrame(tick);
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    startCamera();

    return () => {
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopCamera() {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setScanning(false);
  }

  function handleClose() {
    stopCamera();
    onClose();
  }

  function handleFallbackFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!hasBarcodeDetector) {
      setError("BarcodeDetector nicht verfügbar — bitte manuell eingeben.");
      return;
    }

    createImageBitmap(file).then(async (bitmap) => {
      try {
        const detector = new BarcodeDetector({
          formats: ["ean_13", "ean_8", "qr_code", "code_128", "code_39"],
        });
        const barcodes = await detector.detect(bitmap);
        if (barcodes.length > 0) {
          onScan(barcodes[0].rawValue);
        } else {
          setError("Kein Barcode im Bild erkannt — bitte erneut versuchen.");
        }
      } catch {
        setError("Barcode-Erkennung fehlgeschlagen.");
      }
    }).catch(() => {
      setError("Bild konnte nicht geladen werden.");
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90"
      role="dialog"
      aria-modal="true"
      aria-label="Barcode Scanner"
    >
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 z-10">
        <span className="text-white font-semibold text-sm">Barcode / EAN scannen</span>
        <button
          onClick={handleClose}
          className="text-white bg-white/20 hover:bg-white/30 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          Abbrechen
        </button>
      </div>

      {useFallback ? (
        /* Fallback: file input */
        <div className="flex flex-col items-center gap-4 px-6 text-center">
          <div className="text-white/60 text-4xl">📷</div>
          <p className="text-white font-medium">Kamera-Scanner nicht verfügbar</p>
          <p className="text-white/60 text-sm">
            Bitte ein Foto des Barcodes aufnehmen oder hochladen.
          </p>
          {error && (
            <p className="text-red-400 text-sm bg-red-900/40 rounded px-3 py-2">{error}</p>
          )}
          <label className="cursor-pointer bg-green-700 hover:bg-green-600 text-white px-5 py-3 rounded-lg font-medium text-sm transition-colors">
            Bild aufnehmen / hochladen
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFallbackFile}
              className="hidden"
            />
          </label>
        </div>
      ) : (
        /* Live camera feed */
        <div className="relative w-full max-w-sm aspect-square flex items-center justify-center">
          <video
            ref={videoRef}
            className="w-full h-full object-cover rounded-xl"
            muted
            playsInline
          />

          {/* Viewfinder overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {/* Dark corners mask */}
            <div className="absolute inset-0 bg-black/40" />
            {/* Green scanner frame */}
            <div
              className="relative z-10"
              style={{ width: "65%", height: "65%" }}
            >
              {/* Animated scan line */}
              {scanning && (
                <div
                  className="absolute left-0 right-0 h-0.5 bg-green-400"
                  style={{
                    animation: "scanline 1.5s ease-in-out infinite",
                    top: "50%",
                  }}
                />
              )}
              {/* Corner brackets */}
              {(["top-0 left-0", "top-0 right-0", "bottom-0 left-0", "bottom-0 right-0"] as const).map(
                (pos, i) => {
                  const isRight = i === 1 || i === 3;
                  const isBottom = i === 2 || i === 3;
                  return (
                    <span
                      key={pos}
                      className="absolute w-6 h-6 border-green-400"
                      style={{
                        top: isBottom ? undefined : 0,
                        bottom: isBottom ? 0 : undefined,
                        left: isRight ? undefined : 0,
                        right: isRight ? 0 : undefined,
                        borderTopWidth: isBottom ? 0 : 3,
                        borderBottomWidth: isBottom ? 3 : 0,
                        borderLeftWidth: isRight ? 0 : 3,
                        borderRightWidth: isRight ? 3 : 0,
                        borderColor: "#4ade80",
                      }}
                    />
                  );
                }
              )}
            </div>
          </div>

          {error && (
            <div className="absolute bottom-3 left-3 right-3 bg-red-900/80 text-red-200 text-xs rounded px-3 py-2 text-center">
              {error}
            </div>
          )}
        </div>
      )}

      <p className="mt-4 text-white/50 text-xs">
        {useFallback ? "" : "Barcode / QR-Code in den Rahmen halten"}
      </p>

      <style jsx global>{`
        @keyframes scanline {
          0%, 100% { transform: translateY(-100%); opacity: 0.4; }
          50% { transform: translateY(100%); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
