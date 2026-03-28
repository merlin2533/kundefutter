"use client";
import { useEffect, useState, useCallback } from "react";
import { formatEuro } from "@/lib/utils";
import SearchableSelect from "@/components/SearchableSelect";

interface Artikel {
  id: number;
  name: string;
  artikelnummer: string;
  kategorie: string;
}

interface Kunde {
  id: number;
  name: string;
  firma?: string;
}

interface Mengenrabatt {
  id: number;
  kundeId: number | null;
  artikelId: number | null;
  kategorie: string | null;
  vonMenge: number;
  rabattProzent: number;
  aktiv: boolean;
  artikel: { id: number; name: string; artikelnummer: string; kategorie: string } | null;
  kunde: { id: number; name: string; firma?: string } | null;
}

const ARTIKEL_KATEGORIEN = ["Futter", "Duenger", "Saatgut"];

export default function MengenrabattePage() {
  const [rabatte, setRabatte] = useState<Mengenrabatt[]>([]);
  const [artikel, setArtikel] = useState<Artikel[]>([]);
  const [kunden, setKunden] = useState<Kunde[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<"artikel" | "kategorie">("artikel");
  const [formArtikelId, setFormArtikelId] = useState("");
  const [formKategorie, setFormKategorie] = useState(ARTIKEL_KATEGORIEN[0]);
  const [formKundeId, setFormKundeId] = useState("");
  const [formVonMenge, setFormVonMenge] = useState("");
  const [formRabattProzent, setFormRabattProzent] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchRabatte = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/mengenrabatte");
    const data = await res.json();
    setRabatte(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRabatte();
    fetch("/api/artikel?aktiv=true")
      .then((r) => r.json())
      .then((d) => setArtikel(Array.isArray(d) ? d : []));
    fetch("/api/kunden")
      .then((r) => r.json())
      .then((d) => setKunden(Array.isArray(d) ? d : []));
  }, [fetchRabatte]);

  async function handleDelete(id: number) {
    setDeleting(id);
    try {
      await fetch(`/api/mengenrabatte?id=${id}`, { method: "DELETE" });
      await fetchRabatte();
    } finally {
      setDeleting(null);
    }
  }

  function openForm() {
    setFormMode("artikel");
    setFormArtikelId("");
    setFormKategorie(ARTIKEL_KATEGORIEN[0]);
    setFormKundeId("");
    setFormVonMenge("");
    setFormRabattProzent("");
    setFormError("");
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!formVonMenge || !formRabattProzent) {
      setFormError("Bitte Ab-Menge und Rabatt % angeben.");
      return;
    }
    if (formMode === "artikel" && !formArtikelId) {
      setFormError("Bitte einen Artikel wählen.");
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        vonMenge: Number(formVonMenge),
        rabattProzent: Number(formRabattProzent),
      };
      if (formKundeId) body.kundeId = Number(formKundeId);
      if (formMode === "artikel") {
        body.artikelId = Number(formArtikelId);
      } else {
        body.kategorie = formKategorie;
      }
      const res = await fetch("/api/mengenrabatte", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Fehler beim Speichern");
      }
      setShowForm(false);
      await fetchRabatte();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  }

  function beschreibung(r: Mengenrabatt): string {
    if (r.artikel) return `${r.artikel.name} (${r.artikel.artikelnummer})`;
    if (r.kategorie) return `Kategorie: ${r.kategorie}`;
    return "—";
  }

  function kundeLabel(r: Mengenrabatt): string {
    if (!r.kunde) return "Alle Kunden";
    return r.kunde.firma ? `${r.kunde.firma} (${r.kunde.name})` : r.kunde.name;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Mengenrabatte</h1>
        <button
          onClick={openForm}
          className="bg-green-800 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + Rabatt hinzufügen
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto shadow-sm">
        {loading ? (
          <p className="p-6 text-gray-400 text-sm">Lade Mengenrabatte…</p>
        ) : rabatte.length === 0 ? (
          <p className="p-6 text-gray-400 text-sm">Keine Mengenrabatte erfasst.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Artikel / Kategorie", "Kunde", "Ab Menge", "Rabatt %", "Status", ""].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rabatte.map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-green-50 transition-colors">
                  <td className="px-4 py-3 font-medium">{beschreibung(r)}</td>
                  <td className="px-4 py-3 text-gray-600">{kundeLabel(r)}</td>
                  <td className="px-4 py-3 font-mono">{r.vonMenge}</td>
                  <td className="px-4 py-3 font-mono font-semibold text-green-700">{r.rabattProzent}%</td>
                  <td className="px-4 py-3">
                    {r.aktiv ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Aktiv</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Inaktiv</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(r.id)}
                      disabled={deleting === r.id}
                      className="text-red-500 hover:text-red-700 text-xs font-medium disabled:opacity-50"
                    >
                      {deleting === r.id ? "…" : "Löschen"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl my-8">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h2 className="text-lg font-semibold">Neuer Mengenrabatt</h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {formError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {formError}
                </div>
              )}

              {/* Mode selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Gilt für</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFormMode("artikel")}
                    className={`flex-1 py-2 text-sm rounded-lg border transition-colors font-medium ${
                      formMode === "artikel"
                        ? "bg-green-700 text-white border-green-700"
                        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    Bestimmten Artikel
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormMode("kategorie")}
                    className={`flex-1 py-2 text-sm rounded-lg border transition-colors font-medium ${
                      formMode === "kategorie"
                        ? "bg-green-700 text-white border-green-700"
                        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    Artikelkategorie
                  </button>
                </div>
              </div>

              {/* Artikel or Kategorie */}
              {formMode === "artikel" ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Artikel <span className="text-red-500">*</span>
                  </label>
                  <SearchableSelect
                    options={artikel.map((a) => ({ value: a.id, label: a.name, sub: `${a.artikelnummer} · ${a.kategorie}` }))}
                    value={formArtikelId}
                    onChange={setFormArtikelId}
                    placeholder="— Artikel wählen —"
                    required
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Kategorie <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formKategorie}
                    onChange={(e) => setFormKategorie(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
                  >
                    {ARTIKEL_KATEGORIEN.map((k) => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Kunde */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kunde <span className="text-gray-400 text-xs font-normal">(leer = gilt für alle Kunden)</span>
                </label>
                <SearchableSelect
                  options={kunden.map((k) => ({ value: k.id, label: k.firma ? `${k.firma} – ${k.name}` : k.name }))}
                  value={formKundeId}
                  onChange={setFormKundeId}
                  placeholder="— Alle Kunden —"
                  allowClear
                  clearLabel="— Alle Kunden —"
                />
              </div>

              {/* Von Menge + Rabatt */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ab Menge <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formVonMenge}
                    onChange={(e) => setFormVonMenge(e.target.value)}
                    placeholder="z.B. 100"
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rabatt % <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={formRabattProzent}
                    onChange={(e) => setFormRabattProzent(e.target.value)}
                    placeholder="z.B. 5"
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm bg-green-800 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-60"
                >
                  {saving ? "Speichern…" : "Rabatt anlegen"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
