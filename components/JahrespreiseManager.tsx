"use client";

import React, { useState } from "react";
import { formatEuro } from "@/lib/utils";

export interface JahrespreisEintrag {
  jahr: number;
  preis: number;
  rabatt?: number;
  notiz?: string | null;
}

interface Props {
  eintraege: JahrespreisEintrag[];
  preisLabel: string;
  showRabatt?: boolean;
  onSave: (eintrag: { jahr: number; preis: number; rabatt?: number; notiz: string | null }) => Promise<boolean>;
  onDelete: (jahr: number) => Promise<boolean>;
}

// Generische Verwaltung von Jahresgültigkeiten (ArtikelJahrespreis, ArtikelLieferantJahrespreis,
// KundeArtikelPreisJahr) — Anlegen/Bearbeiten/Löschen eines Preises je Kalenderjahr. Fehlende
// Jahre werden serverseitig auf das nächstgelegene bekannte Jahr interpoliert (lib/jahrespreis.ts).
export default function JahrespreiseManager({ eintraege, preisLabel, showRabatt, onSave, onDelete }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editJahr, setEditJahr] = useState<number | null>(null);
  const [form, setForm] = useState({ jahr: String(new Date().getFullYear()), preis: "", rabatt: "0", notiz: "" });
  const [saving, setSaving] = useState(false);
  const [deletingJahr, setDeletingJahr] = useState<number | null>(null);
  const [error, setError] = useState("");

  function startAdd() {
    setForm({ jahr: String(new Date().getFullYear()), preis: "", rabatt: "0", notiz: "" });
    setEditJahr(null);
    setError("");
    setShowForm(true);
  }

  function startEdit(e: JahrespreisEintrag) {
    setForm({ jahr: String(e.jahr), preis: String(e.preis), rabatt: String(e.rabatt ?? 0), notiz: e.notiz ?? "" });
    setEditJahr(e.jahr);
    setError("");
    setShowForm(true);
  }

  async function handleSave(ev: React.FormEvent) {
    ev.preventDefault();
    const jahr = parseInt(form.jahr, 10);
    const preis = parseFloat(form.preis.replace(",", "."));
    if (!Number.isInteger(jahr) || jahr < 1900 || jahr > 2100) {
      setError("Bitte ein gültiges Jahr angeben.");
      return;
    }
    if (!Number.isFinite(preis) || preis < 0) {
      setError("Bitte einen gültigen Preis angeben.");
      return;
    }
    setSaving(true);
    setError("");
    const ok = await onSave({
      jahr,
      preis,
      rabatt: showRabatt ? parseFloat(form.rabatt.replace(",", ".")) || 0 : undefined,
      notiz: form.notiz.trim() || null,
    });
    setSaving(false);
    if (ok) {
      setShowForm(false);
      setEditJahr(null);
    } else {
      setError("Fehler beim Speichern.");
    }
  }

  async function handleDelete(jahr: number) {
    if (!confirm(`Jahrespreis für ${jahr} wirklich löschen?`)) return;
    setDeletingJahr(jahr);
    await onDelete(jahr);
    setDeletingJahr(null);
  }

  const sorted = [...eintraege].sort((a, b) => a.jahr - b.jahr);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Jahresgültigkeiten — {preisLabel}</p>
        {!showForm && (
          <button
            type="button"
            onClick={startAdd}
            className="text-xs text-green-700 hover:text-green-900 font-medium"
          >
            + Jahr hinzufügen
          </button>
        )}
      </div>

      {sorted.length === 0 ? (
        <p className="text-xs text-gray-400 italic">Kein Jahrespreis erfasst — es gilt immer der Basispreis.</p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-200">
              <th className="py-1.5 font-medium">Jahr</th>
              <th className="py-1.5 font-medium text-right">{preisLabel}</th>
              {showRabatt && <th className="py-1.5 font-medium text-right">Rabatt</th>}
              <th className="py-1.5 font-medium pl-2">Notiz</th>
              <th className="py-1.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map((e) => (
              <tr key={e.jahr}>
                <td className="py-1.5 font-medium">{e.jahr}</td>
                <td className="py-1.5 text-right font-mono">{formatEuro(e.preis)}</td>
                {showRabatt && <td className="py-1.5 text-right">{e.rabatt ? `${e.rabatt}%` : "—"}</td>}
                <td className="py-1.5 pl-2 text-gray-500">{e.notiz ?? "—"}</td>
                <td className="py-1.5 text-right whitespace-nowrap">
                  <button type="button" onClick={() => startEdit(e)} className="text-gray-400 hover:text-green-700 px-1" title="Bearbeiten">
                    ✎
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(e.jahr)}
                    disabled={deletingJahr === e.jahr}
                    className="text-red-400 hover:text-red-600 px-1 disabled:opacity-50"
                    title="Löschen"
                  >
                    {deletingJahr === e.jahr ? "…" : "✕"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showForm && (
        <form onSubmit={handleSave} className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className={`grid gap-2 ${showRabatt ? "grid-cols-3" : "grid-cols-2"}`}>
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-0.5">Jahr</label>
              <input
                type="number"
                min="1900"
                max="2100"
                value={form.jahr}
                disabled={editJahr !== null}
                onChange={(e) => setForm({ ...form, jahr: e.target.value })}
                className="w-full border border-gray-300 rounded px-2 py-1 text-xs disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-0.5">{preisLabel} (€)</label>
              <input
                type="number"
                step="0.001"
                min="0"
                value={form.preis}
                onChange={(e) => setForm({ ...form, preis: e.target.value })}
                className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
              />
            </div>
            {showRabatt && (
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-0.5">Rabatt (%)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={form.rabatt}
                  onChange={(e) => setForm({ ...form, rabatt: e.target.value })}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                />
              </div>
            )}
          </div>
          <div>
            <label className="block text-[11px] font-medium text-gray-600 mb-0.5">Notiz (optional)</label>
            <input
              type="text"
              value={form.notiz}
              onChange={(e) => setForm({ ...form, notiz: e.target.value })}
              className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => { setShowForm(false); setEditJahr(null); }}
              className="px-2.5 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-2.5 py-1 text-xs bg-green-700 hover:bg-green-800 text-white rounded disabled:opacity-60"
            >
              {saving ? "…" : "Speichern"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
