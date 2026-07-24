"use client";

import { useRef } from "react";
import CameraUpload, { resizeImage } from "@/components/CameraUpload";

export interface AusgewaehlteDatei {
  file: File;
  preview: string;
}

const MAX_SIZE_MB = 20;

// Kleinere Auflösung/Qualität als beim Einzel-Upload (1600px/0.85): bei einer
// Serie von 10–20 Fotos zählt die Gesamtmenge — die Mistral-OCR liest den
// Text auch bei 1400px/0.75 zuverlässig, die Datei bleibt aber deutlich kleiner.
const BATCH_MAX_RESOLUTION = 1400;
const BATCH_QUALITY = 0.75;

async function verarbeiteDatei(file: File): Promise<AusgewaehlteDatei | null> {
  if (file.size > MAX_SIZE_MB * 1024 * 1024) return null;

  if (file.type === "application/pdf") {
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.readAsDataURL(file);
    });
    return { file, preview: dataUrl };
  }

  if (!file.type.startsWith("image/")) return null;

  const rawDataUrl = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.readAsDataURL(file);
  });
  const { dataUrl, blob } = await resizeImage(rawDataUrl, BATCH_MAX_RESOLUTION, BATCH_QUALITY);
  const resizedFile = new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
  return { file: resizedFile, preview: dataUrl };
}

function formatDateigroesse(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MultiCameraUpload({
  dateien,
  onChange,
}: {
  dateien: AusgewaehlteDatei[];
  onChange: (dateien: AusgewaehlteDatei[]) => void;
}) {
  const multiInputRef = useRef<HTMLInputElement>(null);

  async function dateienHinzufuegen(files: FileList | File[]) {
    const verarbeitet = await Promise.all(Array.from(files).map(verarbeiteDatei));
    const gueltig = verarbeitet.filter((d): d is AusgewaehlteDatei => d !== null);
    if (gueltig.length > 0) onChange([...dateien, ...gueltig]);
  }

  function entfernen(idx: number) {
    onChange(dateien.filter((_, i) => i !== idx));
  }

  const gesamtgroesse = dateien.reduce((sum, d) => sum + d.file.size, 0);

  return (
    <div className="space-y-4">
      {dateien.length > 0 && (
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{dateien.length} Datei{dateien.length === 1 ? "" : "en"}</span>
          <span>Gesamtgröße: {formatDateigroesse(gesamtgroesse)}</span>
        </div>
      )}
      {dateien.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {dateien.map((d, idx) => {
            const isPdf = d.preview.startsWith("data:application/pdf");
            return (
              <div
                key={idx}
                className="relative rounded-lg overflow-hidden border border-gray-200 bg-gray-50 aspect-square flex items-center justify-center"
              >
                {isPdf ? (
                  <div className="flex flex-col items-center justify-center p-2 text-center">
                    <svg className="w-8 h-8 text-red-500 mb-1" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm4 18H6V4h7v5h5v11z" />
                    </svg>
                    <p className="text-[11px] text-gray-500 truncate w-full">{d.file.name}</p>
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={d.preview} alt={d.file.name} className="w-full h-full object-cover" />
                )}
                <button
                  type="button"
                  onClick={() => entfernen(idx)}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
                  title="Entfernen"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <span className="absolute bottom-1 left-1 text-[10px] font-semibold text-white bg-black/50 rounded px-1.5 py-0.5">
                  {idx + 1}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <CameraUpload
        onImageSelected={(file, preview) => onChange([...dateien, { file, preview }])}
        imageName="Lieferschein hinzufügen"
        multiple
        maxResolution={BATCH_MAX_RESOLUTION}
        quality={BATCH_QUALITY}
      />

      <div className="flex items-center gap-2">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-xs text-gray-400">oder</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      <button
        type="button"
        onClick={() => multiInputRef.current?.click()}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-gray-200 bg-gray-50 text-gray-700 font-medium text-sm hover:bg-gray-100 hover:border-gray-300 transition-colors"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        Mehrere Dateien auswählen
      </button>
      <input
        ref={multiInputRef}
        type="file"
        multiple
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            dateienHinzufuegen(e.target.files);
            e.target.value = "";
          }
        }}
      />
    </div>
  );
}
