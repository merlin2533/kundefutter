"use client";
import { useRef, useState } from "react";
import Link from "next/link";

type ImportResult = {
  ok: boolean;
  importiert?: number;
  jahre?: number[];
  modus?: string;
  error?: string;
};

export default function EinstellungenAgrarantraegePage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const [autoYear, setAutoYear] = useState("2024");
  const [autoUrl, setAutoUrl] = useState("");
  const [autoImporting, setAutoImporting] = useState(false);
  const [autoImportResult, setAutoImportResult] = useState<ImportResult | null>(null);

  async function handleImport() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append("csv", file);
      const res = await fetch("/api/agrarantraege/import", { method: "POST", body: formData });
      const data = await res.json();
      setImportResult(data);
      if (data.ok && fileRef.current) fileRef.current.value = "";
    } catch {
      setImportResult({ ok: false, error: "Netzwerkfehler beim Import" });
    } finally {
      setImporting(false);
    }
  }

  async function handleAutoImport() {
    const resolvedUrl =
      autoUrl.trim() ||
      `https://www.agrarzahlungen.de/fileadmin/afig-csv/impdata${autoYear}.csv`;
    setAutoImporting(true);
    setAutoImportResult(null);
    try {
      const res = await fetch("/api/agrarantraege/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "url", url: resolvedUrl }),
      });
      let data: ImportResult;
      try {
        data = await res.json();
      } catch {
        const text = await res.text().catch(() => "");
        if (res.status === 502 || res.status === 504) {
          data = {
            ok: false,
            error: `Server konnte die URL nicht erreichen (HTTP ${res.status}). Bitte CSV manuell herunterladen und per Datei-Upload importieren.`,
          };
        } else {
          data = {
            ok: false,
            error: `Serverfehler (HTTP ${res.status})${text ? ": " + text.slice(0, 200) : ""}`,
          };
        }
      }
      setAutoImportResult(data);
    } catch {
      setAutoImportResult({
        ok: false,
        error:
          "Verbindungsfehler: Server nicht erreichbar. Bitte CSV manuell herunterladen und per Datei-Upload importieren.",
      });
    } finally {
      setAutoImporting(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/einstellungen" className="hover:text-green-700">Einstellungen</Link>
        <span>›</span>
        <span className="text-gray-800 font-medium">Agraranträge (AFIG)</span>
      </div>

      <h1 className="text-2xl font-bold mb-1">Agraranträge (AFIG)</h1>
      <p className="text-sm text-gray-500 mb-8">
        CSV von{" "}
        <a
          href="https://www.agrarzahlungen.de/agrarfonds/bs"
          target="_blank"
          rel="noopener noreferrer"
          className="text-green-700 hover:underline"
        >
          agrarzahlungen.de → Gesamtliste
        </a>{" "}
        importieren und Empfänger mit Kunden verknüpfen.
      </p>

      {/* CSV Upload */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6">
        <h2 className="font-semibold mb-1">CSV-Datei hochladen</h2>
        <p className="text-sm text-gray-500 mb-3">
          CSV unter agrarzahlungen.de → Gesamtliste herunterladen (z.B. impdata2024.csv) und hier hochladen.
        </p>
        <div className="flex gap-3 items-center flex-wrap">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt"
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none"
          />
          <button
            onClick={handleImport}
            disabled={importing}
            className="px-4 py-2 text-sm bg-green-700 hover:bg-green-800 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {importing ? "Importiere…" : "CSV importieren"}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Bei Dateien über 100 MB bitte Auto-Download verwenden.
        </p>
        {importResult && (
          <div
            className={`mt-3 text-sm px-3 py-2 rounded-lg border ${
              importResult.ok
                ? "bg-green-50 border-green-200 text-green-800"
                : "bg-red-50 border-red-200 text-red-700"
            }`}
          >
            {importResult.ok
              ? `✓ ${importResult.importiert?.toLocaleString("de-DE")} Datensätze importiert (Jahre: ${importResult.jahre?.join(", ")})`
              : `Fehler: ${importResult.error}`}
          </div>
        )}
      </div>

      {/* Auto-Download */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6">
        <h2 className="font-semibold mb-1">Auto-Download von agrarzahlungen.de</h2>
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
          Der Server lädt die CSV direkt herunter — empfohlen für 250 MB-Dateien. Nur verfügbar wenn der Server Internetzugang hat.
        </p>
        <div className="flex gap-3 items-center flex-wrap mb-2">
          <select
            value={autoYear}
            onChange={(e) => { setAutoYear(e.target.value); setAutoUrl(""); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
          >
            {[2024, 2023, 2022, 2021, 2020, 2019, 2018].map((y) => (
              <option key={y} value={String(y)}>{y}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder={`URL (optional): https://www.agrarzahlungen.de/…/impdata${autoYear}.csv`}
            value={autoUrl}
            onChange={(e) => setAutoUrl(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-96 focus:outline-none focus:ring-2 focus:ring-green-600"
          />
          <button
            onClick={handleAutoImport}
            disabled={autoImporting}
            className="px-4 py-2 text-sm bg-green-700 hover:bg-green-800 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {autoImporting ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Herunterladen…
              </>
            ) : (
              "Herunterladen und importieren"
            )}
          </button>
        </div>
        {autoImporting && (
          <p className="text-xs text-gray-500 mb-2">
            Wird heruntergeladen und importiert… (kann bei 250 MB bis zu 2 Minuten dauern)
          </p>
        )}
        {autoImportResult && (
          <div
            className={`mt-3 text-sm px-3 py-2 rounded-lg border ${
              autoImportResult.ok
                ? "bg-green-50 border-green-200 text-green-800"
                : "bg-red-50 border-red-200 text-red-700"
            }`}
          >
            {autoImportResult.ok
              ? `✓ ${autoImportResult.importiert?.toLocaleString("de-DE")} Datensätze importiert (Jahre: ${autoImportResult.jahre?.join(", ")}, Modus: ${autoImportResult.modus})`
              : `Fehler: ${autoImportResult.error}`}
          </div>
        )}
      </div>

      <div className="flex justify-between items-center">
        <Link
          href="/agrarantraege"
          className="text-sm text-green-700 hover:underline"
        >
          → Zu den importierten Agraranträgen
        </Link>
      </div>
    </div>
  );
}
