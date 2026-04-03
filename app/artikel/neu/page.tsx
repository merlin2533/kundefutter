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

  // Inhaltsstoffe
  const [inhaltsstoffe, setInhaltsstoffe] = useState<{ name: string; menge: string; einheit: string }[]>([]);
  const [kiSearching, setKiSearching] = useState(false);
  const [kiHinweis, setKiHinweis] = useState<string | null>(null);

  async function kiSuche() {
    if (!form.name.trim()) return;
    setKiSearching(true);
    setKiHinweis(null);
    try {
      const res = await fetch("/api/ki/inhaltsstoffe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, kategorie: form.kategorie }),
      });
      const data = await res.json();
      if (!res.ok) { setKiHinweis(data.error ?? "KI-Fehler"); return; }
      if (data.inhaltsstoffe?.length) {
        setInhaltsstoffe(
          data.inhaltsstoffe.map((i: { name: string; menge?: number | null; einheit?: string | null }) => ({
            name: i.name,
            menge: i.menge !== null && i.menge !== undefined ? String(i.menge) : "",
            einheit: i.einheit ?? "",
          }))
        );
      }
      if (data.hinweis) setKiHinweis(data.hinweis);
    } catch {
      setKiHinweis("Netzwerkfehler bei KI-Suche.");
    } finally {
      setKiSearching(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Name ist Pflichtfeld.");
      return;
    }
    setSaving(true);
    setError("");
    const inhaltsstoffePayload = inhaltsstoffe
      .filter((i) => i.name.trim())
      .map((i) => ({
        name: i.name.trim(),
        menge: i.menge ? parseFloat(i.menge) || null : null,
        einheit: i.einheit.trim() || null,
      }));
    const body = {
      ...form,
      artikelnummer: form.artikelnummer.trim() || undefined,
      standardpreis: Number(form.standardpreis) || 0,
      mindestbestand: Number(form.mindestbestand) || 0,
      mwstSatz: Number(form.mwstSatz) || 19,
      inhaltsstoffe: inhaltsstoffePayload.length ? inhaltsstoffePayload : undefined,
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

        {/* Inhaltsstoffe */}
        <div className="border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <label className="block text-sm font-medium text-gray-700">
              Inhaltsstoffe <span className="text-gray-400 text-xs">(optional)</span>
            </label>
            <button
              type="button"
              onClick={kiSuche}
              disabled={kiSearching || !form.name.trim()}
              className="px-3 py-1.5 text-xs border border-purple-300 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg font-medium transition-colors disabled:opacity-60 flex items-center gap-1.5"
            >
              {kiSearching ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  KI sucht…
                </>
              ) : (
                <>🤖 KI-Suche</>
              )}
            </button>
          </div>
          {kiHinweis && (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
              {kiHinweis}
            </div>
          )}
          {inhaltsstoffe.map((item, idx) => (
            <div key={idx} className="flex gap-2 items-start">
              <input
                type="text"
                placeholder="Name (z.B. Schwefel)"
                value={item.name}
                onChange={(e) => {
                  const arr = [...inhaltsstoffe];
                  arr[idx] = { ...arr[idx], name: e.target.value };
                  setInhaltsstoffe(arr);
                }}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
              />
              <input
                type="number"
                step="0.01"
                placeholder="Menge"
                value={item.menge}
                onChange={(e) => {
                  const arr = [...inhaltsstoffe];
                  arr[idx] = { ...arr[idx], menge: e.target.value };
                  setInhaltsstoffe(arr);
                }}
                className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
              />
              <input
                type="text"
                placeholder="Einheit"
                value={item.einheit}
                onChange={(e) => {
                  const arr = [...inhaltsstoffe];
                  arr[idx] = { ...arr[idx], einheit: e.target.value };
                  setInhaltsstoffe(arr);
                }}
                className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
              />
              <button
                type="button"
                onClick={() => setInhaltsstoffe(inhaltsstoffe.filter((_, i) => i !== idx))}
                className="p-2 text-red-400 hover:text-red-600"
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setInhaltsstoffe([...inhaltsstoffe, { name: "", menge: "", einheit: "%" }])}
            className="text-sm text-green-700 hover:text-green-900 font-medium"
          >
            + Inhaltsstoff hinzufügen
          </button>
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
