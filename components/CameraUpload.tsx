"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface CameraUploadProps {
  onImageSelected: (file: File, preview: string) => void;
  imagePreview?: string;
  imageName?: string;
  onRemove?: () => void;
  maxSizeMB?: number;
  /** Max pixel dimension (width or height). Images get resized before callback. Default 1600. */
  maxResolution?: number;
}

/** Resize image client-side to save bandwidth and speed up AI analysis */
function resizeImage(
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
}: CameraUploadProps) {
  const [dragging, setDragging] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
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
        const { dataUrl, blob } = await resizeImage(rawDataUrl, maxResolution);
        const resizedFile = new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
          type: "image/jpeg",
        });
        onImageSelected(resizedFile, dataUrl);
      };
      reader.readAsDataURL(file);
    },
    [onImageSelected, maxSizeMB, maxResolution]
  );

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  // Start live camera stream (for devices that support getUserMedia)
  async function startCamera() {
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch {
      // Fallback: use native file input with capture
      if (cameraInputRef.current) {
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
    const { dataUrl, blob } = await resizeImage(rawDataUrl, maxResolution);
    const file = new File([blob], `kamera-${Date.now()}.jpg`, { type: "image/jpeg" });
    onImageSelected(file, dataUrl);
    stopCamera();
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
            if (videoRef.current) {
              videoRef.current.srcObject = stream;
              videoRef.current.play();
            }
            setCameraActive(true);
          })
          .catch(() => setCameraError("Kamera wechseln fehlgeschlagen."));
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
        onClick={isMobile ? () => cameraInputRef.current?.click() : startCamera}
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
        Kamera verwenden
      </button>

      {cameraError && (
        <p className="text-xs text-red-500 text-center">{cameraError}</p>
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
          if (file) handleFile(file);
        }}
      />
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
