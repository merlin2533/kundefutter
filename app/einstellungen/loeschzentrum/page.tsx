"use client";

import Link from "next/link";
import { useState } from "react";

interface DedupGroup {
  name: string;
  count: number;
  keepId: number;
  deleteIds: number[];
}

interface DedupPreview {
  duplicateCount: number;
  groupCount: number;
  groups: DedupGroup[];
}

export default function LoeschzentrumPage() {
  const [dedup, setDedup] = useState<DedupPreview | null>(null);
  const [dedupLoading, setDedupLoading] = useState(false);
  const [dedupResult, setDedupResult] = useState<{ deleted: number; deactivated: number } | null>(null);
  const [dedupError, setDedupError] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const [confirmVisible, setConfirmVisible] = useState(false);

  const [ftsLoading, setFtsLoading] = useState(false);
  const [ftsResult, setFtsResult] = useState<string | null>(null);

  function toggleGroup(i: number) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  async function loadDedupPreview() {
    setDedupLoading(true);
    setDedupError(null);
    setDedupResult(null);
    setConfirmVisible(false);
    try {
      const res = await fetch("/api/artikel/dedup");
      if (!res.ok) throw new Error("Fehler beim Laden");
      const data: DedupPreview = await res.json();
      setDedup(data);
      setExpandedGroups(new Set());
    } catch {
      setDedupError("Vorschau konnte nicht geladen werden.");
    } finally {
      setDedupLoading(false);
    }
  }

  async function runDedup() {
    if (!dedup || dedup.duplicateCount === 0) return;
    setDedupLoading(true);
    setDedupError(null);
    setConfirmVisible(false);
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
    setFtsLoading(true);
    setFtsResult(null);
    try {
      const res = await fetch("/api/suche/rebuild", { method: "POST" });
      if (!res.ok) throw new Error("Fehler");
      const data = await res.json();
      setFtsResult((data as { ok?: boolean }).ok ? "Suchindex erfolgreich neu aufgebaut." : "Fehler beim Aufbauen.");
    } catch {
      setFtsResult("Fehler beim Aufbauen des Suchindex.");
    } finally {
      setFtsLoading(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/einstellungen" className="hover:text-green-700">Einstellungen</Link>
        <span>›</span>
        <span className="text-gray-800 font-medium">Löschzentrum</span>
      </div>

      <h1 className="text-2xl font-bold mb-1">Löschzentrum</h1>
      <p className="text-sm text-gray-500 mb-5">
        Datenbereinigung und Wartungsoperationen für Administratoren.
      </p>

      <div className="mb-6 flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-900">
        <span className="text-base leading-5 shrink-0">⚠️</span>
        <span>
          Löschoperationen können nicht rückgängig gemacht werden.{" "}
          <Link href="/einstellungen/backup" className="font-medium underline hover:text-amber-950">
            Backup erstellen
          </Link>{" "}
          bevor du Daten bereinigst.
        </span>
      </div>

      <div className="space-y-4">
        {/* ── Artikel-Duplikate ── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold text-gray-800">Artikel-Duplikate bereinigen</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Findet Artikel mit identischem Namen. Der älteste Eintrag (niedrigste ID) wird
                behalten. Duplikate mit Lieferhistorie werden deaktiviert, alle anderen gelöscht.
              </p>
            </div>
          </div>

          <div className="p-5">
            {/* Ergebnis-Banner */}
            {dedupResult && (
              <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
                <span className="text-base">✓</span>
                <div>
                  <p className="font-medium">Bereinigung abgeschlossen</p>
                  <p className="text-xs text-green-700 mt-0.5">
                    {dedupResult.deleted} Artikel gelöscht · {dedupResult.deactivated} deaktiviert
                  </p>
                </div>
              </div>
            )}
            {dedupError && (
              <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {dedupError}
              </div>
            )}

            {/* Zustand: noch keine Prüfung */}
            {!dedup && (
              <button
                onClick={loadDedupPreview}
                disabled={dedupLoading}
                className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
              >
                {dedupLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="inline-block w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Prüfe Duplikate…
                  </span>
                ) : (
                  "Duplikate prüfen"
                )}
              </button>
            )}

            {/* Zustand: Vorschau geladen */}
            {dedup && (
              <div className="space-y-4">
                {dedup.duplicateCount === 0 ? (
                  <div className="flex items-center gap-2 text-sm text-green-700 font-medium py-1">
                    <span>✓</span>
                    <span>Keine Duplikate gefunden — alle Artikelnamen sind eindeutig.</span>
                  </div>
                ) : (
                  <>
                    {/* Zusammenfassung */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-800 text-xs font-semibold px-3 py-1 rounded-full">
                        {dedup.groupCount} Gruppen
                      </span>
                      <span className="inline-flex items-center gap-1.5 bg-red-100 text-red-700 text-xs font-semibold px-3 py-1 rounded-full">
                        {dedup.duplicateCount} zu entfernende Duplikate
                      </span>
                      <span className="text-xs text-gray-400">
                        Klicke auf eine Gruppe für Details
                      </span>
                    </div>

                    {/* Gruppen-Liste */}
                    <div className="border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100">
                      {dedup.groups.map((g, i) => {
                        const open = expandedGroups.has(i);
                        return (
                          <div key={i}>
                            <button
                              onClick={() => toggleGroup(i)}
                              className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-gray-50 transition-colors"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="text-sm font-medium text-gray-800 truncate">
                                  {g.name}
                                </span>
                                <span className="shrink-0 text-xs bg-red-100 text-red-700 font-semibold px-2 py-0.5 rounded-full">
                                  {g.count - 1} Duplikat{g.count - 1 !== 1 ? "e" : ""}
                                </span>
                              </div>
                              <span className="text-gray-400 text-xs shrink-0 ml-2">
                                {open ? "▲" : "▼"}
                              </span>
                            </button>

                            {open && (
                              <div className="px-4 pb-3 pt-1 bg-gray-50 border-t border-gray-100 space-y-1.5">
                                {/* Behalten */}
                                <div className="flex items-center gap-2">
                                  <span className="w-20 text-xs text-gray-500 shrink-0">Behalten</span>
                                  <span className="inline-flex items-center gap-1.5 bg-green-100 text-green-800 text-xs font-mono px-2.5 py-1 rounded-md">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                                    ID {g.keepId}
                                  </span>
                                </div>
                                {/* Entfernen */}
                                <div className="flex items-start gap-2">
                                  <span className="w-20 text-xs text-gray-500 shrink-0 pt-1">Entfernen</span>
                                  <div className="flex flex-wrap gap-1.5">
                                    {g.deleteIds.map((id) => (
                                      <span
                                        key={id}
                                        className="inline-flex items-center gap-1.5 bg-red-100 text-red-700 text-xs font-mono px-2.5 py-1 rounded-md"
                                      >
                                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                                        ID {id}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                                <p className="text-xs text-gray-400 pt-0.5">
                                  Artikel mit Lieferhistorie werden nur deaktiviert, nicht gelöscht.
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {dedup.groupCount > 50 && (
                        <div className="px-4 py-2 text-xs text-gray-400 italic text-center bg-gray-50">
                          … nur die ersten 50 von {dedup.groupCount} Gruppen angezeigt
                        </div>
                      )}
                    </div>

                    {/* Bestätigungs-Inline-Dialog */}
                    {!confirmVisible ? (
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => setConfirmVisible(true)}
                          disabled={dedupLoading}
                          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
                        >
                          {dedup.duplicateCount} Duplikate entfernen
                        </button>
                        <button
                          onClick={() => { setDedup(null); setConfirmVisible(false); }}
                          className="border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                        >
                          Abbrechen
                        </button>
                      </div>
                    ) : (
                      <div className="border border-red-200 bg-red-50 rounded-xl p-4 space-y-3">
                        <div>
                          <p className="text-sm font-semibold text-red-900">
                            Bereinigung wirklich starten?
                          </p>
                          <p className="text-xs text-red-700 mt-1">
                            {dedup.duplicateCount} Duplikate in {dedup.groupCount} Gruppen werden
                            entfernt. Diese Aktion kann nicht rückgängig gemacht werden.
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={runDedup}
                            disabled={dedupLoading}
                            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60"
                          >
                            {dedupLoading ? (
                              <span className="flex items-center gap-2">
                                <span className="inline-block w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                Bereinige…
                              </span>
                            ) : (
                              "Ja, jetzt bereinigen"
                            )}
                          </button>
                          <button
                            onClick={() => setConfirmVisible(false)}
                            className="border border-red-300 bg-white hover:bg-red-50 text-red-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                          >
                            Abbrechen
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Neu prüfen */}
                {dedup.duplicateCount === 0 && (
                  <button
                    onClick={loadDedupPreview}
                    className="text-sm text-gray-500 hover:text-gray-700 underline"
                  >
                    Erneut prüfen
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Suchindex ── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
            <h2 className="font-semibold text-gray-800">Suchindex neu aufbauen</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Stellt den Volltextindex (FTS5) wieder her, wenn die globale Suche (Cmd+K) fehlerhafte
              oder unvollständige Ergebnisse liefert.
            </p>
          </div>
          <div className="p-5">
            {ftsResult && (
              <div
                className={`mb-4 flex items-center gap-2 px-4 py-3 rounded-lg text-sm border ${
                  ftsResult.startsWith("Fehler")
                    ? "bg-red-50 border-red-200 text-red-700"
                    : "bg-green-50 border-green-200 text-green-800"
                }`}
              >
                <span>{ftsResult.startsWith("Fehler") ? "✗" : "✓"}</span>
                <span>{ftsResult}</span>
              </div>
            )}
            <button
              onClick={rebuildFts}
              disabled={ftsLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
            >
              {ftsLoading ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Aufbaue…
                </span>
              ) : (
                "Index neu aufbauen"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
