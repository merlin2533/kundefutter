"use client";

import React, { useEffect, useState } from "react";
import SearchableSelect from "@/components/SearchableSelect";
import { formatEuro } from "@/lib/utils";
import { Kunde, Artikel, KundeArtikelPreis } from "../_shared";

export default function SonderpreiseTab({ kunde, onRefresh }: { kunde: Kunde; onRefresh: () => void }) {
  const [artikel, setArtikel] = useState<Artikel[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ artikelId: "", preis: "", rabatt: "0" });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/artikel?aktiv=true")
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setArtikel(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.artikelId || !form.preis) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/kunden/${kunde.id}/preise`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artikelId: Number(form.artikelId),
          preis: Number(form.preis),
          rabatt: Number(form.rabatt) || 0,
        }),
      });
      if (!res.ok) throw new Error();
      setShowAdd(false);
      setForm({ artikelId: "", preis: "", rabatt: "0" });
      onRefresh();
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(artikelId: number) {
    setDeleting(artikelId);
    try {
      await fetch(`/api/kunden/${kunde.id}/preise`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artikelId }),
      });
      onRefresh();
    } finally {
      setDeleting(null);
    }
  }

  function effectivePrice(p: KundeArtikelPreis) {
    return Math.round(p.preis * (1 - p.rabatt / 100) * 100) / 100;
  }

  function marge(p: KundeArtikelPreis) {
    const eff = effectivePrice(p);
    const std = p.artikel.standardpreis;
    if (std <= 0) return null;
    const pct = ((eff - std) / std) * 100;
    return pct.toFixed(1);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setShowAdd(true)}
          className="text-sm px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
        >
          + Sonderpreis hinzufügen
        </button>
      </div>

      {kunde.artikelPreise.length === 0 ? (
        <p className="text-sm text-gray-400">Keine Sonderpreise erfasst.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Artikel</th>
                <th className="hidden md:table-cell text-right px-4 py-2 font-medium text-gray-600">Listenpreis</th>
                <th className="hidden sm:table-cell text-right px-4 py-2 font-medium text-gray-600">Sonderpreis</th>
                <th className="hidden lg:table-cell text-right px-4 py-2 font-medium text-gray-600">Rabatt</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600">Effektiv</th>
                <th className="hidden md:table-cell text-right px-4 py-2 font-medium text-gray-600">Marge vs. Standard</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {kunde.artikelPreise.map((p) => {
                const eff = effectivePrice(p);
                const m = marge(p);
                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5">
                      <p className="font-medium">{p.artikel.name}</p>
                      <p className="text-xs text-gray-400">{p.artikel.artikelnummer}</p>
                      <div className="sm:hidden text-xs text-gray-500 mt-0.5">{formatEuro(p.preis)}{p.rabatt > 0 ? ` · ${p.rabatt}% Rabatt` : ""}</div>
                    </td>
                    <td className="hidden md:table-cell px-4 py-2.5 text-right font-mono text-gray-500">
                      {formatEuro(p.artikel.standardpreis)}
                    </td>
                    <td className="hidden sm:table-cell px-4 py-2.5 text-right font-mono">{formatEuro(p.preis)}</td>
                    <td className="hidden lg:table-cell px-4 py-2.5 text-right">{p.rabatt > 0 ? `${p.rabatt}%` : "—"}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold">{formatEuro(eff)}</td>
                    <td className="hidden md:table-cell px-4 py-2.5 text-right">
                      {m !== null ? (
                        <span className={Number(m) >= 0 ? "text-green-700" : "text-red-600"}>
                          {Number(m) >= 0 ? "+" : ""}{m}%
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => handleDelete(p.artikelId)}
                        disabled={deleting === p.artikelId}
                        className="text-red-500 hover:text-red-700 text-xs disabled:opacity-50"
                      >
                        {deleting === p.artikelId ? "…" : "Löschen"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <h3 className="text-sm font-semibold mb-3">Neuer Sonderpreis</h3>
          <form onSubmit={handleAdd} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Artikel <span className="text-red-500">*</span></label>
              <SearchableSelect
                options={artikel.map((a) => ({ value: a.id, label: a.name, sub: `${a.artikelnummer} · ${formatEuro(a.standardpreis)}` }))}
                value={form.artikelId}
                onChange={(v) => setForm({ ...form, artikelId: v })}
                placeholder="— Bitte wählen —"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Preis (€) <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.preis}
                  onChange={(e) => setForm({ ...form, preis: e.target.value })}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Rabatt (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={form.rabatt}
                  onChange={(e) => setForm({ ...form, rabatt: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-60"
              >
                {saving ? "…" : "Speichern"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
