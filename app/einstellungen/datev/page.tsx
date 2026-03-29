"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";

interface DatevSettings {
  "datev.beraternummer": string;
  "datev.mandantennummer": string;
  "datev.sachkontenrahmen": string;
  "datev.wirtschaftsjahrBeginn": string;
}

const FIELDS: { key: keyof DatevSettings; label: string; description: string; type?: string }[] = [
  {
    key: "datev.beraternummer",
    label: "Beraternummer",
    description: "Nummer des DATEV-Steuerberaters (vom Steuerberater erfragen)",
  },
  {
    key: "datev.mandantennummer",
    label: "Mandantennummer",
    description: "Mandantennummer beim Steuerberater",
  },
  {
    key: "datev.sachkontenrahmen",
    label: "Sachkontenrahmen",
    description: "Kontenrahmen: SKR03 (Standard) oder SKR04",
  },
  {
    key: "datev.wirtschaftsjahrBeginn",
    label: "Wirtschaftsjahr-Beginn (Monat)",
    description: "Startmonat des Wirtschaftsjahres (1 = Januar, 4 = April usw.)",
    type: "number",
  },
];

const DEFAULT_VALUES: DatevSettings = {
  "datev.beraternummer": "0",
  "datev.mandantennummer": "1",
  "datev.sachkontenrahmen": "SKR03",
  "datev.wirtschaftsjahrBeginn": "1",
};

export default function DatevEinstellungenPage() {
  const [form, setForm] = useState<DatevSettings>(DEFAULT_VALUES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/einstellungen?prefix=datev.");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setForm((prev) => ({ ...prev, ...data }));
    } catch {
      setError("Fehler beim Laden der Einstellungen.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  async function handleSave(key: keyof DatevSettings) {
    setSaving(key);
    setError(null);
    try {
      const res = await fetch("/api/einstellungen", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value: form[key] }),
      });
      if (!res.ok) throw new Error();
      setSaved(key);
      setTimeout(() => setSaved(null), 2000);
    } catch {
      setError(`Fehler beim Speichern von "${key}".`);
    } finally {
      setSaving(null);
    }
  }

  async function handleSaveAll(e: React.FormEvent) {
    e.preventDefault();
    setSaving("all");
    setError(null);
    try {
      await Promise.all(
        FIELDS.map((field) =>
          fetch("/api/einstellungen", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key: field.key, value: form[field.key] }),
          })
        )
      );
      setSaved("all");
      setTimeout(() => setSaved(null), 2000);
    } catch {
      setError("Fehler beim Speichern.");
    } finally {
      setSaving(null);
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
        <span className="text-gray-800 font-medium">DATEV</span>
      </div>

      <h1 className="text-2xl font-bold mb-2">DATEV-Einstellungen</h1>
      <p className="text-sm text-gray-500 mb-6">
        Konfiguration für den DATEV-Export (Buchungsstapel). Die Zugangsdaten erhalten Sie von Ihrem Steuerberater.
      </p>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <form onSubmit={handleSaveAll} className="space-y-5">
          {FIELDS.map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-gray-700 mb-0.5">
                {field.label}
              </label>
              <p className="text-xs text-gray-400 mb-1">{field.description}</p>
              <div className="flex gap-2">
                <input
                  type={field.type ?? "text"}
                  value={form[field.key]}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                  min={field.type === "number" ? 1 : undefined}
                  max={field.type === "number" ? 12 : undefined}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <button
                  type="button"
                  onClick={() => handleSave(field.key)}
                  disabled={saving !== null}
                  className="px-3 py-2 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  {saving === field.key
                    ? "…"
                    : saved === field.key
                    ? "✓ Gespeichert"
                    : "Speichern"}
                </button>
              </div>
            </div>
          ))}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving !== null}
              className="px-5 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-60"
            >
              {saving === "all"
                ? "Speichern…"
                : saved === "all"
                ? "✓ Alle gespeichert"
                : "Alle speichern"}
            </button>
          </div>
        </form>
      </div>

      {/* Info box */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <p className="font-medium mb-1">Hinweise zum DATEV-Export</p>
        <ul className="list-disc list-inside space-y-1 text-blue-700">
          <li>Der Export umfasst alle abgerechneten Lieferungen mit Rechnungsnummer im gewählten Zeitraum.</li>
          <li>Erlöskonten: SKR03 — 8400 (19% MwSt), 8300 (7% MwSt), 8000 (0% MwSt)</li>
          <li>SKR04 — 4400 (19% MwSt), 4300 (7% MwSt), 4200 (0% MwSt)</li>
          <li>Debitorenkonten: 10000 + Kunden-ID</li>
          <li>Die CSV-Datei kann direkt in DATEV Buchhalter / DATEV Unternehmen online importiert werden.</li>
        </ul>
      </div>
    </div>
  );
}
