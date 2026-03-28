"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface KundeKontakt {
  id: number;
  typ: string;
  wert: string;
  label?: string;
}

interface Kunde {
  id: number;
  name: string;
  firma?: string;
  kategorie: string;
  strasse?: string;
  plz?: string;
  ort?: string;
  land: string;
  notizen?: string;
  aktiv: boolean;
  kontakte: KundeKontakt[];
}

const KATEGORIEN = ["Landwirt", "Pferdehof", "Kleintierhalter", "Großhändler", "Sonstige"];

const defaultForm = {
  name: "",
  firma: "",
  kategorie: "Sonstige",
  strasse: "",
  plz: "",
  ort: "",
  land: "Deutschland",
  notizen: "",
};

export default function KundenPage() {
  const [kunden, setKunden] = useState<Kunde[]>([]);
  const [search, setSearch] = useState("");
  const [nurAktiv, setNurAktiv] = useState(true);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchKunden = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (nurAktiv) params.set("aktiv", "true");
    const res = await fetch(`/api/kunden?${params.toString()}`);
    const data = await res.json();
    setKunden(data);
    setLoading(false);
  }, [search, nurAktiv]);

  useEffect(() => {
    const t = setTimeout(fetchKunden, 300);
    return () => clearTimeout(t);
  }, [fetchKunden]);

  function getKontaktInfo(kontakte: KundeKontakt[]) {
    const phone = kontakte.find((k) => k.typ === "telefon" || k.typ === "mobil");
    const email = kontakte.find((k) => k.typ === "email");
    return { phone: phone?.wert, email: email?.wert };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Name ist erforderlich.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/kunden", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          firma: form.firma || undefined,
          kategorie: form.kategorie,
          strasse: form.strasse || undefined,
          plz: form.plz || undefined,
          ort: form.ort || undefined,
          land: form.land || "Deutschland",
          notizen: form.notizen || undefined,
        }),
      });
      if (!res.ok) throw new Error("Fehler beim Speichern");
      setShowModal(false);
      setForm(defaultForm);
      await fetchKunden();
    } catch {
      setError("Fehler beim Speichern. Bitte versuche es erneut.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Kunden</h1>
        <button
          onClick={() => { setShowModal(true); setForm(defaultForm); setError(""); }}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + Neuer Kunde
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          placeholder="Suche nach Name, Firma, Ort, PLZ…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm">
          <button
            onClick={() => setNurAktiv(true)}
            className={`px-4 py-2 transition-colors ${nurAktiv ? "bg-green-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
          >
            Aktiv
          </button>
          <button
            onClick={() => setNurAktiv(false)}
            className={`px-4 py-2 transition-colors border-l border-gray-300 ${!nurAktiv ? "bg-green-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
          >
            Alle
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <p className="p-6 text-gray-400 text-sm">Lade Kunden…</p>
        ) : kunden.length === 0 ? (
          <p className="p-6 text-gray-400 text-sm">Keine Kunden gefunden.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                  <th className="hidden sm:table-cell text-left px-4 py-3 font-medium text-gray-600">Firma</th>
                  <th className="hidden md:table-cell text-left px-4 py-3 font-medium text-gray-600">Kategorie</th>
                  <th className="hidden lg:table-cell text-left px-4 py-3 font-medium text-gray-600">Ort</th>
                  <th className="hidden sm:table-cell text-left px-4 py-3 font-medium text-gray-600">Kontakte</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {kunden.map((kunde) => {
                  const { phone, email } = getKontaktInfo(kunde.kontakte);
                  return (
                    <tr key={kunde.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium">
                        {kunde.name}
                        {!kunde.aktiv && (
                          <span className="ml-2 text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">inaktiv</span>
                        )}
                        <div className="sm:hidden text-xs text-gray-500 mt-0.5">{kunde.firma}</div>
                      </td>
                      <td className="hidden sm:table-cell px-4 py-3 text-gray-600">{kunde.firma ?? "—"}</td>
                      <td className="hidden md:table-cell px-4 py-3">
                        <KategorieBadge kategorie={kunde.kategorie} />
                      </td>
                      <td className="hidden lg:table-cell px-4 py-3 text-gray-600">
                        {[kunde.plz, kunde.ort].filter(Boolean).join(" ") || "—"}
                      </td>
                      <td className="hidden sm:table-cell px-4 py-3 text-gray-600 text-xs space-y-0.5">
                        {phone && <div>📞 {phone}</div>}
                        {email && <div>📧 {email}</div>}
                        {!phone && !email && <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/kunden/${kunde.id}`}
                          className="text-green-700 hover:text-green-900 hover:underline font-medium"
                        >
                          Details →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h2 className="text-lg font-semibold">Neuer Kunde</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Firma</label>
                <input
                  type="text"
                  value={form.firma}
                  onChange={(e) => setForm({ ...form, firma: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kategorie</label>
                <select
                  value={form.kategorie}
                  onChange={(e) => setForm({ ...form, kategorie: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  {KATEGORIEN.map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Straße</label>
                <input
                  type="text"
                  value={form.strasse}
                  onChange={(e) => setForm({ ...form, strasse: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">PLZ</label>
                  <input
                    type="text"
                    value={form.plz}
                    onChange={(e) => setForm({ ...form, plz: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ort</label>
                  <input
                    type="text"
                    value={form.ort}
                    onChange={(e) => setForm({ ...form, ort: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Land</label>
                <input
                  type="text"
                  value={form.land}
                  onChange={(e) => setForm({ ...form, land: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notizen</label>
                <textarea
                  value={form.notizen}
                  onChange={(e) => setForm({ ...form, notizen: e.target.value })}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-60"
                >
                  {saving ? "Speichern…" : "Kunde anlegen"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function KategorieBadge({ kategorie }: { kategorie: string }) {
  const styles: Record<string, string> = {
    Landwirt: "bg-green-100 text-green-800",
    Pferdehof: "bg-blue-100 text-blue-800",
    Kleintierhalter: "bg-orange-100 text-orange-800",
    Großhändler: "bg-purple-100 text-purple-800",
    Sonstige: "bg-gray-100 text-gray-700",
  };
  const cls = styles[kategorie] ?? "bg-gray-100 text-gray-700";
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {kategorie}
    </span>
  );
}
