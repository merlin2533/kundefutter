"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const KATEGORIEN = ["Futter", "Duenger", "Saatgut"];
const EINHEITEN = ["kg", "t", "Sack", "Stk", "Liter", "Palette"];

const defaultForm = {
  name: "",
  artikelnummer: "",
  kategorie: "Futter",
  einheit: "kg",
  standardpreis: "",
  mindestbestand: "0",
  mwstSatz: "19",
  lagerort: "",
};

export default function NeuerArtikelPage() {
  const router = useRouter();
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Name ist Pflichtfeld.");
      return;
    }
    setSaving(true);
    setError("");
    const body = {
      ...form,
      artikelnummer: form.artikelnummer.trim() || undefined,
      standardpreis: Number(form.standardpreis) || 0,
      mindestbestand: Number(form.mindestbestand) || 0,
      mwstSatz: Number(form.mwstSatz) || 19,
    };
    try {
      const res = await fetch("/api/artikel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        router.push("/artikel/" + data.id);
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Fehler beim Speichern.");
      }
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto py-6 sm:py-10 px-4">
      <Link
        href="/artikel"
        className="text-green-800 hover:text-green-600 text-sm font-medium"
      >
        &larr; Zur&uuml;ck zur Artikelliste
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mt-4 mb-6">
        Neuen Artikel anlegen
      </h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Artikelnummer{" "}
            <span className="text-gray-400 text-xs">(leer = automatisch)</span>
          </label>
          <input
            type="text"
            value={form.artikelnummer}
            onChange={(e) => setForm({ ...form, artikelnummer: e.target.value })}
            placeholder="ART-00001"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Kategorie
            </label>
            <select
              value={form.kategorie}
              onChange={(e) => setForm({ ...form, kategorie: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
            >
              {KATEGORIEN.map((k) => (
                <option key={k} value={k}>
                  {k === "Duenger" ? "D\u00FCnger" : k}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Einheit
            </label>
            <select
              value={form.einheit}
              onChange={(e) => setForm({ ...form, einheit: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
            >
              {EINHEITEN.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Standardpreis (&euro;)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.standardpreis}
              onChange={(e) =>
                setForm({ ...form, standardpreis: e.target.value })
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mindestbestand
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.mindestbestand}
              onChange={(e) =>
                setForm({ ...form, mindestbestand: e.target.value })
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            MwSt-Satz
          </label>
          <select
            value={form.mwstSatz}
            onChange={(e) => setForm({ ...form, mwstSatz: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
          >
            <option value="0">0% (Steuerfrei)</option>
            <option value="7">7% (erm&auml;&szlig;igt)</option>
            <option value="19">19% (Regelsatz)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Lagerort{" "}
            <span className="text-gray-400 text-xs">(optional, z.B. Halle 1)</span>
          </label>
          <input
            type="text"
            value={form.lagerort}
            onChange={(e) => setForm({ ...form, lagerort: e.target.value })}
            placeholder="z.B. Halle 1, Außenlager, Silo A"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
          <Link
            href="/artikel"
            className="px-4 py-2.5 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 text-center w-full sm:w-auto"
          >
            Abbrechen
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2.5 text-sm rounded-lg bg-green-800 hover:bg-green-700 text-white font-medium disabled:opacity-60 w-full sm:w-auto"
          >
            {saving ? "Speichern\u2026" : "Artikel anlegen"}
          </button>
        </div>
      </form>
    </div>
  );
}
