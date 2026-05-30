"use client";

import React, { useCallback, useEffect, useState } from "react";
import { inputClsSchlag } from "../_shared";

interface KundeTier {
  id: number;
  kundeId: number;
  name: string;
  tierart: string;
  nutzungsart: string;
  rasse?: string | null;
  anzahl: number;
  gewicht?: number | null;
  leistung?: number | null;
  leistungEinheit?: string | null;
  notiz?: string | null;
  erstellt: string;
}

const TIERART_NUTZUNG: Record<string, string[]> = {
  Rind: ["Milchkuh laktierend", "Milchkuh trockenstehend", "Mastrind", "Jungvieh / Aufzucht", "Mutterkuh säugend"],
  Schwein: ["Mastschwein Anfangsmast", "Mastschwein Endmast", "Zuchtsau tragend", "Zuchtsau laktierend", "Ferkel / Aufzucht"],
  Geflugel: ["Legehenne", "Masthuhn / Broiler", "Junghenne / Aufzucht"],
  Pferd: ["Warmblut Erhaltung", "Warmblut leichte Arbeit", "Warmblut mittlere Arbeit", "Warmblut schwere Arbeit", "Vollblut", "Pony", "Zuchtstute laktierend"],
  Schaf: ["Mutterschaf säugend", "Mutterschaf tragend", "Mastlamm"],
  Ziege: ["Milchziege laktierend", "Milchziege trockenstehend", "Mastziege"],
};

