"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";

const DEFAULT_CACHE_TAGE = 7;

export default function MarktpreiseEinstellungenPage() {
  const [cacheTage, setCacheTage] = useState(DEFAULT_CACHE_TAGE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/einstellungen?prefix=system.marktpreise_cache_tage");
      if (!res.ok) throw new Error();
      const data: Record<string, string> = await res.json();
      const n = parseInt(data["system.marktpreise_cache_tage"] ?? "", 10);
      if (Number.isFinite(n) && n >= 1) setCacheTage(n);
    } catch {
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
      const res = await fetch("/api/einstellungen", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "system.marktpreise_cache_tage",
          value: String(Math.max(1, Math.min(90, cacheTage))),
        }),
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

  async function handleRefresh() {
    setRefreshing(true);
    setRefreshMsg(null);
    setError(null);
    try {
      const res = await fetch("/api/marktpreise?force=true");
      if (!res.ok) throw new Error();
      setRefreshMsg("Marktpreis-Daten wurden von Eurostat aktualisiert.");
    } catch {
      setError("Aktualisierung fehlgeschlagen – Eurostat ggf. nicht erreichbar.");
    } finally {
      setRefreshing(false);
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
        <span className="text-gray-800 font-medium">Marktpreise</span>
      </div>

      <h1 className="text-2xl font-bold mb-2">Marktpreise</h1>
      <p className="text-sm text-gray-500 mb-6">
        Der Eurostat-Preisindex wird zwischengespeichert und nur erneuert, wenn
        die hinterlegten Daten älter als die eingestellte Gültigkeit sind.
      </p>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}
      {refreshMsg && (
        <div className="mb-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          {refreshMsg}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-5">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="text-sm font-semibold text-gray-700">Cache-Gültigkeit</h2>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-[1fr_140px] items-center gap-3">
              <label className="text-sm font-medium text-gray-600">
                Daten als aktuell behandeln für
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={90}
                  value={cacheTage}
                  onChange={(e) => setCacheTage(parseInt(e.target.value, 10) || DEFAULT_CACHE_TAGE)}
                  className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <span className="text-xs text-gray-400">Tage</span>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Eurostat veröffentlicht den Index quartalsweise – 7 Tage sind in der Regel ausreichend.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="text-sm font-semibold text-gray-700">Daten jetzt aktualisieren</h2>
          </div>
          <div className="p-5">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="px-4 py-2 text-sm border border-green-600 text-green-700 rounded-lg hover:bg-green-50 transition-colors disabled:opacity-60"
            >
              {refreshing ? "Wird aktualisiert…" : "Eurostat-Daten neu abrufen"}
            </button>
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
