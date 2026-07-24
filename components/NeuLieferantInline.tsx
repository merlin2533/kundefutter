"use client";

import { useState } from "react";

export interface NeuLieferantErgebnis {
  id: number;
  name: string;
}

export default function NeuLieferantInline({
  kiName,
  onCreated,
  onCancel,
}: {
  kiName: string;
  onCreated: (lieferant: NeuLieferantErgebnis) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({ name: kiName, email: "", telefon: "", ort: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/lieferanten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim() || undefined,
          telefon: form.telefon.trim() || undefined,
          ort: form.ort.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Anlegen fehlgeschlagen");
      }
      const neu = await res.json();
      onCreated({ id: neu.id, name: neu.name });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Fehler");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-2 p-4 rounded-lg border border-blue-200 bg-blue-50 space-y-3">
      <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Neuen Lieferanten anlegen</p>

      {error && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">E-Mail</label>
          <input
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Telefon</label>
          <input
            value={form.telefon}
            onChange={(e) => setForm((f) => ({ ...f, telefon: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Ort</label>
          <input
            value={form.ort}
            onChange={(e) => setForm((f) => ({ ...f, ort: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
        >
          Abbrechen
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !form.name.trim()}
          className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
        >
          {saving && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
          Anlegen &amp; zuordnen
        </button>
      </div>
    </div>
  );
}
