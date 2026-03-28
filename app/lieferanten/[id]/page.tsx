"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { formatEuro, formatDatum } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ArtikelZuordnung {
  id: number;
  artikelNrBeiLieferant?: string | null;
  einkaufspreis: number;
  mindestbestellmenge?: number | null;
  lieferzeit?: number | null;
  artikel: { id: number; name: string; einheit: string };
}

interface Wareneingang {
  id: number;
  datum: string;
  notiz?: string | null;
  positionen: Array<{
    id: number;
    menge: number;
    einkaufspreis: number;
    artikel: { id: number; name: string; einheit: string };
  }>;
}

interface Lieferant {
  id: number;
  name: string;
  ansprechpartner?: string | null;
  email?: string | null;
  telefon?: string | null;
  strasse?: string | null;
  plz?: string | null;
  ort?: string | null;
  notizen?: string | null;
  artikelZuordnungen: ArtikelZuordnung[];
  wareneingaenge: Wareneingang[];
}

const inputCls =
  "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700";

// ─── Component ────────────────────────────────────────────────────────────────

export default function LieferantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [lieferant, setLieferant] = useState<Lieferant | null>(null);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Lieferant>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const fetchLieferant = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/lieferanten/${id}`);
    if (!res.ok) { setLoading(false); return; }
    const data: Lieferant = await res.json();
    setLieferant(data);
    setEditForm({
      name: data.name,
      ansprechpartner: data.ansprechpartner ?? "",
      email: data.email ?? "",
      telefon: data.telefon ?? "",
      strasse: data.strasse ?? "",
      plz: data.plz ?? "",
      ort: data.ort ?? "",
      notizen: data.notizen ?? "",
    });
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchLieferant(); }, [fetchLieferant]);

  async function saveDetails() {
    if (!editForm.name?.trim()) { setSaveError("Name ist erforderlich."); return; }
    setSaving(true);
    setSaveError("");
    const res = await fetch(`/api/lieferanten/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editForm.name?.trim(),
        ansprechpartner: editForm.ansprechpartner || undefined,
        email: editForm.email || undefined,
        telefon: editForm.telefon || undefined,
        strasse: editForm.strasse || undefined,
        plz: editForm.plz || undefined,
        ort: editForm.ort || undefined,
        notizen: editForm.notizen || undefined,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setEditing(false);
      fetchLieferant();
    } else {
      const d = await res.json().catch(() => ({}));
      setSaveError(d.error ?? "Fehler beim Speichern.");
    }
  }

  if (loading) return <p className="text-gray-400 text-sm p-6">Lade Lieferant…</p>;
  if (!lieferant) return (
    <div className="p-6">
      <p className="text-red-600 mb-4">Lieferant nicht gefunden.</p>
      <button onClick={() => router.push("/lieferanten")} className="text-green-700 underline text-sm">← Zurück</button>
    </div>
  );

  return (
    <div>
      {/* Back + Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push("/lieferanten")}
          className="text-sm text-green-700 hover:text-green-900 mb-3 inline-flex items-center gap-1"
        >
          ← Lieferanten
        </button>
        <h1 className="text-2xl font-bold text-gray-900">{lieferant.name}</h1>
        {lieferant.ort && (
          <p className="text-sm text-gray-500 mt-0.5">
            {[lieferant.plz, lieferant.ort].filter(Boolean).join(" ")}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Edit Form ─────────────────────────────────────────────────────── */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800">Stammdaten</h2>
              {!editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="text-sm text-green-700 hover:text-green-900 font-medium"
                >
                  Bearbeiten
                </button>
              )}
            </div>

            {saveError && (
              <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {saveError}
              </div>
            )}

            {editing ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editForm.name ?? ""}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ansprechpartner</label>
                  <input
                    type="text"
                    value={editForm.ansprechpartner ?? ""}
                    onChange={(e) => setEditForm({ ...editForm, ansprechpartner: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={editForm.email ?? ""}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
                  <input
                    type="tel"
                    value={editForm.telefon ?? ""}
                    onChange={(e) => setEditForm({ ...editForm, telefon: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Straße</label>
                  <input
                    type="text"
                    value={editForm.strasse ?? ""}
                    onChange={(e) => setEditForm({ ...editForm, strasse: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">PLZ</label>
                    <input
                      type="text"
                      value={editForm.plz ?? ""}
                      onChange={(e) => setEditForm({ ...editForm, plz: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ort</label>
                    <input
                      type="text"
                      value={editForm.ort ?? ""}
                      onChange={(e) => setEditForm({ ...editForm, ort: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notizen</label>
                  <textarea
                    rows={3}
                    value={editForm.notizen ?? ""}
                    onChange={(e) => setEditForm({ ...editForm, notizen: e.target.value })}
                    className={`${inputCls} resize-none`}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => { setEditing(false); setSaveError(""); }}
                    className="px-3 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50"
                  >
                    Abbrechen
                  </button>
                  <button
                    onClick={saveDetails}
                    disabled={saving}
                    className="px-3 py-2 text-sm rounded-lg bg-green-800 hover:bg-green-700 text-white font-medium disabled:opacity-60"
                  >
                    {saving ? "Speichern…" : "Speichern"}
                  </button>
                </div>
              </div>
            ) : (
              <dl className="space-y-3 text-sm">
                {[
                  ["Ansprechpartner", lieferant.ansprechpartner],
                  ["Email", lieferant.email],
                  ["Telefon", lieferant.telefon],
                  ["Straße", lieferant.strasse],
                  ["PLZ / Ort", [lieferant.plz, lieferant.ort].filter(Boolean).join(" ")],
                  ["Notizen", lieferant.notizen],
                ].map(([label, value]) => (
                  <div key={label as string}>
                    <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">{label}</dt>
                    <dd className="text-gray-900">
                      {label === "Email" && value ? (
                        <a href={`mailto:${value}`} className="text-green-700 hover:underline">{value}</a>
                      ) : (value || "—")}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </div>

        {/* ── Right column: Artikel + Wareneingänge ────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Artikel */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800">
                Artikelzuordnungen
                <span className="ml-2 text-xs text-gray-400 font-normal">
                  ({lieferant.artikelZuordnungen.length})
                </span>
              </h2>
            </div>
            {lieferant.artikelZuordnungen.length === 0 ? (
              <p className="p-6 text-gray-400 text-sm">Keine Artikel zugeordnet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {["Artikel", "ArtNr", "Einkaufspreis", "Mindestbestellmenge", "Lieferzeit"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {lieferant.artikelZuordnungen.map((z) => (
                      <tr key={z.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-green-700 hover:underline cursor-pointer"
                          onClick={() => router.push(`/artikel/${z.artikel.id}`)}>
                          {z.artikel.name}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">{z.artikelNrBeiLieferant ?? "—"}</td>
                        <td className="px-4 py-3 font-mono">{formatEuro(z.einkaufspreis)}</td>
                        <td className="px-4 py-3 text-gray-600">
                          {z.mindestbestellmenge ? `${z.mindestbestellmenge} ${z.artikel.einheit}` : "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {z.lieferzeit ? `${z.lieferzeit} Tage` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Wareneingänge */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800">
                Letzte Wareneingänge
                <span className="ml-2 text-xs text-gray-400 font-normal">
                  ({lieferant.wareneingaenge.length})
                </span>
              </h2>
            </div>
            {lieferant.wareneingaenge.length === 0 ? (
              <p className="p-6 text-gray-400 text-sm">Keine Wareneingänge vorhanden.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {["Datum", "Positionen", "Notiz"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {lieferant.wareneingaenge.map((w) => (
                      <tr key={w.id} className="hover:bg-gray-50 align-top">
                        <td className="px-4 py-3 whitespace-nowrap">{formatDatum(w.datum)}</td>
                        <td className="px-4 py-3">
                          <ul className="space-y-0.5">
                            {w.positionen.map((p) => (
                              <li key={p.id} className="text-gray-700">
                                {p.artikel.name}
                                <span className="text-gray-400 ml-1">
                                  {p.menge} {p.artikel.einheit} · {formatEuro(p.einkaufspreis)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </td>
                        <td className="px-4 py-3 text-gray-500">{w.notiz ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
