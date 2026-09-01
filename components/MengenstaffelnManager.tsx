"use client";

import { useState } from "react";
import SearchableSelect from "@/components/SearchableSelect";
import { formatEuro } from "@/lib/utils";

export interface MengenstaffelEintrag {
  id: number;
  vonMenge: number;
  preis: number;
  aktiv: boolean;
  kunde: { id: number; name: string; firma?: string | null } | null;
}

interface KundeOption {
  id: number;
  name: string;
  firma?: string | null;
}

interface Props {
  eintraege: MengenstaffelEintrag[];
  einheit: string;
  kunden: KundeOption[];
  onSave: (eintrag: { vonMenge: number; preis: number; kundeId: number | null }) => Promise<boolean>;
  onDelete: (id: number) => Promise<boolean>;
}

// Mengenstaffeln (Mengenrabatt) direkt am Artikel verwalten — absoluter Verkaufspreis ab einer
// Menge, optional auf einen bestimmten Kunden eingeschränkt (leer = gilt für alle Kunden). Wird
// automatisch im Auftragsformular gezogen, sobald die entsprechende Menge erreicht ist
// (lib/utils.ts bestMengenstaffel()). Kein Bearbeiten-Endpunkt vorhanden — nur Anlegen/Löschen,
// wie auch die globale Übersicht unter /mengenrabatte.
export default function MengenstaffelnManager({ eintraege, einheit, kunden, onSave, onDelete }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [vonMenge, setVonMenge] = useState("");
  const [preis, setPreis] = useState("");
  const [kundeId, setKundeId] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  function startAdd() {
    setVonMenge("");
    setPreis("");
    setKundeId("");
    setError("");
    setShowForm(true);
  }

  async function handleSave(ev: React.FormEvent) {
    ev.preventDefault();
    const menge = parseFloat(vonMenge.replace(",", "."));
    const preisWert = parseFloat(preis.replace(",", "."));
    if (!Number.isFinite(menge) || menge <= 0) {
      setError("Bitte eine gültige Menge angeben.");
      return;
    }
    if (!Number.isFinite(preisWert) || preisWert < 0) {
      setError("Bitte einen gültigen Preis angeben.");
      return;
    }
    setSaving(true);
    setError("");
    const ok = await onSave({ vonMenge: menge, preis: preisWert, kundeId: kundeId ? Number(kundeId) : null });
    setSaving(false);
    if (ok) setShowForm(false);
    else setError("Fehler beim Speichern.");
  }

  async function handleDelete(id: number, label: string) {
    if (!confirm(`Staffelpreis „${label}“ wirklich löschen?`)) return;
    setDeletingId(id);
    await onDelete(id);
    setDeletingId(null);
  }

  const sorted = [...eintraege].sort((a, b) => a.vonMenge - b.vonMenge);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Mengenstaffeln</p>
        {!showForm && (
          <button type="button" onClick={startAdd} className="text-xs text-green-700 hover:text-green-900 font-medium">
            + Staffelpreis hinzufügen
          </button>
        )}
      </div>

      {sorted.length === 0 ? (
        <p className="text-xs text-gray-400 italic">
          Keine Mengenstaffel erfasst — es gilt immer der Standardpreis (bzw. ein Kunden-Sonderpreis).
        </p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-200">
              <th className="py-1.5 font-medium">Ab Menge</th>
              <th className="py-1.5 font-medium text-right">Preis</th>
              <th className="py-1.5 font-medium pl-2">Kunde</th>
              <th className="py-1.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map((e) => {
              const kundeLabel = e.kunde ? (e.kunde.firma ? `${e.kunde.firma} (${e.kunde.name})` : e.kunde.name) : "Alle Kunden";
              return (
                <tr key={e.id}>
                  <td className="py-1.5 font-medium">{e.vonMenge.toLocaleString("de-DE")} {einheit}</td>
                  <td className="py-1.5 text-right font-mono">{formatEuro(e.preis)}</td>
                  <td className="py-1.5 pl-2 text-gray-500">
                    {kundeLabel}
                    {!e.aktiv && <span className="ml-1.5 text-[10px] text-gray-400">(inaktiv)</span>}
                  </td>
                  <td className="py-1.5 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => handleDelete(e.id, `ab ${e.vonMenge} ${einheit} · ${formatEuro(e.preis)}`)}
                      disabled={deletingId === e.id}
                      className="text-red-400 hover:text-red-600 px-1 disabled:opacity-50"
                      title="Löschen"
                    >
                      {deletingId === e.id ? "…" : "✕"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {showForm && (
        <form onSubmit={handleSave} className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-0.5">Ab Menge ({einheit})</label>
              <input
                type="number"
                step="0.001"
                min="0"
                value={vonMenge}
                onChange={(e) => setVonMenge(e.target.value)}
                placeholder="z.B. 50"
                className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-0.5">Preis (€)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={preis}
                onChange={(e) => setPreis(e.target.value)}
                placeholder="z.B. 18,00"
                className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-gray-600 mb-0.5">
              Kunde <span className="text-gray-400 font-normal">(leer = gilt für alle Kunden)</span>
            </label>
            <SearchableSelect
              options={kunden.map((k) => ({ value: k.id, label: k.firma ? `${k.firma} – ${k.name}` : k.name }))}
              value={kundeId}
              onChange={setKundeId}
              placeholder="— Alle Kunden —"
              allowClear
              clearLabel="— Alle Kunden —"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowForm(false)}
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
