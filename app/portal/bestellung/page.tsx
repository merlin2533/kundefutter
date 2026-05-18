"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";

export default function PortalBestellungPage() {
  const [artikelName, setArtikelName] = useState("");
  const [menge, setMenge] = useState("");
  const [einheit, setEinheit] = useState("t");
  const [notiz, setNotiz] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/portal/bestellungen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artikelName: artikelName.trim(),
          menge: parseFloat(menge),
          einheit,
          notiz: notiz.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Fehler beim Absenden");
        return;
      }
      setSuccess(true);
      setArtikelName("");
      setMenge("");
      setNotiz("");
    } catch {
      setError("Verbindungsfehler");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-lg">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/portal" className="text-sm text-gray-500 hover:text-gray-700">
          ← Zurück
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Bestellung anfragen</h1>
      </div>

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-800 rounded-xl p-4 mb-4">
          <p className="font-semibold">Bestellung erfolgreich übermittelt!</p>
          <p className="text-sm mt-1">Ihr Händler wird sich mit Ihnen in Verbindung setzen.</p>
          <button
            onClick={() => setSuccess(false)}
            className="text-sm text-green-700 hover:underline mt-2 block"
          >
            Weitere Bestellung aufgeben
          </button>
        </div>
      )}

      {!success && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm text-gray-500 mb-4">
            Füllen Sie das Formular aus und Ihr Händler wird Ihre Anfrage bearbeiten.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Artikel / Produkt <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={artikelName}
                onChange={(e) => setArtikelName(e.target.value)}
                required
                placeholder="z.B. Mais-Saatgut NK Cobalt"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Menge <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={menge}
                  onChange={(e) => setMenge(e.target.value)}
                  required
                  min="0.01"
                  step="0.01"
                  placeholder="0"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Einheit</label>
                <select
                  value={einheit}
                  onChange={(e) => setEinheit(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                >
                  <option>t</option>
                  <option>kg</option>
                  <option>Sack</option>
                  <option>Big Bag</option>
                  <option>Liter</option>
                  <option>Stück</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notiz / Wunschtermin
              </label>
              <textarea
                value={notiz}
                onChange={(e) => setNotiz(e.target.value)}
                rows={3}
                placeholder="z.B. Lieferung bis Ende der Woche, bitte anrufen"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
              />
            </div>

            {error && (
              <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-green-700 hover:bg-green-800 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? "Sende…" : "Bestellung absenden"}
              </button>
              <Link
                href="/portal"
                className="px-4 py-2.5 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-center"
              >
                Abbrechen
              </Link>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
