"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { DEFAULT_MAHNWESEN_CONFIG, parseMahnwesenConfig, type MahnwesenConfig } from "@/lib/mahnwesen-config";

export default function MahnwesenEinstellungenPage() {
  const [cfg, setCfg] = useState<MahnwesenConfig>(DEFAULT_MAHNWESEN_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/einstellungen?prefix=system.mahnwesen");
      if (!res.ok) throw new Error();
      const data: Record<string, string> = await res.json();
      setCfg(parseMahnwesenConfig(data["system.mahnwesen"]));
    } catch {
      setError("Fehler beim Laden der Einstellungen.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  function setNum(key: keyof MahnwesenConfig, value: string) {
    const n = Number(value.replace(",", "."));
    setCfg((prev) => ({ ...prev, [key]: Number.isFinite(n) && n >= 0 ? n : 0 }));
  }

  const fristenOk = cfg.stufe1Tage < cfg.stufe2Tage && cfg.stufe2Tage < cfg.stufe3Tage;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!fristenOk) {
      setError("Die Fristen müssen aufsteigend sein: Stufe 1 < Stufe 2 < Stufe 3.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/einstellungen", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "system.mahnwesen", value: JSON.stringify(cfg) }),
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

  const fristen: { key: keyof MahnwesenConfig; label: string; hint: string }[] = [
    { key: "stufe1Tage", label: "Stufe 1 – Zahlungserinnerung", hint: "Tage nach Fälligkeit" },
    { key: "stufe2Tage", label: "Stufe 2 – 1. Mahnung", hint: "Tage nach Fälligkeit" },
    { key: "stufe3Tage", label: "Stufe 3 – letzte Mahnung", hint: "Tage nach Fälligkeit" },
  ];
  const gebuehren: { key: keyof MahnwesenConfig; label: string }[] = [
    { key: "mahngebuehr1", label: "Stufe 1" },
    { key: "mahngebuehr2", label: "Stufe 2" },
    { key: "mahngebuehr3", label: "Stufe 3" },
  ];

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/einstellungen" className="hover:text-green-700">Einstellungen</Link>
        <span>›</span>
        <span className="text-gray-800 font-medium">Mahnwesen</span>
      </div>

      <h1 className="text-2xl font-bold mb-2">Mahnwesen</h1>
      <p className="text-sm text-gray-500 mb-6">
        Ab wann eine Mahnstufe greift, sowie Mahngebühren und Verzugszinssatz.
        Diese Werte steuern die Mahnstufen-Berechnung und die gedruckten
        Zahlungserinnerungen.
      </p>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-5">
        {/* Fristen */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="text-sm font-semibold text-gray-700">Mahnstufen-Fristen</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Eine Rechnung erscheint im Mahnwesen, sobald sie die Frist für Stufe 1 überschreitet.
            </p>
          </div>
          <div className="p-5 space-y-3">
            {fristen.map((f) => (
              <div key={f.key} className="grid grid-cols-[1fr_140px] items-center gap-3">
                <label className="text-sm font-medium text-gray-600">{f.label}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    value={cfg[f.key]}
                    onChange={(e) => setNum(f.key, e.target.value)}
                    className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <span className="text-xs text-gray-400 whitespace-nowrap">Tage</span>
                </div>
              </div>
            ))}
            {!fristenOk && (
              <p className="text-xs text-red-600">
                Die Fristen müssen aufsteigend sein: Stufe 1 &lt; Stufe 2 &lt; Stufe 3.
              </p>
            )}
          </div>
        </div>

        {/* Mahngebühren */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="text-sm font-semibold text-gray-700">Mahngebühren (€)</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Werden in der gedruckten Mahnung zur Forderung addiert. 0 € = keine Gebühr.
            </p>
          </div>
          <div className="p-5 grid grid-cols-3 gap-3">
            {gebuehren.map((g) => (
              <div key={g.key}>
                <label className="block text-sm font-medium text-gray-600 mb-1">{g.label}</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={cfg[g.key]}
                  onChange={(e) => setNum(g.key, e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Verzugszins */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="text-sm font-semibold text-gray-700">Verzugszinssatz</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Für Handelsgeschäfte: Basiszinssatz + 9 Prozentpunkte (§ 288 Abs. 2 BGB).
            </p>
          </div>
          <div className="p-5">
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                step="0.01"
                value={cfg.verzugszinssatz}
                onChange={(e) => setNum("verzugszinssatz", e.target.value)}
                className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <span className="text-sm text-gray-500">% p.a.</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 text-sm bg-green-700 hover:bg-green-800 text-white rounded-lg font-medium transition-colors disabled:opacity-60 min-w-[140px]"
          >
            {saving ? "Speichern…" : saved ? "✓ Gespeichert" : "Speichern"}
          </button>
        </div>
      </form>
    </div>
  );
}
