"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import * as Sentry from "@sentry/nextjs";

const DEFAULT_WARNUNG = 10;
const DEFAULT_FEHLER = 0;

export default function KalkulationEinstellungenPage() {
  const [warnungProzent, setWarnungProzent] = useState(DEFAULT_WARNUNG);
  const [fehlerProzent, setFehlerProzent] = useState(DEFAULT_FEHLER);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/einstellungen?prefix=system.marge");
      if (!res.ok) throw new Error();
      const data: Record<string, string> = await res.json();
      const w = parseFloat(data["system.marge_warnung_prozent"] ?? "");
      const f = parseFloat(data["system.marge_fehler_prozent"] ?? "");
      if (Number.isFinite(w)) setWarnungProzent(w);
      if (Number.isFinite(f)) setFehlerProzent(f);
    } catch (err) {
      Sentry.captureException(err);
      setError("Fehler beim Laden der Einstellungen.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await Promise.all([
        fetch("/api/einstellungen", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: "system.marge_warnung_prozent", value: String(warnungProzent) }),
        }),
        fetch("/api/einstellungen", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: "system.marge_fehler_prozent", value: String(fehlerProzent) }),
        }),
      ]);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      Sentry.captureException(err);
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
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/einstellungen" className="hover:text-green-700">Einstellungen</Link>
        <span>›</span>
        <span className="text-gray-800 font-medium">Kalkulation</span>
      </div>

      <h1 className="text-2xl font-bold mb-2">Kalkulations-Einstellungen</h1>
      <p className="text-sm text-gray-500 mb-6">
        Schwellwerte für Margen-Ampeln in Lieferungen, Angeboten und der Preiskalkulation.
      </p>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-5">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="text-sm font-semibold text-gray-700">Margen-Ampel</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Farbliche Kennzeichnung nach Margen-Prozentsatz in Listen und Dokumenten.
            </p>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-[1fr_160px] items-start gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  <span className="inline-block w-3 h-3 rounded-full bg-orange-400 mr-1.5 align-middle" />
                  Orange ab (Warnung)
                </label>
                <p className="text-xs text-gray-400 mt-0.5">
                  Marge unter diesem Wert wird orange angezeigt (z. B. 10 % für Standardhandel, 5 % für Dünger).
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={warnungProzent}
                  onChange={(e) => setWarnungProzent(parseFloat(e.target.value) || 0)}
                  className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <span className="text-xs text-gray-400">%</span>
              </div>
            </div>

            <div className="grid grid-cols-[1fr_160px] items-start gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  <span className="inline-block w-3 h-3 rounded-full bg-red-400 mr-1.5 align-middle" />
                  Rot ab (Verlust)
                </label>
                <p className="text-xs text-gray-400 mt-0.5">
                  Marge unter diesem Wert wird rot angezeigt. Standard: 0 % (Verlustgeschäft).
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={-100}
                  max={100}
                  step={0.5}
                  value={fehlerProzent}
                  onChange={(e) => setFehlerProzent(parseFloat(e.target.value) || 0)}
                  className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <span className="text-xs text-gray-400">%</span>
              </div>
            </div>

            <div className="mt-2 p-3 bg-gray-50 rounded-lg text-xs text-gray-500 space-y-1">
              <p>Vorschau mit aktuellen Werten:</p>
              <div className="flex gap-2 flex-wrap mt-1">
                <span className="px-2 py-0.5 rounded font-medium bg-green-100 text-green-800">
                  ≥ {warnungProzent} % grün
                </span>
                <span className="px-2 py-0.5 rounded font-medium bg-orange-100 text-orange-800">
                  {fehlerProzent}–{warnungProzent} % orange
                </span>
                <span className="px-2 py-0.5 rounded font-medium bg-red-100 text-red-800">
                  &lt; {fehlerProzent} % rot
                </span>
              </div>
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
