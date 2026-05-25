"use client";

import Link from "next/link";
import { useState } from "react";

interface DedupPreview {
  duplicateCount: number;
  groupCount: number;
  groups: { name: string; count: number; keepId: number; deleteIds: number[] }[];
}

interface SucheRebuildResult {
  ok: boolean;
}

export default function LoeschzentrumPage() {
  const [dedup, setDedup] = useState<DedupPreview | null>(null);
  const [dedupLoading, setDedupLoading] = useState(false);
  const [dedupResult, setDedupResult] = useState<{ deleted: number; deactivated: number } | null>(null);
  const [dedupError, setDedupError] = useState<string | null>(null);

  const [ftsLoading, setFtsLoading] = useState(false);
  const [ftsResult, setFtsResult] = useState<string | null>(null);

  async function loadDedupPreview() {
    setDedupLoading(true);
    setDedupError(null);
    setDedupResult(null);
    try {
      const res = await fetch("/api/artikel/dedup");
      if (!res.ok) throw new Error("Fehler beim Laden");
      setDedup(await res.json());
    } catch {
      setDedupError("Vorschau konnte nicht geladen werden.");
    } finally {
      setDedupLoading(false);
    }
  }

  async function runDedup() {
    if (!dedup || dedup.duplicateCount === 0) return;
    if (
      !confirm(
        `${dedup.duplicateCount} Duplikate in ${dedup.groupCount} Gruppen löschen/deaktivieren?\n` +
          "Artikel mit Lieferhistorie werden nur deaktiviert, alle anderen werden gelöscht."
      )
    )
      return;
    setDedupLoading(true);
    setDedupError(null);
    try {
      const res = await fetch("/api/artikel/dedup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as { error?: string }).error ?? "Fehler");
      }
      const result = await res.json();
      setDedupResult(result);
      setDedup(null);
    } catch (e) {
      setDedupError(e instanceof Error ? e.message : "Bereinigung fehlgeschlagen");
    } finally {
      setDedupLoading(false);
    }
  }

  async function rebuildFts() {
    if (!confirm("Suchindex neu aufbauen? Das kann einige Sekunden dauern.")) return;
    setFtsLoading(true);
    setFtsResult(null);
    try {
      const res = await fetch("/api/suche/rebuild", { method: "POST" });
      if (!res.ok) throw new Error("Fehler");
      const data: SucheRebuildResult = await res.json();
      setFtsResult(data.ok ? "Suchindex erfolgreich neu aufgebaut." : "Fehler beim Aufbauen.");
    } catch {
      setFtsResult("Fehler beim Aufbauen des Suchindex.");
    } finally {
      setFtsLoading(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/einstellungen" className="hover:text-green-700">
          Einstellungen
        </Link>
        <span>›</span>
        <span className="text-gray-800 font-medium">Löschzentrum</span>
      </div>

      <h1 className="text-2xl font-bold mb-1">Löschzentrum</h1>
      <p className="text-sm text-gray-500 mb-6">
        Datenbereinigung und Wartungsoperationen. Alle Aktionen sind unwiderruflich — bitte vorher
        ein Backup erstellen.
      </p>

      <div className="mb-4 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-800">
        <span className="text-lg leading-none">⚠️</span>
        <span>
          Löschoperationen können nicht rückgängig gemacht werden. Empfehlung:{" "}
          <Link href="/einstellungen/backup" className="underline hover:text-red-900">
            Backup erstellen
          </Link>{" "}
          bevor du Daten bereinigst.
        </span>
      </div>

      <div className="space-y-5">
        {/* Artikel-Duplikate */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="text-sm font-semibold text-gray-700">Artikel-Duplikate bereinigen</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Findet Artikel mit identischem Namen. Der älteste Eintrag bleibt erhalten. Duplikate
              mit Lieferhistorie werden nur deaktiviert, alle anderen gelöscht.
            </p>
          </div>
          <div className="p-5">
            {dedupResult && (
              <div className="mb-4 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
                Bereinigung abgeschlossen: {dedupResult.deleted} gelöscht,{" "}
                {dedupResult.deactivated} deaktiviert.
              </div>
            )}
            {dedupError && (
              <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {dedupError}
              </div>
            )}

            {!dedup ? (
              <button
                onClick={loadDedupPreview}
                disabled={dedupLoading}
                className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
              >
                {dedupLoading ? "Prüfe…" : "Duplikate prüfen"}
              </button>
            ) : (
              <div className="space-y-3">
                {dedup.duplicateCount === 0 ? (
                  <div className="flex items-center gap-2 text-sm text-green-700 font-medium">
                    <span>✓</span>
                    <span>Keine Duplikate gefunden.</span>
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-medium text-amber-900">
                      {dedup.duplicateCount} Duplikate in {dedup.groupCount} Gruppen gefunden:
                    </p>
                    <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg bg-white">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="px-3 py-2 text-left font-semibold text-gray-600">
                              Artikelname
                            </th>
                            <th className="px-3 py-2 text-right font-semibold text-gray-600">
                              Duplikate
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {dedup.groups.map((g, i) => (
                            <tr key={i} className="border-t border-gray-100">
                              <td className="px-3 py-1.5 text-gray-800">{g.name}</td>
                              <td className="px-3 py-1.5 text-right text-amber-700 font-medium">
                                {g.count - 1}
                              </td>
                            </tr>
                          ))}
                          {dedup.groupCount > 50 && (
                            <tr className="border-t border-gray-100">
                              <td
                                colSpan={2}
                                className="px-3 py-1.5 text-center text-gray-400 italic"
                              >
                                … und weitere
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={runDedup}
                        disabled={dedupLoading}
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
                      >
                        {dedupLoading
                          ? "Bereinige…"
                          : `${dedup.duplicateCount} Duplikate entfernen`}
                      </button>
                      <button
                        onClick={() => setDedup(null)}
                        className="border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                      >
                        Abbrechen
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Suchindex */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="text-sm font-semibold text-gray-700">Suchindex neu aufbauen</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Stellt den Volltextindex (FTS5) wieder her, wenn die globale Suche fehlerhafte
              Ergebnisse liefert.
            </p>
          </div>
          <div className="p-5">
            {ftsResult && (
              <div
                className={`mb-4 px-3 py-2 rounded-lg text-sm border ${
                  ftsResult.startsWith("Fehler")
                    ? "bg-red-50 border-red-200 text-red-700"
                    : "bg-green-50 border-green-200 text-green-800"
                }`}
              >
                {ftsResult}
              </div>
            )}
            <button
              onClick={rebuildFts}
              disabled={ftsLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
            >
              {ftsLoading ? "Aufbaue…" : "Index neu aufbauen"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
