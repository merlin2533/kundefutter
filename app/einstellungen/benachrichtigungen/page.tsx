"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

interface AlertToggle {
  key: string;
  label: string;
  beschreibung: string;
  icon: string;
}

const ALERT_TYPEN: AlertToggle[] = [
  {
    key: "alert.sachkunde",
    label: "Sachkunde läuft ab (< 90 Tage)",
    beschreibung: "Benachrichtigung wenn der PSM-Sachkundenachweis eines Kunden in weniger als 90 Tagen abläuft.",
    icon: "🎓",
  },
  {
    key: "alert.kreditlimit",
    label: "Kreditlimit überschritten",
    beschreibung: "Benachrichtigung wenn der offene Betrag eines Kunden das eingestellte Kreditlimit übersteigt.",
    icon: "💳",
  },
  {
    key: "alert.lagerbestand",
    label: "Lagerbestand unter Minimum",
    beschreibung: "Benachrichtigung wenn der Lagerbestand eines Artikels unter den Mindestbestand fällt.",
    icon: "📦",
  },
  {
    key: "alert.rechnung_faellig",
    label: "Überfällige Rechnungen (> 14 Tage)",
    beschreibung: "Benachrichtigung wenn Rechnungen seit mehr als 14 Tagen unbezahlt sind.",
    icon: "📄",
  },
];

export default function BenachrichtigungenEinstellungenPage() {
  const [settings, setSettings] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [pruefenLoading, setPruefenLoading] = useState(false);
  const [pruefenResult, setPruefenResult] = useState<{ erstellt: number } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/einstellungen?prefix=alert.")
      .then((r) => (r.ok ? r.json() : {}))
      .then((d) => {
        const map: Record<string, boolean> = {};
        for (const t of ALERT_TYPEN) {
          // default: active (true) unless explicitly set to "false"
          map[t.key] = d[t.key] !== "false";
        }
        setSettings(map);
      })
      .catch(() => {
        const map: Record<string, boolean> = {};
        for (const t of ALERT_TYPEN) map[t.key] = true;
        setSettings(map);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleToggle(key: string, value: boolean) {
    setSaving(key);
    setError("");
    try {
      const res = await fetch("/api/einstellungen", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value: value ? "true" : "false" }),
      });
      if (!res.ok) throw new Error("Fehler beim Speichern");
      setSettings((prev) => ({ ...prev, [key]: value }));
    } catch {
      setError("Fehler beim Speichern der Einstellung.");
    } finally {
      setSaving(null);
    }
  }

  async function handlePruefen() {
    setPruefenLoading(true);
    setPruefenResult(null);
    setError("");
    try {
      const res = await fetch("/api/benachrichtigungen/pruefen", { method: "POST" });
      if (!res.ok) throw new Error("Fehler beim Prüfen");
      const d = await res.json();
      setPruefenResult({ erstellt: d.erstellt ?? 0 });
    } catch {
      setError("Fehler beim Prüfen der Benachrichtigungen.");
    } finally {
      setPruefenLoading(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/einstellungen" className="text-gray-400 hover:text-gray-600 text-sm">
          ← Einstellungen
        </Link>
      </div>

      <h1 className="text-2xl font-bold mb-2">Benachrichtigungen</h1>
      <p className="text-gray-500 text-sm mb-8">
        Konfigurieren Sie welche System-Alerts automatisch erzeugt werden sollen.
        Benachrichtigungen erscheinen im Notification Center (Glocken-Icon in der Navigationsleiste).
      </p>

      {loading ? (
        <div className="text-gray-400 text-sm py-6 text-center">Wird geladen…</div>
      ) : (
        <div className="space-y-3 mb-8">
          {ALERT_TYPEN.map((t) => (
            <div
              key={t.key}
              className="bg-white border border-gray-200 rounded-xl p-4 flex items-start justify-between gap-4"
            >
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <span className="text-2xl leading-none mt-0.5 flex-shrink-0">{t.icon}</span>
                <div className="min-w-0">
                  <p className="font-medium text-gray-800">{t.label}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{t.beschreibung}</p>
                </div>
              </div>
              <div className="flex-shrink-0">
                <button
                  onClick={() => handleToggle(t.key, !settings[t.key])}
                  disabled={saving === t.key}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-60 ${
                    settings[t.key] ? "bg-green-500" : "bg-gray-300"
                  }`}
                  role="switch"
                  aria-checked={settings[t.key]}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      settings[t.key] ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 mb-4">{error}</p>
      )}

      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
        <h2 className="font-semibold text-gray-800 mb-1">Manuell prüfen</h2>
        <p className="text-sm text-gray-500 mb-3">
          Prüft jetzt alle relevanten Daten und erstellt fehlende Benachrichtigungen.
          Dies passiert auch automatisch beim Laden des Dashboards.
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={handlePruefen}
            disabled={pruefenLoading}
            className="px-4 py-2 bg-green-700 hover:bg-green-800 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
          >
            {pruefenLoading ? "Wird geprüft…" : "Jetzt prüfen & Benachrichtigungen aktualisieren"}
          </button>
          {pruefenResult !== null && (
            <span className="text-sm text-green-700 font-medium">
              {pruefenResult.erstellt === 0
                ? "Keine neuen Benachrichtigungen"
                : `${pruefenResult.erstellt} neue Benachrichtigung${pruefenResult.erstellt !== 1 ? "en" : ""} erstellt`}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
