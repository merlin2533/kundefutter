"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";

interface VorschauZeile {
  zeile: number;
  status: "neu" | "uebersprungen" | "fehler";
  kunde?: string;
  artikel?: string;
  menge?: number;
  einheit?: string;
  datum?: string;
  externeNr?: string | null;
  grund?: string;
}

interface VorschauResult {
  rows: VorschauZeile[];
  summary: { neu: number; uebersprungen: number; fehler: number };
}

interface ImportResult {
  ok: number;
  uebersprungen: number;
  fehler: { zeile: number; grund: string }[];
  created: number[];
}

function statusBadge(status: VorschauZeile["status"]) {
  if (status === "neu") return <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">neu</span>;
  if (status === "uebersprungen") return <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">übersprungen</span>;
  return <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">Fehler</span>;
}

export default function AnlieferungenImportPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [vorschau, setVorschau] = useState<VorschauResult | null>(null);
  const [vorschauLoading, setVorschauLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setResult(null);
    setVorschau(null);
    setError("");
    setVorschauLoading(true);

    const fd = new FormData();
    fd.append("file", f);
    try {
      const res = await fetch("/api/anlieferungen/import/vorschau", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Vorschau fehlgeschlagen");
        return;
      }
      setVorschau(data);
    } catch (err) {
      Sentry.captureException(err);
      setError("Netzwerkfehler bei der Vorschau");
    } finally {
      setVorschauLoading(false);
    }
  }

  async function doImport() {
    if (!file) return;
    setImporting(true);
    setResult(null);
    setError("");
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/anlieferungen/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Import fehlgeschlagen");
        return;
      }
      setResult(data);
      setVorschau(null);
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      Sentry.captureException(err);
      setError("Netzwerkfehler beim Import");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Anlieferungen importieren</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            CSV/Excel-Datei mit Spalten Erzeuger, Artikel, Menge, Datum (optional Einheit, Feuchte,
            Qualität, Preis, Belegnummer) hochladen.
          </p>
        </div>
        <Link href="/anlieferungen" className="text-sm text-gray-500 hover:text-gray-700">← Zurück zur Liste</Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-5">
        <label className="block text-sm font-medium text-gray-700 mb-2">Datei wählen</label>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleFileSelect}
          className="block w-full text-sm text-gray-700 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-green-700 file:text-white file:text-sm file:font-medium hover:file:bg-green-800"
        />
      </div>

      {error && (
        <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {vorschauLoading && <div className="text-sm text-gray-500">Vorschau wird geladen…</div>}

      {vorschau && !vorschauLoading && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-5">
          <div className="flex flex-wrap gap-3 mb-4 text-sm">
            {vorschau.summary.neu > 0 && (
              <span className="px-2.5 py-1 rounded-lg bg-green-50 text-green-700 border border-green-200">+ {vorschau.summary.neu} neu anlegen</span>
            )}
            {vorschau.summary.uebersprungen > 0 && (
              <span className="px-2.5 py-1 rounded-lg bg-gray-50 text-gray-600 border border-gray-200">— {vorschau.summary.uebersprungen} bereits importiert</span>
            )}
            {vorschau.summary.fehler > 0 && (
              <span className="px-2.5 py-1 rounded-lg bg-red-50 text-red-700 border border-red-200">⚠ {vorschau.summary.fehler} Fehler</span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                  <th className="py-1.5 pr-3">Zeile</th>
                  <th className="py-1.5 pr-3">Status</th>
                  <th className="py-1.5 pr-3">Erzeuger</th>
                  <th className="py-1.5 pr-3">Artikel</th>
                  <th className="py-1.5 pr-3">Menge</th>
                  <th className="py-1.5 pr-3">Datum</th>
                  <th className="py-1.5 pr-3">Hinweis</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {vorschau.rows.map((r) => (
                  <tr key={r.zeile}>
                    <td className="py-1.5 pr-3 text-gray-500">{r.zeile}</td>
                    <td className="py-1.5 pr-3">{statusBadge(r.status)}</td>
                    <td className="py-1.5 pr-3">{r.kunde ?? "—"}</td>
                    <td className="py-1.5 pr-3">{r.artikel ?? "—"}</td>
                    <td className="py-1.5 pr-3">{r.menge != null ? `${r.menge} ${r.einheit ?? ""}` : "—"}</td>
                    <td className="py-1.5 pr-3">{r.datum ? new Date(r.datum).toLocaleDateString("de-DE") : "—"}</td>
                    <td className="py-1.5 pr-3 text-gray-500">{r.grund ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {vorschau.summary.neu > 0 && (
            <button
              onClick={doImport}
              disabled={importing}
              className="mt-4 px-4 py-2 bg-green-700 hover:bg-green-800 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {importing ? "Importiere…" : `${vorschau.summary.neu} Anlieferung(en) importieren`}
            </button>
          )}
        </div>
      )}

      {result && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <p className="text-sm text-gray-900 mb-2">
            ✓ {result.ok} angelegt, {result.uebersprungen} übersprungen (bereits importiert), {result.fehler.length} Fehler.
          </p>
          {result.fehler.length > 0 && (
            <ul className="text-sm text-red-700 list-disc pl-5">
              {result.fehler.map((f) => (
                <li key={f.zeile}>Zeile {f.zeile}: {f.grund}</li>
              ))}
            </ul>
          )}
          <Link href="/anlieferungen" className="inline-block mt-3 text-sm text-green-700 hover:underline">Zur Anlieferungsliste →</Link>
        </div>
      )}
    </div>
  );
}
