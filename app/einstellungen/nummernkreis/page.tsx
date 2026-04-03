"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

const DEFAULT_NK = { prefix: "ART-", laenge: 5, naechste: 1 };

export default function NummernkreisPage() {
  const [prefix, setPrefix] = useState(DEFAULT_NK.prefix);
  const [laenge, setLaenge] = useState(DEFAULT_NK.laenge);
  const [naechste, setNaechste] = useState(DEFAULT_NK.naechste);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/einstellungen?prefix=artikel.nummernkreis")
      .then((r) => r.json())
      .then((data) => {
        const raw = data["artikel.nummernkreis"];
        if (raw) {
          try {
            const nk = JSON.parse(raw);
            if (nk.prefix !== undefined) setPrefix(nk.prefix);
            if (nk.laenge !== undefined) setLaenge(Number(nk.laenge));
            if (nk.naechste !== undefined) setNaechste(Number(nk.naechste));
          } catch { /* use defaults */ }
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const preview = `${prefix}${String(naechste).padStart(laenge, "0")}`;

  async function save() {
    setSaving(true);
    setSaved(false);
    await fetch("/api/einstellungen", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "artikel.nummernkreis", value: JSON.stringify({ prefix, laenge, naechste }) }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="max-w-lg mx-auto py-6 px-4">
      <Link href="/einstellungen" className="text-green-800 hover:text-green-600 text-sm font-medium">
        &larr; Einstellungen
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mt-4 mb-6">Artikelnummer-Nummernkreis</h1>

      {loading ? (
        <p className="text-sm text-gray-400">Lade…</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Präfix</label>
            <input
              type="text"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              placeholder="z.B. ART-"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
            />
            <p className="text-xs text-gray-400 mt-1">Buchstaben-Prefix vor der Nummer, z.B. "ART-" oder "W-"</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Stellenanzahl</label>
            <input
              type="number"
              min={1}
              max={10}
              value={laenge}
              onChange={(e) => setLaenge(Math.max(1, Math.min(10, parseInt(e.target.value) || 5)))}
              className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
            />
            <p className="text-xs text-gray-400 mt-1">Mindest-Länge der Zahl (mit führenden Nullen aufgefüllt)</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nächste Nummer</label>
            <input
              type="number"
              min={1}
              value={naechste}
              onChange={(e) => setNaechste(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
            />
            <p className="text-xs text-gray-400 mt-1">Die nächste automatisch vergebene Nummer</p>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
            <p className="text-xs text-gray-500 mb-1">Vorschau nächste Artikelnummer</p>
            <p className="text-lg font-mono font-bold text-green-800">{preview}</p>
          </div>

          <button
            onClick={save}
            disabled={saving}
            className="w-full px-4 py-2.5 text-sm rounded-lg bg-green-800 hover:bg-green-700 text-white font-medium disabled:opacity-60"
          >
            {saving ? "Speichern…" : saved ? "Gespeichert" : "Speichern"}
          </button>
        </div>
      )}
    </div>
  );
}
