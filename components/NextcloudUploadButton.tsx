"use client";

import { useState } from "react";
import * as Sentry from "@sentry/nextjs";
import { log } from "@/lib/logger";

interface Props {
  /** Kunde-ID für die Zuordnung in Nextcloud */
  kundeId: number;
  /** Dokumenttyp — bestimmt den Unterordner */
  typ: "rechnung" | "lieferschein" | "angebot" | "gutschrift";
  /** Dateiname, der in Nextcloud gespeichert wird */
  dateiName: string;
  /**
   * Funktion, die den HTML-Inhalt (das Dokument-Element) als base64-PDF liefert.
   * Wird aufgerufen, wenn der Nutzer auf den Button klickt.
   * Gibt null zurück, wenn kein PDF generiert werden konnte (z.B. html2canvas fehlt).
   */
  getInhalt: () => Promise<string | null>;
  className?: string;
}

/**
 * Button zum Speichern des aktuellen Dokuments in Nextcloud.
 * Bleibt inaktiv (idle), wenn Nextcloud nicht konfiguriert ist.
 */
export default function NextcloudUploadButton({ kundeId, typ, dateiName, getInhalt, className }: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [nextcloudLink, setNextcloudLink] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  async function handleClick() {
    if (status === "loading") return;
    setStatus("loading");
    setFehler(null);
    setNextcloudLink(null);

    try {
      const inhalt = await getInhalt();
      if (!inhalt) {
        // Kein catch, kein fetch — ohne diese Meldung wäre ein Fehler in der
        // clientseitigen PDF-Erzeugung vollständig unsichtbar.
        log.error("PDF-Erzeugung für Nextcloud-Upload lieferte kein Ergebnis", undefined, {
          dateiName,
          typ,
        });
        setFehler("PDF konnte nicht erstellt werden.");
        setStatus("error");
        return;
      }

      const res = await fetch("/api/nextcloud/dokumente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kundeId, typ, dateiName, inhalt }),
      });

      const json = await res.json();

      if (!res.ok) {
        if (json.nichtKonfiguriert) {
          // Nextcloud nicht konfiguriert — still bleiben
          setStatus("idle");
          return;
        }
        throw new Error(json.error ?? "Unbekannter Fehler");
      }

      setNextcloudLink(json.nextcloudLink ?? null);
      setStatus("success");

      setTimeout(() => setStatus("idle"), 5000);
    } catch (err) {
      Sentry.captureException(err);
      setFehler(err instanceof Error ? err.message : "Fehler beim Upload");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <span className={`flex items-center gap-2 text-sm ${className ?? ""}`}>
        <span className="text-green-700 font-medium">In Nextcloud gespeichert</span>
        {nextcloudLink && (
          <a
            href={nextcloudLink}
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
      {status === "loading" ? "Wird gespeichert…" : "In Nextcloud speichern"}
    </button>
  );
}
