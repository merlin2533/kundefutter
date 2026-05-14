"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";

const DEFAULT_MIN_LAENGE = 8;

export default function SicherheitEinstellungenPage() {
  const [minLaenge, setMinLaenge] = useState(DEFAULT_MIN_LAENGE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/einstellungen?prefix=system.passwort_minlaenge");
      if (!res.ok) throw new Error();
      const data: Record<string, string> = await res.json();
      const n = parseInt(data["system.passwort_minlaenge"] ?? "", 10);
      if (Number.isFinite(n) && n >= 4) setMinLaenge(n);
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
          key: "system.passwort_minlaenge",
          value: String(Math.max(4, Math.min(64, minLaenge))),
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

  if (loading) {
    return <p className="text-gray-400 mt-8 text-sm">Lade Einstellungen…</p>;
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/einstellungen" className="hover:text-green-700">Einstellungen</Link>
        <span>›</span>
        <span className="text-gray-800 font-medium">Sicherheit</span>
      </div>

      <h1 className="text-2xl font-bold mb-2">Sicherheit</h1>
      <p className="text-sm text-gray-500 mb-6">
        Richtlinien für Benutzerkonten und Hinweise zum sicheren Betrieb.
      </p>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-5">
        {/* Passwort-Richtlinie */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="text-sm font-semibold text-gray-700">Passwort-Richtlinie</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Gilt beim Anlegen neuer Benutzer und beim Ändern von Passwörtern.
            </p>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-[1fr_140px] items-center gap-3">
              <label className="text-sm font-medium text-gray-600">Mindestlänge des Passworts</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={4}
                  max={64}
                  value={minLaenge}
                  onChange={(e) => setMinLaenge(parseInt(e.target.value, 10) || DEFAULT_MIN_LAENGE)}
                  className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <span className="text-xs text-gray-400">Zeichen</span>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">Empfohlen: mindestens 8 Zeichen.</p>
          </div>
        </div>

        {/* Hinweise */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="text-sm font-semibold text-gray-700">Betriebs-Checkliste</h2>
          </div>
          <div className="p-5">
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex gap-2">
                <span className="text-green-600">•</span>
                <span><strong>SESSION_SECRET</strong> muss als Umgebungsvariable mit mindestens 32 Zeichen gesetzt sein – ohne diese läuft die Anwendung mit einem unsicheren Dev-Fallback.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-green-600">•</span>
                <span>Die Anmeldung erfolgt über eine verschlüsselte Session (JWT, Laufzeit 7 Tage). Inaktive Benutzer werden automatisch abgewiesen.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-green-600">•</span>
                <span>Betreiben Sie die Anwendung ausschließlich über HTTPS, damit Session-Cookies nicht abgegriffen werden können.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-green-600">•</span>
                <span>Erstellen Sie regelmäßig Datensicherungen unter <Link href="/einstellungen/backup" className="text-green-700 hover:underline">Einstellungen → Datensicherung</Link>.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-green-600">•</span>
                <span>Vergeben Sie die Admin-Rolle nur an Personen, die Benutzer und Stammdaten verwalten müssen.</span>
              </li>
            </ul>
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
