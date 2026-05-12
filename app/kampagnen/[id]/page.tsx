"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SearchableSelect from "@/components/SearchableSelect";

interface KampagneArtikel {
  id: number;
  artikelId: number;
  sonderpreis: number | null;
  artikel: { id: number; name: string; artikelnummer: string | null; standardpreis: number } | null;
}

interface Kampagne {
  id: number;
  name: string;
  beschreibung: string | null;
  von: string;
  bis: string;
  rabattProzent: number | null;
  aktiv: boolean;
  artikel: KampagneArtikel[];
}

interface ArtikelOption {
  id: number;
  name: string;
  artikelnummer: string | null;
  einheit: string;
  standardpreis: number;
}

function KampagneBadge({ von, bis, aktiv }: { von: string; bis: string; aktiv: boolean }) {
  const now = new Date();
  const vonDate = new Date(von);
  const bisDate = new Date(bis);

  if (!aktiv) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">Inaktiv</span>;
  if (now > bisDate) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Abgelaufen</span>;
  if (now < vonDate) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">Zukünftig</span>;
  return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Aktiv</span>;
}

interface EditArtikel {
  artikelId: string;
  sonderpreis: string;
}

export default function KampagneDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [id, setId] = useState<string | null>(null);
  const [data, setData] = useState<Kampagne | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [allArtikel, setAllArtikel] = useState<ArtikelOption[]>([]);

  const [form, setForm] = useState({
    name: "",
    beschreibung: "",
    von: "",
    bis: "",
    rabattProzent: "",
    aktiv: true,
  });
  const [editArtikel, setEditArtikel] = useState<EditArtikel[]>([]);

  useEffect(() => {
    params.then((p) => setId(p.id));
  }, [params]);

  useEffect(() => {
    fetch("/api/artikel?limit=500")
      .then((r) => r.json())
      .then((d) => setAllArtikel(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/kampagnen/${id}`)
      .then((r) => { if (!r.ok) throw new Error("not found"); return r.json(); })
      .then((d: Kampagne) => {
        setData(d);
        setForm({
          name: d.name,
          beschreibung: d.beschreibung ?? "",
          von: d.von.slice(0, 10),
          bis: d.bis.slice(0, 10),
          rabattProzent: d.rabattProzent != null ? String(d.rabattProzent) : "",
          aktiv: d.aktiv,
        });
        setEditArtikel(d.artikel.map((a) => ({
          artikelId: String(a.artikelId),
          sonderpreis: a.sonderpreis != null ? String(a.sonderpreis) : "",
        })));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  const artikelOptions = allArtikel.map((a) => ({
    value: a.id,
    label: a.name,
    sub: [a.artikelnummer, a.einheit].filter(Boolean).join(" · "),
  }));

  function updateEditArtikel(index: number, field: keyof EditArtikel, value: string) {
    setEditArtikel((prev) => {
      const updated = [...prev];
      if (field === "artikelId") {
        const art = allArtikel.find((a) => String(a.id) === value);
        updated[index] = {
          ...updated[index],
          artikelId: value,
          sonderpreis: art ? String(art.standardpreis) : updated[index].sonderpreis,
        };
      } else {
        updated[index] = { ...updated[index], [field]: value };
      }
      return updated;
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    if (!form.name.trim()) { setError("Name ist erforderlich."); return; }
    if (!form.von || !form.bis) { setError("Gültigkeitszeitraum erforderlich."); return; }
    setSaving(true);
    setError("");
    try {
      const validArtikel = editArtikel.filter((a) => a.artikelId);
      const res = await fetch(`/api/kampagnen/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          beschreibung: form.beschreibung.trim() || null,
          von: form.von,
          bis: form.bis,
          rabattProzent: form.rabattProzent ? parseFloat(form.rabattProzent) : null,
          aktiv: form.aktiv,
          artikel: validArtikel.map((a) => ({
            artikelId: parseInt(a.artikelId, 10),
            sonderpreis: a.sonderpreis ? parseFloat(a.sonderpreis) : null,
          })),
        }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "Fehler."); return; }
      const updated: Kampagne = await res.json();
      setData(updated);
      setEditing(false);
    } catch {
      setError("Fehler beim Speichern.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!id || !confirm(`Kampagne "${data?.name}" wirklich löschen?`)) return;
    setDeleting(true);
    try {
      await fetch(`/api/kampagnen/${id}`, { method: "DELETE" });
      router.push("/kampagnen");
    } catch {
      setDeleting(false);
    }
  }

  if (loading) return <div className="container mx-auto px-4 py-8 text-gray-400">Lade…</div>;
  if (!data) return <div className="container mx-auto px-4 py-8 text-red-600">Kampagne nicht gefunden.</div>;

  if (!editing) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          <Link href="/kampagnen" className="hover:text-green-700">Kampagnen</Link>
          <span>›</span>
          <span className="text-gray-900 font-medium">{data.name}</span>
        </nav>

        <div className="flex items-start justify-between flex-wrap gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{data.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <KampagneBadge von={data.von} bis={data.bis} aktiv={data.aktiv} />
              <span className="text-sm text-gray-500">
                {new Date(data.von).toLocaleDateString("de-DE")} – {new Date(data.bis).toLocaleDateString("de-DE")}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setEditing(true)}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Bearbeiten
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {deleting ? "Löschen…" : "Löschen"}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="grid sm:grid-cols-2 gap-4">
            {data.beschreibung && (
              <div className="sm:col-span-2">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Beschreibung</p>
                <p className="text-sm text-gray-700">{data.beschreibung}</p>
              </div>
            )}
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Rabatt</p>
              <p className="text-sm text-gray-800 mt-0.5">{data.rabattProzent != null ? `${data.rabattProzent}%` : "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Artikel</p>
              <p className="text-sm text-gray-800 mt-0.5">{data.artikel.length}</p>
            </div>
          </div>
        </div>

        {data.artikel.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200">
              <h2 className="text-base font-semibold text-gray-900">Artikel</h2>
            </div>
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Artikel</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Standardpreis</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Sonderpreis</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.artikel.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      {a.artikel ? (
                        <Link href={`/artikel/${a.artikel.id}`} className="text-green-700 hover:underline">
                          {a.artikel.name}
                        </Link>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {a.artikel?.standardpreis != null
                        ? a.artikel.standardpreis.toLocaleString("de-DE", { style: "currency", currency: "EUR" })
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {a.sonderpreis != null
                        ? a.sonderpreis.toLocaleString("de-DE", { style: "currency", currency: "EUR" })
                        : "—"}
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

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8">
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/kampagnen" className="hover:text-green-700">Kampagnen</Link>
        <span>›</span>
        <span className="text-gray-900 font-medium">{data.name} — Bearbeiten</span>
      </nav>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Kampagne bearbeiten</h1>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label>
            <textarea
              value={form.beschreibung}
              onChange={(e) => setForm({ ...form, beschreibung: e.target.value })}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Von <span className="text-red-500">*</span></label>
              <input
                type="date"
                value={form.von}
                onChange={(e) => setForm({ ...form, von: e.target.value })}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bis <span className="text-red-500">*</span></label>
              <input
                type="date"
                value={form.bis}
                onChange={(e) => setForm({ ...form, bis: e.target.value })}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rabatt %</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={form.rabattProzent}
                onChange={(e) => setForm({ ...form, rabattProzent: e.target.value })}
                placeholder="optional"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">Aktiv</label>
            <button
              type="button"
              onClick={() => setForm({ ...form, aktiv: !form.aktiv })}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${form.aktiv ? "bg-green-600" : "bg-gray-300"}`}
            >
              <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${form.aktiv ? "translate-x-4" : "translate-x-0.5"}`} />
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Artikel</h2>
            <button
              type="button"
              onClick={() => setEditArtikel((prev) => [...prev, { artikelId: "", sonderpreis: "" }])}
              className="text-xs px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 rounded-lg transition-colors"
            >
              + Hinzufügen
            </button>
          </div>

          {editArtikel.length === 0 ? (
            <p className="text-sm text-gray-400">Keine Artikel zugeordnet.</p>
          ) : (
            <div className="space-y-3">
              {editArtikel.map((a, i) => (
                <div key={i} className="flex items-end gap-3 border border-gray-200 rounded-lg p-3">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Artikel</label>
                    <SearchableSelect
                      options={artikelOptions}
                      value={a.artikelId}
                      onChange={(v) => updateEditArtikel(i, "artikelId", v)}
                      placeholder="Artikel wählen…"
                    />
                  </div>
                  <div className="w-32">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Sonderpreis (€)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={a.sonderpreis}
                      onChange={(e) => updateEditArtikel(i, "sonderpreis", e.target.value)}
                      placeholder="optional"
                      className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditArtikel((prev) => prev.filter((_, idx) => idx !== i))}
                    className="text-xs text-red-500 hover:text-red-700 pb-1.5"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
          <button
            type="button"
            onClick={() => { setEditing(false); setError(""); }}
            className="w-full sm:w-auto text-center px-5 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors"
          >
            Abbrechen
          </button>
          <button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto px-5 py-2 bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Speichere…" : "Speichern"}
          </button>
        </div>
      </form>
    </div>
  );
}
