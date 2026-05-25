"use client";

import Link from "next/link";
import { useState } from "react";

interface KundeResult {
  id: number;
  name: string;
  betriebsnummer: string | null;
  email: string | null;
  ort: string | null;
}

export default function GdprPage() {
  const [sucheQuery, setSucheQuery] = useState("");
  const [sucheResult, setSucheResult] = useState<KundeResult[] | null>(null);
  const [sucheLoading, setSucheLoading] = useState(false);

  const [exportKundeId, setExportKundeId] = useState<number | null>(null);
  const [exportLoading, setExportLoading] = useState(false);

  const [deleteKundeId, setDeleteKundeId] = useState<number | null>(null);
  const [deleteKundeName, setDeleteKundeName] = useState("");
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteResult, setDeleteResult] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function sucheKunde() {
    if (sucheQuery.trim().length < 2) return;
    setSucheLoading(true);
    setSucheResult(null);
    try {
      const res = await fetch(`/api/kunden?search=${encodeURIComponent(sucheQuery.trim())}&limit=10`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSucheResult(Array.isArray(data.kunden) ? data.kunden : Array.isArray(data) ? data : []);
    } catch {
      setSucheResult([]);
    } finally {
      setSucheLoading(false);
    }
  }

  async function exportKunde(id: number) {
    setExportLoading(true);
    setExportKundeId(id);
    try {
      const res = await fetch(`/api/exporte/kundenmappe?kundeId=${id}`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kundendaten-${id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Export fehlgeschlagen.");
    } finally {
      setExportLoading(false);
      setExportKundeId(null);
    }
  }

  function startDelete(kunde: KundeResult) {
    setDeleteKundeId(kunde.id);
    setDeleteKundeName(kunde.name);
    setDeleteConfirmName("");
    setDeleteResult(null);
    setDeleteError(null);
  }

  async function runDelete() {
    if (!deleteKundeId || deleteConfirmName !== deleteKundeName) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/kunden/${deleteKundeId}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as { error?: string }).error ?? "Löschung fehlgeschlagen");
      }
      setDeleteResult(`Kundendaten für „${deleteKundeName}" wurden gelöscht.`);
      setDeleteKundeId(null);
      setSucheResult((prev) => prev?.filter((k) => k.id !== deleteKundeId) ?? null);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Fehler beim Löschen");
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/einstellungen" className="hover:text-green-700">Einstellungen</Link>
        <span>›</span>
        <span className="text-gray-800 font-medium">DSGVO / Datenschutz</span>
      </div>

      <h1 className="text-2xl font-bold mb-1">DSGVO / Datenschutz</h1>
      <p className="text-sm text-gray-500 mb-6">
        Auskunft, Datenexport und Löschung personenbezogener Daten gemäß DSGVO Art. 15–17.
      </p>

      <div className="space-y-4">
        {/* ── Kundendaten-Suche ── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
            <h2 className="font-semibold text-gray-800">Betroffene Person suchen</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Suche nach dem Kunden, für den du eine DSGVO-Anfrage bearbeitest.
            </p>
          </div>
          <div className="p-5">
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={sucheQuery}
                onChange={(e) => setSucheQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sucheKunde()}
                placeholder="Name oder Betriebsnummer…"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <button
                onClick={sucheKunde}
                disabled={sucheLoading || sucheQuery.trim().length < 2}
                className="bg-green-700 hover:bg-green-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {sucheLoading ? "Suche…" : "Suchen"}
              </button>
            </div>

            {sucheResult !== null && (
              <>
                {sucheResult.length === 0 ? (
                  <p className="text-sm text-gray-500">Keine Kunden gefunden.</p>
                ) : (
                  <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 overflow-hidden">
                    {sucheResult.map((k) => (
                      <div key={k.id} className="px-4 py-3 flex items-center justify-between gap-4 hover:bg-gray-50">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{k.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            ID {k.id}
                            {k.ort ? ` · ${k.ort}` : ""}
                            {k.email ? ` · ${k.email}` : ""}
                          </p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => exportKunde(k.id)}
                            disabled={exportLoading && exportKundeId === k.id}
                            className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-60"
                          >
                            {exportLoading && exportKundeId === k.id ? "Export…" : "Auskunft (PDF)"}
                          </button>
                          <button
                            onClick={() => startDelete(k)}
                            className="text-xs bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-3 py-1.5 rounded-lg font-medium transition-colors"
                          >
                            Löschen
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Lösch-Bestätigung ── */}
        {deleteKundeId && (
          <div className="bg-white rounded-xl border border-red-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-red-100 bg-red-50">
              <h2 className="font-semibold text-red-900">Kundendaten unwiderruflich löschen</h2>
              <p className="text-xs text-red-700 mt-0.5">
                Alle personenbezogenen Daten von <strong>{deleteKundeName}</strong> werden gelöscht.
                Diese Aktion kann nicht rückgängig gemacht werden.
              </p>
            </div>
            <div className="p-5 space-y-4">
              {deleteError && (
                <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {deleteError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Zur Bestätigung den Kundennamen eingeben:
                  <span className="ml-1 font-mono text-red-700">{deleteKundeName}</span>
                </label>
                <input
                  type="text"
                  value={deleteConfirmName}
                  onChange={(e) => setDeleteConfirmName(e.target.value)}
                  placeholder={deleteKundeName}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={runDelete}
                  disabled={deleteLoading || deleteConfirmName !== deleteKundeName}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {deleteLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="inline-block w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Lösche…
                    </span>
                  ) : (
                    "Jetzt löschen"
                  )}
                </button>
                <button
                  onClick={() => setDeleteKundeId(null)}
                  className="border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Ergebnis */}
        {deleteResult && (
          <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800">
            <span>✓</span>
            <span>{deleteResult}</span>
          </div>
        )}

        {/* ── Hinweise ── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
            <h2 className="font-semibold text-gray-800">DSGVO-Fristen & Hinweise</h2>
          </div>
          <div className="p-5 space-y-3 text-sm text-gray-600">
            <div className="flex gap-3">
              <span className="text-base shrink-0">📋</span>
              <div>
                <p className="font-medium text-gray-700">Art. 15 – Auskunftsrecht</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Betroffene können Auskunft über gespeicherte Daten verlangen. Nutze den
                  PDF-Export (Kundenmappe) als Auskunft.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="text-base shrink-0">🗑️</span>
              <div>
                <p className="font-medium text-gray-700">Art. 17 – Recht auf Löschung</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Anfragen müssen ohne unangemessene Verzögerung, spätestens binnen einem Monat,
                  bearbeitet werden.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="text-base shrink-0">💾</span>
              <div>
                <p className="font-medium text-gray-700">Aufbewahrungspflicht</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Rechnungs- und Buchungsdaten unterliegen der gesetzlichen Aufbewahrungspflicht
                  (10 Jahre, §147 AO). Diese Daten dürfen nicht vorzeitig gelöscht werden.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