export default function TiereTab({ kundeId }: { kundeId: number }) {
  const [tiere, setTiere] = useState<KundeTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "", tierart: "Rind", nutzungsart: "", rasse: "",
    anzahl: "1", gewicht: "", leistung: "", leistungEinheit: "", notiz: "",
  });

  const fetchTiere = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/kunden/${kundeId}/tiere`);
    const data = await res.json();
    setTiere(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [kundeId]);

  useEffect(() => { fetchTiere(); }, [fetchTiere]);

  function resetForm() {
    setForm({ name: "", tierart: "Rind", nutzungsart: "", rasse: "", anzahl: "1", gewicht: "", leistung: "", leistungEinheit: "", notiz: "" });
    setError("");
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.nutzungsart) { setError("Name und Nutzungsart sind erforderlich."); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/kunden/${kundeId}/tiere`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          tierart: form.tierart,
          nutzungsart: form.nutzungsart,
          rasse: form.rasse || null,
          anzahl: form.anzahl ? parseInt(form.anzahl, 10) : 1,
          gewicht: form.gewicht ? parseFloat(form.gewicht) : null,
          leistung: form.leistung ? parseFloat(form.leistung) : null,
          leistungEinheit: form.leistungEinheit || null,
          notiz: form.notiz || null,
        }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error ?? "Fehler"); return; }
      resetForm();
      setShowForm(false);
      fetchTiere();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(tierId: number) {
    setDeleting(tierId);
    try {
      await fetch(`/api/kunden/${kundeId}/tiere?tierId=${tierId}`, { method: "DELETE" });
      fetchTiere();
    } finally {
      setDeleting(null);
    }
  }

  const nutzungsOptionen = TIERART_NUTZUNG[form.tierart] ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Tierbestand des Betriebs — Basis für die <a href="/rationsberechnung" className="text-green-700 underline">Rationsberechnung</a>.
        </p>
        <button
          onClick={() => { setShowForm(!showForm); if (showForm) resetForm(); }}
          className="text-sm px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
        >
          {showForm ? "Abbrechen" : "+ Tier / Tiergruppe"}
        </button>
      </div>

      {showForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold mb-3">Tier / Tiergruppe erfassen</h3>
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2 mb-3">{error}</p>}
          <form onSubmit={handleAdd} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Name <span className="text-red-500">*</span></label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className={inputClsSchlag} placeholder="z.B. Milchkuhherde Stall 1" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Rasse</label>
                <input type="text" value={form.rasse} onChange={(e) => setForm({ ...form, rasse: e.target.value })} className={inputClsSchlag} placeholder="z.B. Fleckvieh" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tierart <span className="text-red-500">*</span></label>
                <select value={form.tierart} onChange={(e) => setForm({ ...form, tierart: e.target.value, nutzungsart: "" })} className={inputClsSchlag}>
                  {Object.keys(TIERART_NUTZUNG).map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nutzungsart <span className="text-red-500">*</span></label>
                <select value={form.nutzungsart} onChange={(e) => setForm({ ...form, nutzungsart: e.target.value })} required className={inputClsSchlag}>
                  <option value="">— wählen —</option>
                  {nutzungsOptionen.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tierzahl</label>
                <input type="number" min="1" value={form.anzahl} onChange={(e) => setForm({ ...form, anzahl: e.target.value })} className={inputClsSchlag} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Ø Lebendgewicht (kg)</label>
                <input type="number" step="0.001" value={form.gewicht} onChange={(e) => setForm({ ...form, gewicht: e.target.value })} className={inputClsSchlag} placeholder="z.B. 650" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Leistung</label>
                <input type="number" step="0.001" value={form.leistung} onChange={(e) => setForm({ ...form, leistung: e.target.value })} className={inputClsSchlag} placeholder="z.B. 28" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Leistungs-Einheit</label>
                <input type="text" value={form.leistungEinheit} onChange={(e) => setForm({ ...form, leistungEinheit: e.target.value })} className={inputClsSchlag} placeholder="kg Milch/Tag" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notiz</label>
              <textarea value={form.notiz} onChange={(e) => setForm({ ...form, notiz: e.target.value })} rows={2} className={inputClsSchlag} />
            </div>
            <div className="flex justify-end">
              <button type="submit" disabled={saving} className="text-sm px-4 py-2 bg-green-700 hover:bg-green-800 text-white rounded-lg font-medium disabled:opacity-50">
                {saving ? "Speichere…" : "Speichern"}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">Lade…</p>
      ) : tiere.length === 0 ? (
        <p className="text-sm text-gray-400 italic">Noch kein Tierbestand erfasst.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Tierart</th>
                <th className="py-2 pr-3">Nutzungsart</th>
                <th className="py-2 pr-3 hidden sm:table-cell">Rasse</th>
                <th className="py-2 pr-3 text-right">Anzahl</th>
                <th className="py-2 pr-3 text-right hidden sm:table-cell">Gewicht</th>
                <th className="py-2 pr-3 text-right">Leistung</th>
                <th className="py-2 pr-3"></th>
              </tr>
            </thead>
            <tbody>
              {tiere.map((t) => (
                <tr key={t.id} className="border-b hover:bg-gray-50">
                  <td className="py-2 pr-3 font-medium">{t.name}</td>
                  <td className="py-2 pr-3">{t.tierart}</td>
                  <td className="py-2 pr-3">{t.nutzungsart}</td>
                  <td className="py-2 pr-3 hidden sm:table-cell">{t.rasse ?? "–"}</td>
                  <td className="py-2 pr-3 text-right">{t.anzahl}</td>
                  <td className="py-2 pr-3 text-right hidden sm:table-cell">{t.gewicht != null ? `${t.gewicht} kg` : "–"}</td>
                  <td className="py-2 pr-3 text-right">{t.leistung != null ? `${t.leistung}${t.leistungEinheit ? " " + t.leistungEinheit : ""}` : "–"}</td>
                  <td className="py-2 pr-3 text-right whitespace-nowrap">
                    <a href={`/rationsberechnung?kundeId=${kundeId}&tierId=${t.id}`} className="text-green-700 hover:underline mr-3">Ration berechnen</a>
                    <button onClick={() => handleDelete(t.id)} disabled={deleting === t.id} className="text-red-600 hover:underline">
                      {deleting === t.id ? "…" : "Löschen"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
