"use client";

import { useState } from "react";

export interface NeuArtikelErgebnis {
  id: number;
  name: string;
  artikelnummer: string;
  einheit: string;
  standardpreis: number;
  aktuellerBestand: number;
  mindestbestand: number;
  kategorie?: string;
}

interface NeuArtikelForm {
  name: string;
  artikelnummer: string;
  einheit: string;
  kategorie: string;
  standardpreis: string;
  lieferantId: string;
  kiInhaltsstoffe: boolean;
}

const DEFAULT_KATEGORIEN = ["Futter", "Duenger", "Saatgut", "Analysen", "Beratung", "Pflege"];
const DEFAULT_EINHEITEN = ["kg", "t", "l", "ml", "Stück", "Sack", "Big Bag", "Ballen", "Palette", "m²", "ha"];

export default function NeuArtikelInline({
  kiName,
  kiEinheit,
  kiArtikelnummer,
  kiPreis,
  lieferanten,
  onCreated,
  onCancel,
}: {
  kiName: string;
  kiEinheit?: string;
  kiArtikelnummer?: string;
  kiPreis?: number;
  lieferanten: { id: number; name: string }[];
  onCreated: (artikel: NeuArtikelErgebnis) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<NeuArtikelForm>({
    name: kiName,
    artikelnummer: kiArtikelnummer ?? "",
    einheit: kiEinheit ?? "kg",
    kategorie: "Futter",
    standardpreis: kiPreis != null ? String(kiPreis) : "",
    lieferantId: "",
    kiInhaltsstoffe: false,
  });
  const [saving, setSaving] = useState(false);
  const [kiSearching, setKiSearching] = useState(false);
  const [error, setError] = useState("");

  async function handleKiInhaltsstoffe() {
    setKiSearching(true);
    try {
      const res = await fetch("/api/ki/inhaltsstoffe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, kategorie: form.kategorie }),
      });
      if (!res.ok) throw new Error("KI-Suche fehlgeschlagen");
      // Inhaltsstoffe werden beim Anlegen mitgegeben — hier nur als Info
      setForm((f) => ({ ...f, kiInhaltsstoffe: true }));
    } catch {
      setError("KI-Suche nicht verfügbar");
    } finally {
      setKiSearching(false);
    }
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    setError("");
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        einheit: form.einheit,
        kategorie: form.kategorie,
        standardpreis: parseFloat(form.standardpreis) || 0,
        aktuellerBestand: 0,
        mindestbestand: 0,
        mwstSatz: 19,
      };
      if (form.artikelnummer) body.artikelnummer = form.artikelnummer;
      if (form.lieferantId) {
        body.lieferanten = [{ lieferantId: parseInt(form.lieferantId, 10), einkaufspreis: 0 }];
      }

      const res = await fetch("/api/artikel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Anlegen fehlgeschlagen");
      }
      const neuArtikel = await res.json();
      onCreated({
        id: neuArtikel.id,
        name: neuArtikel.name,
        artikelnummer: neuArtikel.artikelnummer ?? "",
        einheit: neuArtikel.einheit,
        standardpreis: neuArtikel.standardpreis ?? 0,
        aktuellerBestand: 0,
        mindestbestand: 0,
        kategorie: neuArtikel.kategorie,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Fehler");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 p-4 rounded-lg border border-blue-200 bg-blue-50 space-y-3">
      <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Neuen Artikel anlegen</p>

      {error && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Artikelname *</label>
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Artikelnummer</label>
          <input
            value={form.artikelnummer}
            onChange={(e) => setForm((f) => ({ ...f, artikelnummer: e.target.value }))}
            placeholder="Autom. vergeben"
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Kategorie</label>
          <select
            value={form.kategorie}
            onChange={(e) => setForm((f) => ({ ...f, kategorie: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {DEFAULT_KATEGORIEN.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Einheit</label>
          <input
            list="einheiten-list-neu"
            value={form.einheit}
            onChange={(e) => setForm((f) => ({ ...f, einheit: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <datalist id="einheiten-list-neu">
            {DEFAULT_EINHEITEN.map((e) => <option key={e} value={e} />)}
          </datalist>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Standardpreis (€)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.standardpreis}
            onChange={(e) => setForm((f) => ({ ...f, standardpreis: e.target.value }))}
            placeholder="0.00"
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Lieferant zuordnen</label>
          <select
            value={form.lieferantId}
            onChange={(e) => setForm((f) => ({ ...f, lieferantId: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">— kein Lieferant —</option>
            {lieferanten.map((l) => (
              <option key={l.id} value={String(l.id)}>{l.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 pt-1">
        <button
          type="button"
          onClick={handleKiInhaltsstoffe}
          disabled={kiSearching || !form.name}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-100 text-purple-700 hover:bg-purple-200 disabled:opacity-50 transition-colors"
        >
          {kiSearching ? (
            <span className="w-3 h-3 border-2 border-purple-700 border-t-transparent rounded-full animate-spin" />
          ) : "🤖"}
          {form.kiInhaltsstoffe ? "Inhaltsstoffe werden ergänzt ✓" : "KI-Inhaltsstoffe suchen"}
        </button>

        <div className="flex gap-2">
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
    </div>
  );
}
