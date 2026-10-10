"use client";
import { belegUrl, belegDateiendung, BELEG_BILD_ENDUNGEN } from "@/lib/beleg-url";

interface Props {
  /** Gespeicherter Beleg-Pfad (Ausgabe.belegPfad / EingangsRechnung.belegpfad), roh wie aus der DB. */
  pfad: string | null;
  /** Anzeigename, falls vom Modell geführt (z.B. Ausgabe.belegDateiname); sonst wird der
   *  Dateiname aus dem Pfad abgeleitet. */
  dateiname?: string | null;
  /** Wird im leeren Zustand ("Kein Beleg hinterlegt") zusätzlich gezeigt, z.B. ein
   *  Upload-Button — bleibt bewusst Sache des Aufrufers, da sich die Upload-Route/Antwortform
   *  je Modul unterscheidet (EingangsRechnung vs. Ausgabe). */
  emptyAction?: React.ReactNode;
  className?: string;
}

/** Zeigt einen archivierten Beleg an: PDF über den nativen Browser-Viewer (iframe — liefert
 *  Zoom/Seiten/Druck/Download ohne eigene Bibliothek), Bild direkt, nicht darstellbare
 *  Dateitypen als Download-Hinweis statt eines leeren Rahmens. Kein eigener State — reine
 *  Anzeige, Hoch-/Ersetzen/Löschen bleibt Sache der jeweiligen Seite. */
export default function BelegVorschau({ pfad, dateiname, emptyAction, className = "" }: Props) {
  const src = belegUrl(pfad);
  const name = dateiname || (pfad ? pfad.split("/").pop() : null) || "Beleg";

  if (!src) {
    return (
      <div className={`flex flex-col items-center justify-center text-center bg-gray-50 border border-dashed border-gray-300 rounded-xl p-8 ${className}`}>
        <svg className="w-10 h-10 text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m-9 4h18a2 2 0 002-2V8a2 2 0 00-2-2h-6l-2-2H4a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p className="text-sm text-gray-400">Kein Beleg hinterlegt.</p>
        {emptyAction && <div className="mt-3">{emptyAction}</div>}
      </div>
    );
  }

  const ext = belegDateiendung(pfad ?? "");
  const istPdf = ext === "pdf";
  const istBild = BELEG_BILD_ENDUNGEN.has(ext);

  return (
    <div className={`flex flex-col bg-gray-50 border border-gray-200 rounded-xl overflow-hidden ${className}`}>
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-white border-b border-gray-200 text-xs">
        <span className="text-gray-600 truncate" title={name}>{name}</span>
        <a href={src} target="_blank" rel="noreferrer" className="text-green-700 hover:underline shrink-0">
          In neuem Tab öffnen
        </a>
      </div>
      <div className="flex-1 min-h-[60vh] bg-gray-100">
        {istPdf ? (
          <iframe src={src} title={name} className="w-full h-full min-h-[60vh] border-0" />
        ) : istBild ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={name} className="w-full h-full object-contain" />
        ) : (
          <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center p-8">
            <p className="text-sm text-gray-500 mb-2">Dieser Dateityp kann nicht angezeigt werden.</p>
            <a href={src} download className="text-sm text-green-700 hover:underline font-medium">
              Herunterladen
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
