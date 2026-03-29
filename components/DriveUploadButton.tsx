"use client";

import { useState } from "react";

interface Props {
  /** Kunde-ID für die Zuordnung im Drive */
  kundeId: number;
  /** Dokumenttyp — bestimmt den Unterordner */
  typ: "rechnung" | "lieferschein" | "angebot";
  /** Dateiname, der in Drive gespeichert wird */
  dateiName: string;
  /**
   * Funktion, die den HTML-Inhalt (das Dokument-Element) als base64-PDF liefert.
   * Wird aufgerufen, wenn der Nutzer auf den Button klickt.
   * Gibt null zurück, wenn kein pdf generiert werden konnte (z.B. html2canvas fehlt).
   */
  getInhalt: () => Promise<string | null>;
  className?: string;
}

/**
 * Button zum Speichern des aktuellen Dokuments in Google Drive.
 * Zeigt nichts an, wenn Drive nicht konfiguriert ist.
 */
export default function DriveUploadButton({ kundeId, typ, dateiName, getInhalt, className }: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [driveLink, setDriveLink] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  async function handleClick() {
    if (status === "loading") return;
    setStatus("loading");
    setFehler(null);
    setDriveLink(null);

    try {
      const inhalt = await getInhalt();
      if (!inhalt) {
        setFehler("PDF konnte nicht erstellt werden.");
        setStatus("error");
        return;
      }

      const res = await fetch("/api/drive/dokumente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kundeId, typ, dateiName, inhalt }),
      });

      const json = await res.json();

      if (!res.ok) {
        if (json.nichtKonfiguriert) {
          // Drive nicht konfiguriert — still bleiben
          setStatus("idle");
          return;
        }
        throw new Error(json.error ?? "Unbekannter Fehler");
      }

      setDriveLink(json.driveLink ?? null);
      setStatus("success");

      // Nach 5 Sekunden wieder auf idle zurücksetzen
      setTimeout(() => setStatus("idle"), 5000);
    } catch (err) {
      setFehler(err instanceof Error ? err.message : "Fehler beim Upload");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <span className={`flex items-center gap-2 text-sm ${className ?? ""}`}>
        <span className="text-green-700 font-medium">In Drive gespeichert</span>
        {driveLink && (
          <a
            href={driveLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-green-600 underline text-xs"
          >
            Öffnen
          </a>
        )}
      </span>
    );
  }

  if (status === "error") {
    return (
      <span className={`flex items-center gap-2 text-sm ${className ?? ""}`}>
        <span className="text-red-600">{fehler}</span>
        <button
          onClick={() => setStatus("idle")}
          className="text-xs text-gray-500 underline"
        >
          Schließen
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={status === "loading"}
      className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors
        ${status === "loading"
          ? "bg-gray-100 text-gray-400 cursor-not-allowed"
          : "bg-white border border-green-300 text-green-700 hover:bg-green-50 hover:border-green-400"
        } ${className ?? ""}`}
    >
      {status === "loading" ? "Wird gespeichert…" : "In Google Drive speichern"}
    </button>
  );
}
