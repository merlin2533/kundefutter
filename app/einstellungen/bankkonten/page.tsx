"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";

interface Bankkonto {
  name: string;
  iban: string;
  bic: string;
}

const EMPTY_KONTO: Bankkonto = { name: "", iban: "", bic: "" };

export default function BankkontenPage() {
  const [konten, setKonten] = useState<Bankkonto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/einstellungen?prefix=bankabgleich.");
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data["bankabgleich.konten"]) {
        try {
          const parsed = JSON.parse(data["bankabgleich.konten"]);
          if (Array.isArray(parsed)) setKonten(parsed);
        } catch {
          // keep empty
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
    setKonten((prev) => [...prev, { ...EMPTY_KONTO }]);
  }

  function handleRemove(idx: number) {
    setKonten((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleChange(idx: number, field: keyof Bankkonto, value: string) {
    setKonten((prev) =>
      prev.map((k, i) => (i === idx ? { ...k, [field]: value } : k))
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Validate: each konto needs at least a name and IBAN
    for (let i = 0; i < konten.length; i++) {
      if (!konten[i].name.trim()) {
        setError(`Konto ${i + 1}: Bezeichnung ist Pflichtfeld.`);
        return;
      }
      if (!konten[i].iban.trim()) {
        setError(`Konto ${i + 1}: IBAN ist Pflichtfeld.`);
        return;
      }
    }

    setSaving(true);
    try {
      const res = await fetch("/api/einstellungen", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "bankabgleich.konten", value: JSON.stringify(konten) }),
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
        <span className="text-gray-800 font-medium">Bankkonten</span>
      </div>

      <h1 className="text-2xl font-bold mb-2">Bankkonten</h1>
      <p className="text-sm text-gray-500 mb-6">
        Hinterlegen Sie die Bankkonten für den Kontoauszug-Import und Bankabgleich.
      </p>

      {/* Info */}
      <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <p className="text-blue-700">
          Diese Bezeichnungen werden beim CSV-Import als Vorauswahl angeboten.
        </p>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <form onSubmit={handleSave} className="space-y-5">
          {konten.length === 0 && (
            <p className="text-sm text-gray-400">Noch keine Bankkonten hinterlegt.</p>
          )}

          {konten.map((konto, idx) => (
            <div key={idx} className="border border-gray-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Konto {idx + 1}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemove(idx)}
                  className="text-xs text-red-600 hover:text-red-700 border border-red-200 rounded-lg px-2 py-1 hover:bg-red-50 transition-colors"
                >
                  Entfernen
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bezeichnung <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={konto.name}
                  onChange={(e) => handleChange(idx, "name", e.target.value)}
                  placeholder="z.B. Geschäftskonto Sparkasse"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  IBAN <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={konto.iban}
                  onChange={(e) => handleChange(idx, "iban", e.target.value)}
                  placeholder="DE12 3456 7890 1234 5678 90"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  BIC <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={konto.bic}
                  onChange={(e) => handleChange(idx, "bic", e.target.value)}
                  placeholder="z.B. SSKMDEMMXXX"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 font-mono"
                />
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={handleAdd}
            className="w-full py-2 text-sm border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-green-500 hover:text-green-700 transition-colors"
          >
            + Konto hinzufügen
          </button>

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
