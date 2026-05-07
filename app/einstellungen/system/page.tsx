"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface DedupPreview {
  duplicateCount: number;
  groupCount: number;
  groups: { name: string; count: number; keepId: number; deleteIds: number[] }[];
}

export default function SystemPage() {
  const [buildInfo, setBuildInfo] = useState<{ version?: string; env?: string } | null>(null);
  const [dedup, setDedup] = useState<DedupPreview | null>(null);
  const [dedupLoading, setDedupLoading] = useState(false);
  const [dedupResult, setDedupResult] = useState<{ deleted: number; deactivated: number } | null>(null);
  const [dedupError, setDedupError] = useState<string | null>(null);

  useEffect(() => {
    setBuildInfo({
      version: process.env.NEXT_PUBLIC_APP_VERSION ?? "–",
      env: process.env.NODE_ENV ?? "–",
    });
  }, []);

  async function loadDedupPreview() {
    setDedupLoading(true);
    setDedupError(null);
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
    if (!confirm(`${dedup.duplicateCount} Duplikate in ${dedup.groupCount} Gruppen löschen/deaktivieren? Artikel mit Lieferhistorie werden nur deaktiviert.`)) return;
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
        throw new Error(d.error ?? "Fehler");
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

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/einstellungen" className="hover:text-green-700">Einstellungen</Link>
        <span>›</span>
        <span className="text-gray-800 font-medium">System</span>
      </div>

      <h1 className="text-2xl font-bold mb-6">System</h1>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4 mb-6">
        <h2 className="text-lg font-semibold mb-3">Version & Umgebung</h2>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-gray-50 rounded-lg px-4 py-3">
            <p className="text-gray-500 text-xs mb-1">App-Version</p>
            <p className="font-mono font-semibold">{buildInfo?.version ?? "…"}</p>
          </div>
          <div className="bg-gray-50 rounded-lg px-4 py-3">
            <p className="text-gray-500 text-xs mb-1">Umgebung</p>
            <p className="font-mono font-semibold">{buildInfo?.env ?? "…"}</p>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm">
          <p className="text-gray-500 text-xs mb-1">Datenbank</p>
          <p className="text-gray-700">SQLite via Prisma (lokale DB-Datei)</p>
        </div>
      </div>

      {/* Datenpflege */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
        <h2 className="text-lg font-semibold">Datenpflege</h2>

        <div className="border border-amber-200 bg-amber-50 rounded-lg p-4">
          <h3 className="font-medium text-amber-900 mb-1">Artikel-Duplikate bereinigen</h3>
          <p className="text-sm text-amber-800 mb-3">
            Findet Artikel mit identischem Namen und behält jeweils den ältesten Eintrag.
            Duplikate mit Lieferhistorie werden nur deaktiviert, alle anderen werden gelöscht.
          </p>

          {dedupResult && (
            <div className="mb-3 px-3 py-2 bg-green-50 border border-green-200 rounded text-sm text-green-800">
              Bereinigung abgeschlossen: {dedupResult.deleted} gelöscht, {dedupResult.deactivated} deaktiviert.
            </div>
          )}
          {dedupError && (
            <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
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
                <p className="text-sm text-green-700 font-medium">Keine Duplikate gefunden.</p>
              ) : (
                <>
                  <p className="text-sm font-medium text-amber-900">
                    {dedup.duplicateCount} Duplikate in {dedup.groupCount} Gruppen gefunden:
                  </p>
                  <div className="max-h-48 overflow-y-auto border border-amber-200 rounded bg-white">
                    <table className="w-full text-xs">
                      <thead className="bg-amber-50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold text-amber-800">Artikelname</th>
                          <th className="px-3 py-2 text-right font-semibold text-amber-800">Duplikate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dedup.groups.map((g, i) => (
                          <tr key={i} className="border-t border-amber-100">
                            <td className="px-3 py-1.5 text-gray-800">{g.name}</td>
                            <td className="px-3 py-1.5 text-right text-amber-700 font-medium">{g.count - 1}</td>
                          </tr>
                        ))}
                        {dedup.groupCount > 50 && (
                          <tr className="border-t border-amber-100">
                            <td colSpan={2} className="px-3 py-1.5 text-center text-gray-400 italic">… und weitere</td>
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
                      {dedupLoading ? "Bereinige…" : `${dedup.duplicateCount} Duplikate entfernen`}
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
    </div>
  );
}
