"use client";

import React, { useState } from "react";
import { formatEuro, formatDatum } from "@/lib/utils";

export interface EinkaufspreisEintrag {
  id: number;
  datum: string;
  einkaufspreis: number;
  aktiv: boolean;
  notiz?: string | null;
}

interface Props {
  eintraege: EinkaufspreisEintrag[];
  onSave: (eintrag: { datum: string; einkaufspreis: number; notiz: string | null }) => Promise<boolean>;
  onUpdate: (id: number, eintrag: { datum: string; einkaufspreis: number; notiz: string | null }) => Promise<boolean>;
  onDelete: (id: number) => Promise<boolean>;
  onAktivieren: (id: number) => Promise<boolean>;
}

function heute(): string {
  return new Date().toISOString().slice(0, 10);
}

// Datumsgenaue Einkaufspreis-Historie je Lieferant (ArtikelLieferantPreis) — Preise ändern sich
// häufig innerhalb der Saison, nicht nur zwischen Jahren. Anders als bei Jahresgültigkeiten gibt
// es keine automatische Auflösung: der Nutzer markiert per Radio-Button explizit EINEN Eintrag
// als aktuell gültig; das Aktivieren übernimmt dessen Preis sofort in ArtikelLieferant.einkaufspreis.
export default function EinkaufspreisVerlaufManager({ eintraege, onSave, onUpdate, onDelete, onAktivieren }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ datum: heute(), preis: "", notiz: "" });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [aktivierendId, setAktivierendId] = useState<number | null>(null);
  const [error, setError] = useState("");

  function startAdd() {
    setForm({ datum: heute(), preis: "", notiz: "" });
    setEditId(null);
    setError("");
    setShowForm(true);
  }

  function startEdit(e: EinkaufspreisEintrag) {
    setForm({ datum: e.datum.slice(0, 10), preis: String(e.einkaufspreis), notiz: e.notiz ?? "" });
    setEditId(e.id);
    setError("");
    setShowForm(true);
  }

  async function handleSave(ev: React.FormEvent) {
    ev.preventDefault();
    const preis = parseFloat(form.preis.replace(",", "."));
    if (!form.datum) {
      setError("Bitte ein gültiges Datum angeben.");
      return;
    }
    if (!Number.isFinite(preis) || preis < 0) {
      setError("Bitte einen gültigen Preis angeben.");
      return;
    }
    setSaving(true);
    setError("");
    const eintrag = { datum: form.datum, einkaufspreis: preis, notiz: form.notiz.trim() || null };
    const ok = editId !== null ? await onUpdate(editId, eintrag) : await onSave(eintrag);
    setSaving(false);
    if (ok) {
      setShowForm(false);
      setEditId(null);
    } else {
      setError("Fehler beim Speichern.");
    }
  }

  async function handleDelete(e: EinkaufspreisEintrag) {
    if (!confirm(`Preiseintrag vom ${formatDatum(e.datum)} wirklich löschen?`)) return;
    setDeletingId(e.id);
    await onDelete(e.id);
    setDeletingId(null);
  }

  async function handleAktivieren(id: number) {
    setAktivierendId(id);
    await onAktivieren(id);
    setAktivierendId(null);
  }

  const sorted = [...eintraege].sort((a, b) => b.datum.localeCompare(a.datum));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Preisverlauf — Einkaufspreis</p>
          <p className="text-[11px] text-gray-400">Datumsgenaue Preisänderungen, z.B. innerhalb der Saison. Aktuell gültigen Preis per Radio-Button auswählen.</p>
        </div>
        {!showForm && (
          <button type="button" onClick={startAdd} className="text-xs text-green-700 hover:text-green-900 font-medium whitespace-nowrap">
            + Preis hinzufügen
          </button>
        )}
      </div>

      {sorted.length === 0 ? (
        <p className="text-xs text-gray-400 italic">Kein Preisverlauf erfasst — es gilt der oben hinterlegte Einkaufspreis.</p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-200">
              <th className="py-1.5 font-medium w-10">Aktiv</th>
              <th className="py-1.5 font-medium">Datum</th>
              <th className="py-1.5 font-medium text-right">Einkaufspreis</th>
              <th className="py-1.5 font-medium pl-2">Notiz</th>
              <th className="py-1.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map((e) => (
              <tr key={e.id} className={e.aktiv ? "bg-green-50" : ""}>
                <td className="py-1.5">
                  <button
                    type="button"
                    onClick={() => handleAktivieren(e.id)}
                    disabled={e.aktiv || aktivierendId === e.id}
                    title={e.aktiv ? "Aktuell gültiger Preis" : "Als aktuell gültig markieren"}
                    className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                      e.aktiv ? "bg-green-600 border-green-600" : "border-gray-300 hover:border-green-400 disabled:opacity-50"
                    }`}
                  >
                    {e.aktiv && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </button>
                </td>
                <td className="py-1.5 font-medium">{formatDatum(e.datum)}</td>
                <td className="py-1.5 text-right font-mono">
                  {formatEuro(e.einkaufspreis)}
                  {e.aktiv && <span className="ml-1 text-green-700 font-semibold">✓ aktuell</span>}
                </td>
                <td className="py-1.5 pl-2 text-gray-500">{e.notiz ?? "—"}</td>
                <td className="py-1.5 text-right whitespace-nowrap">
                  <button type="button" onClick={() => startEdit(e)} className="text-gray-400 hover:text-green-700 px-1" title="Bearbeiten">
                    ✎
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(e)}
                    disabled={deletingId === e.id}
                    className="text-red-400 hover:text-red-600 px-1 disabled:opacity-50"
                    title="Löschen"
                  >
                    {deletingId === e.id ? "…" : "✕"}
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
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-0.5">Datum</label>
              <input
                type="date"
                value={form.datum}
                onChange={(e) => setForm({ ...form, datum: e.target.value })}
                className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-0.5">Einkaufspreis (€)</label>
              <input
                type="number"
                step="0.001"
                min="0"
                value={form.preis}
                onChange={(e) => setForm({ ...form, preis: e.target.value })}
                className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
              />
            </div>
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
              onClick={() => { setShowForm(false); setEditId(null); }}
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
