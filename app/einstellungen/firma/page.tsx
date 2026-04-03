"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";

interface FirmaSettings {
  "firma.name": string;
  "firma.zusatz": string;
  "firma.strasse": string;
  "firma.plz": string;
  "firma.ort": string;
  "firma.telefon": string;
  "firma.email": string;
  "firma.steuernummer": string;
  "firma.ustIdNr": string;
  "firma.iban": string;
  "firma.bic": string;
  "firma.bank": string;
  "firma.mwstSatz": string;
  "firma.zahlungszielStandard": string;
}

const FIELDS: { key: keyof FirmaSettings; label: string; type?: string; placeholder?: string }[] = [
  { key: "firma.name", label: "Firmenname" },
  { key: "firma.zusatz", label: "Zusatz" },
  { key: "firma.strasse", label: "Straße" },
  { key: "firma.plz", label: "PLZ" },
  { key: "firma.ort", label: "Ort" },
  { key: "firma.telefon", label: "Telefon", type: "tel" },
  { key: "firma.email", label: "E-Mail", type: "email" },
  { key: "firma.steuernummer", label: "Steuernummer / UID" },
  { key: "firma.ustIdNr", label: "USt-IdNr.", placeholder: "DE123456789" },
  { key: "firma.iban", label: "IBAN" },
  { key: "firma.bic", label: "BIC" },
  { key: "firma.bank", label: "Bank" },
  { key: "firma.mwstSatz", label: "MwSt-Satz (%)", type: "number" },
  { key: "firma.zahlungszielStandard", label: "Zahlungsziel Standard (Tage)", type: "number" },
];

const DEFAULT_VALUES: FirmaSettings = {
  "firma.name": "",
  "firma.zusatz": "",
  "firma.strasse": "",
  "firma.plz": "",
  "firma.ort": "",
  "firma.telefon": "",
  "firma.email": "",
  "firma.steuernummer": "",
  "firma.ustIdNr": "",
  "firma.iban": "",
  "firma.bic": "",
  "firma.bank": "",
  "firma.mwstSatz": "19",
  "firma.zahlungszielStandard": "30",
};

export default function FirmaPage() {
  const [form, setForm] = useState<FirmaSettings>(DEFAULT_VALUES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/einstellungen");
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

  async function handleSave(key: keyof FirmaSettings) {
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
      for (const field of FIELDS) {
        await fetch("/api/einstellungen", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: field.key, value: form[field.key] }),
        });
      }
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
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/einstellungen" className="hover:text-green-700">Einstellungen</Link>
        <span>›</span>
        <span className="text-gray-800 font-medium">Firma</span>
      </div>

      <h1 className="text-2xl font-bold mb-6">Firmadaten</h1>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <form onSubmit={handleSaveAll} className="space-y-4">
          {FIELDS.map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {field.label}
              </label>
              <div className="flex gap-2">
                <input
                  type={field.type ?? "text"}
                  value={form[field.key]}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                  placeholder={field.placeholder}
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
    </div>
  );
}
