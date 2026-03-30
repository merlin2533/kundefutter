"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { STAMMDATEN_GRUPPEN } from "@/lib/artikel-stammdaten";

interface GruppeStatus {
  titel: string;
  lieferantName: string;
  gesamt: number;
  neu: number;
  vorhanden: number;
}

interface ImportStatus {
  gruppen: GruppeStatus[];
  gesamt: number;
  neu: number;
  vorhanden: number;
}

export default function ArtikelImportPage() {
  const [status, setStatus] = useState<ImportStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState<string | null>(null); // null = idle, "all" | gruppenTitel
  const [result, setResult] = useState<{ importiert: number; uebersprungen: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function ladeStatus() {
    setLoading(true);
    try {
      const res = await fetch("/api/einstellungen/artikel-import");
      if (!res.ok) throw new Error("Fehler beim Laden");
      setStatus(await res.json());
    } catch {
      setError("Status konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    ladeStatus();
  }, []);

  async function doImport(gruppenTitel?: string) {
    setImporting(gruppenTitel ?? "all");
    setResult(null);
    setError(null);
    try {
      const res = await fetch("/api/einstellungen/artikel-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(gruppenTitel ? { gruppenTitel } : {}),
      });
      if (!res.ok) throw new Error("Import fehlgeschlagen");
      const data = await res.json();
      setResult(data);
      await ladeStatus();
    } catch {
      setError("Import fehlgeschlagen. Bitte erneut versuchen.");
    } finally {
      setImporting(null);
    }
  }

  const alleNeu = status?.neu ?? 0;

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/einstellungen" className="text-gray-400 hover:text-gray-600 text-sm">
          Einstellungen
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-bold">Artikel-Stammdaten importieren</h1>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-sm text-blue-800">
        Hier können Sie vordefinierte Artikel-Stammdaten (marstall Pferdefutter & Stallzubehör,
        BvG Agrar Schwefelprodukte) in die Datenbank importieren. Bereits vorhandene Artikel
        (gleiche Artikelnummer) werden dabei nicht überschrieben.
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {result && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4 text-sm text-green-800">
          Import abgeschlossen: <strong>{result.importiert} Artikel importiert</strong>,{" "}
          {result.uebersprungen} bereits vorhanden (übersprungen).
        </div>
      )}

      {loading ? (
        <p className="text-gray-500 text-sm">Lade Status…</p>
      ) : status ? (
        <>
          {/* Gesamt-Übersicht */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="text-sm text-gray-500">Gesamt verfügbar</p>
                <p className="text-3xl font-bold text-gray-800">{status.gesamt}</p>
                <p className="text-sm text-gray-500 mt-1">
                  <span className="text-green-600 font-medium">{status.neu} neu</span>
                  {status.vorhanden > 0 && (
                    <span className="text-gray-400 ml-2">· {status.vorhanden} bereits vorhanden</span>
                  )}
                </p>
              </div>
              <button
                onClick={() => doImport()}
                disabled={importing !== null || alleNeu === 0}
                className="px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {importing === "all"
                  ? "Importiere…"
                  : alleNeu === 0
                  ? "Alle bereits vorhanden"
                  : `Alle ${alleNeu} neuen Artikel importieren`}
              </button>
            </div>
          </div>

          {/* Gruppen-Tabelle */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Gruppe</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700 hidden sm:table-cell">Lieferant</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-700">Gesamt</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-700">Neu</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {status.gruppen.map((g) => (
                  <tr key={g.titel} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {g.titel}
                      <div className="sm:hidden text-xs text-gray-400 font-normal">{g.lieferantName}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{g.lieferantName}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{g.gesamt}</td>
                    <td className="px-4 py-3 text-right">
                      {g.neu > 0 ? (
                        <span className="text-green-600 font-medium">{g.neu}</span>
                      ) : (
                        <span className="text-gray-300">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => doImport(g.titel)}
                        disabled={importing !== null || g.neu === 0}
                        className="px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-md text-xs font-medium hover:bg-green-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        {importing === g.titel ? "…" : g.neu === 0 ? "Vorhanden" : "Importieren"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Artikel-Vorschau je Gruppe */}
          <div className="mt-8 space-y-6">
            <h2 className="text-lg font-semibold text-gray-700">Artikel-Vorschau</h2>
            {STAMMDATEN_GRUPPEN.map((g) => (
              <details key={g.titel} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <summary className="px-4 py-3 cursor-pointer font-medium text-gray-700 hover:bg-gray-50 list-none flex items-center justify-between">
                  <span>{g.titel}</span>
                  <span className="text-xs text-gray-400 font-normal">{g.artikel.length} Artikel</span>
                </summary>
                <div className="border-t border-gray-100 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-gray-500">Artikelnr.</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-500">Name</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-500 hidden md:table-cell">Einheit</th>
                        <th className="text-right px-3 py-2 font-medium text-gray-500">VK</th>
                        <th className="text-right px-3 py-2 font-medium text-gray-500 hidden md:table-cell">EK</th>
                        <th className="text-right px-3 py-2 font-medium text-gray-500">MwSt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {g.artikel.map((a) => (
                        <tr key={a.artikelnummer} className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-mono text-gray-500">{a.artikelnummer}</td>
                          <td className="px-3 py-2 text-gray-800">{a.name}</td>
                          <td className="px-3 py-2 text-gray-500 hidden md:table-cell">{a.einheit}</td>
                          <td className="px-3 py-2 text-right text-gray-700">{a.standardpreis.toFixed(2)} €</td>
                          <td className="px-3 py-2 text-right text-gray-500 hidden md:table-cell">{a.einkaufspreis.toFixed(2)} €</td>
                          <td className="px-3 py-2 text-right text-gray-500">{a.mwstSatz} %</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
