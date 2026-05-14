"use client";

import React, { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { DEFAULT_FRUCHTARTEN, parseListSetting } from "@/lib/auswahllisten";
import { KundeSchlag, inputClsSchlag } from "../_shared";

const WetterWidget = dynamic(() => import("@/components/WetterWidget"), { ssr: false });

export default function SchlagkarteiTab({ kundeId, lat, lng }: { kundeId: number; lat?: number | null; lng?: number | null }) {
  const [schlaegte, setSchlaegte] = useState<KundeSchlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [fruchtarten, setFruchtarten] = useState<string[]>(DEFAULT_FRUCHTARTEN);
  const [form, setForm] = useState({
    name: "",
    flaeche: "",
    fruchtart: "",
    sorte: "",
    vorfrucht: "",
    aussaatJahr: "",
    aussaatMenge: "",
    notiz: "",
  });

  useEffect(() => {
    fetch("/api/einstellungen?prefix=system.")
      .then((r) => r.ok ? r.json() : {})
      .then((d: Record<string, string>) => setFruchtarten(parseListSetting(d, "system.fruchtarten", DEFAULT_FRUCHTARTEN)))
      .catch(() => {});
  }, []);

  const fetchSchlaegte = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/kunden/${kundeId}/schlaegte`);
    const data = await res.json();
    setSchlaegte(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [kundeId]);

  useEffect(() => { fetchSchlaegte(); }, [fetchSchlaegte]);

  function resetForm() {
    setForm({ name: "", flaeche: "", fruchtart: "", sorte: "", vorfrucht: "", aussaatJahr: "", aussaatMenge: "", notiz: "" });
    setError("");
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.flaeche) { setError("Name und Fläche sind erforderlich."); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/kunden/${kundeId}/schlaegte`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          flaeche: parseFloat(form.flaeche),
          fruchtart: form.fruchtart || null,
          sorte: form.sorte || null,
          vorfrucht: form.vorfrucht || null,
          aussaatJahr: form.aussaatJahr ? parseInt(form.aussaatJahr) : null,
          aussaatMenge: form.aussaatMenge ? parseFloat(form.aussaatMenge) : null,
          notiz: form.notiz || null,
        }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error ?? "Fehler"); return; }
      resetForm();
      setShowForm(false);
      fetchSchlaegte();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(schlagId: number) {
    setDeleting(schlagId);
    try {
      await fetch(`/api/kunden/${kundeId}/schlaegte?schlagId=${schlagId}`, { method: "DELETE" });
      fetchSchlaegte();
    } finally {
      setDeleting(null);
    }
  }

  const totalFlaeche = schlaegte.reduce((s, sl) => s + sl.flaeche, 0);

  return (
    <div className="space-y-4">
      {/* Wetter-Widget */}
      {lat != null && lng != null ? (
        <WetterWidget lat={lat} lng={lng} compact={false} />
      ) : (
        <p className="text-sm text-gray-400 italic">
          Für Wetterdaten bitte Adresse geocodieren (
          <a href="/einstellungen/adressen" className="underline hover:text-gray-600">/einstellungen/adressen</a>
          ).
        </p>
      )}

      <div className="flex justify-end">
        <button
          onClick={() => { setShowForm(!showForm); if (showForm) resetForm(); }}
          className="text-sm px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
        >
          {showForm ? "Abbrechen" : "+ Neuer Schlag"}
        </button>
      </div>

      {showForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold mb-3">Neuer Schlag erfassen</h3>
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2 mb-3">{error}</p>}
          <form onSubmit={handleAdd} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Name <span className="text-red-500">*</span></label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className={inputClsSchlag} placeholder="z.B. Südfeld" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Fläche (ha) <span className="text-red-500">*</span></label>
                <input type="number" step="0.01" min="0" value={form.flaeche} onChange={(e) => setForm({ ...form, flaeche: e.target.value })} required className={inputClsSchlag} placeholder="z.B. 5.5" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Fruchtart</label>
                <input type="text" list="fruchtarten-list" value={form.fruchtart} onChange={(e) => setForm({ ...form, fruchtart: e.target.value })} className={inputClsSchlag} placeholder="z.B. Winterweizen" />
                <datalist id="fruchtarten-list">
                  {fruchtarten.map((f) => <option key={f} value={f} />)}
                </datalist>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Sorte</label>
                <input type="text" value={form.sorte} onChange={(e) => setForm({ ...form, sorte: e.target.value })} className={inputClsSchlag} placeholder="Sortenname" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Vorfrucht</label>
                <input type="text" list="fruchtarten-list" value={form.vorfrucht} onChange={(e) => setForm({ ...form, vorfrucht: e.target.value })} className={inputClsSchlag} placeholder="z.B. Raps" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Aussaat-Jahr</label>
                <input type="number" min="2000" max="2100" value={form.aussaatJahr} onChange={(e) => setForm({ ...form, aussaatJahr: e.target.value })} className={inputClsSchlag} placeholder="z.B. 2024" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Aussaat-Menge (kg/ha)</label>
                <input type="number" step="0.1" min="0" value={form.aussaatMenge} onChange={(e) => setForm({ ...form, aussaatMenge: e.target.value })} className={inputClsSchlag} placeholder="z.B. 180" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notiz</label>
                <input type="text" value={form.notiz} onChange={(e) => setForm({ ...form, notiz: e.target.value })} className={inputClsSchlag} placeholder="Optionale Notiz" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => { setShowForm(false); resetForm(); }} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Abbrechen</button>
              <button type="submit" disabled={saving} className="px-4 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-60">{saving ? "…" : "Speichern"}</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">Lade Schlagkartei…</p>
      ) : schlaegte.length === 0 ? (
        <p className="text-sm text-gray-400">Noch keine Schläge erfasst.</p>
      ) : (
        <div className="overflow-x-auto bg-white rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Fläche (ha)</th>
                <th className="hidden sm:table-cell px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Fruchtart</th>
                <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Sorte</th>
                <th className="hidden lg:table-cell px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Vorfrucht</th>
                <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Aussaat-Jahr</th>
                <th className="hidden lg:table-cell px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">kg/ha</th>
                <th className="hidden lg:table-cell px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Notiz</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {schlaegte.map((sl) => (
                <tr key={sl.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-900">
                    {sl.name}
                    <div className="sm:hidden text-xs text-gray-500 mt-0.5">{sl.fruchtart ?? "—"}{sl.sorte ? ` · ${sl.sorte}` : ""}</div>
                  </td>
                  <td className="px-4 py-2.5 font-mono">{sl.flaeche.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="hidden sm:table-cell px-4 py-2.5 text-gray-600">{sl.fruchtart ?? "—"}</td>
                  <td className="hidden md:table-cell px-4 py-2.5 text-gray-600">{sl.sorte ?? "—"}</td>
                  <td className="hidden lg:table-cell px-4 py-2.5 text-gray-600">{sl.vorfrucht ?? "—"}</td>
                  <td className="hidden md:table-cell px-4 py-2.5 text-gray-600">{sl.aussaatJahr ?? "—"}</td>
                  <td className="hidden lg:table-cell px-4 py-2.5 font-mono text-gray-600">{sl.aussaatMenge != null ? sl.aussaatMenge : "—"}</td>
                  <td className="hidden lg:table-cell px-4 py-2.5 text-gray-500 max-w-[160px] truncate">{sl.notiz ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => handleDelete(sl.id)}
                      disabled={deleting === sl.id}
                      className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40 transition-colors"
                    >
                      {deleting === sl.id ? "…" : "Löschen"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 text-sm font-medium text-gray-700">
            Gesamt: {totalFlaeche.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ha ({schlaegte.length} Schlag{schlaegte.length !== 1 ? "schläge" : ""})
          </div>
        </div>
      )}
    </div>
  );
}
