"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";

const DEFAULT_KATEGORIEN = [
  "Wareneinkauf",
  "Betriebsbedarf",
  "Fahrtkosten",
  "Bürobedarf",
  "Telefon/Internet",
  "Versicherung",
  "Miete",
  "Sonstige",
];

export default function AusgabenEinstellungenPage() {
  const [kategorien, setKategorien] = useState<string[]>(DEFAULT_KATEGORIEN);
  const [neueKategorie, setNeueKategorie] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/einstellungen?prefix=ausgaben.");
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data["ausgaben.kategorien"]) {
        try {
          const parsed = JSON.parse(data["ausgaben.kategorien"]);
          if (Array.isArray(parsed)) setKategorien(parsed);
        } catch {
          // keep defaults
        }
      }
    } catch {
      setError("Fehler beim Laden der Einstellungen.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  function handleAdd() {
    const trimmed = neueKategorie.trim();
    if (!trimmed) return;
    if (kategorien.includes(trimmed)) {
      setError("Diese Kategorie ist bereits vorhanden.");
      return;
    }
    setKategorien((prev) => [...prev, trimmed]);
    setNeueKategorie("");
    setError(null);
  }

  function handleRemove(idx: number) {
    setKategorien((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/einstellungen", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "ausgaben.kategorien", value: JSON.stringify(kategorien) }),
      });
      if (!res.ok) throw new Error();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Fehler beim Speichern.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-gray-400 mt-8 text-sm">Lade Einstellungen…</p>;
  }

  return (
    <div className="max-w-2xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/einstellungen" className="hover:text-green-700">
          Einstellungen
        </Link>
        <span>›</span>
        <span className="text-gray-800 font-medium">Ausgaben</span>
      </div>

      <h1 className="text-2xl font-bold mb-2">Ausgaben-Einstellungen</h1>
      <p className="text-sm text-gray-500 mb-6">
        Konfigurieren Sie die Kategorien für Betriebsausgaben im Ausgabenbuch.
      </p>

      {/* GoBD-Hinweis */}
      <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <p className="font-medium mb-1">GoBD-Hinweis</p>
        <p className="text-blue-700">
          Belege müssen gemäß GoBD 10 Jahre aufbewahrt werden. Einmal hochgeladene Belege können nicht gelöscht werden.
        </p>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <form onSubmit={handleSave} className="space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Kategorien</h2>
            <div className="space-y-2 mb-4">
              {kategorien.map((kat, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50">
                    {kat}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemove(idx)}
                    className="px-3 py-2 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors whitespace-nowrap"
                  >
                    Entfernen
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={neueKategorie}
                onChange={(e) => setNeueKategorie(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
                placeholder="Neue Kategorie…"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <button
                type="button"
                onClick={handleAdd}
                className="px-4 py-2 text-sm border border-green-600 text-green-700 rounded-lg hover:bg-green-50 transition-colors whitespace-nowrap"
              >
                + Hinzufügen
              </button>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-60"
            >
              {saving ? "Speichern…" : saved ? "✓ Gespeichert" : "Speichern"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
