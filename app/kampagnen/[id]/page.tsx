"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SearchableSelect from "@/components/SearchableSelect";

interface KampagneArtikel {
  id: number;
  artikelId: number;
  sonderpreis: number | null;
  artikel: { id: number; name: string; artikelnummer: string | null; standardpreis: number } | null;
}

interface KampagneKunde {
  id: number;
  kundeId: number;
  kunde: { id: number; name: string; firma: string | null; ort: string | null; kategorie: string } | null;
}

interface Kampagne {
  id: number;
  name: string;
  beschreibung: string | null;
  von: string;
  bis: string;
  rabattProzent: number | null;
  aktiv: boolean;
  zielgruppeKriterien: string | null;
  artikel: KampagneArtikel[];
  kunden: KampagneKunde[];
  _count: { kunden: number };
}

interface ArtikelOption {
  id: number;
  name: string;
  artikelnummer: string | null;
  einheit: string;
  standardpreis: number;
}

interface AlleKunde {
  id: number;
  name: string;
  firma: string | null;
  ort: string | null;
  kategorie: string;
}

interface KundePotenzial {
  id: number;
  kundeId: number;
  name: string;
  firma: string | null;
  ort: string | null;
  kategorie: string;
  telefon: string | null;
  bedarfe: { artikelId: number; artikelName: string; einheit: string; menge: number; intervallTage: number }[];
  potenzialMenge: number;
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

const KATEGORIEN = ["Landwirt", "Händler", "Genossenschaft", "Lohnunternehmer", "Sonstige"];

export default function KampagneDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [id, setId] = useState<string | null>(null);
  const [data, setData] = useState<Kampagne | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"details" | "kunden">("details");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [allArtikel, setAllArtikel] = useState<ArtikelOption[]>([]);
  const [alleKunden, setAlleKunden] = useState<AlleKunde[]>([]);

  // Potenzial tab
  const [kundePotenzial, setKundePotenzial] = useState<KundePotenzial[]>([]);
  const [loadingPotenzial, setLoadingPotenzial] = useState(false);

  const [form, setForm] = useState({
    name: "",
    beschreibung: "",
    von: "",
    bis: "",
    rabattProzent: "",
    aktiv: true,
  });
  const [editArtikel, setEditArtikel] = useState<EditArtikel[]>([]);
  const [editKunden, setEditKunden] = useState<AlleKunde[]>([]);
  const [manuellerKundeId, setManuellerKundeId] = useState("");

  // Zielgruppe criteria for edit
  const [editKriterien, setEditKriterien] = useState({ ort: "", plz: "", kategorie: "", tag: "" });
  const [suchvorschau, setSuchvorschau] = useState<AlleKunde[]>([]);
  const [loadingVorschau, setLoadingVorschau] = useState(false);

  useEffect(() => {
    params.then((p) => setId(p.id));
  }, [params]);

  useEffect(() => {
    Promise.all([
      fetch("/api/artikel?limit=500").then((r) => r.json()).catch(() => []),
      fetch("/api/kunden?aktiv=true&limit=1000&kontakte=false").then((r) => r.json()).catch(() => []),
    ]).then(([artData, kundenData]) => {
      setAllArtikel(Array.isArray(artData) ? artData : []);
      setAlleKunden(Array.isArray(kundenData) ? kundenData : []);
    });
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
        setEditKunden(d.kunden.map((kk) => kk.kunde).filter((k): k is AlleKunde => k !== null));
        // Parse existing criteria
        if (d.zielgruppeKriterien) {
          try {
            const kr = JSON.parse(d.zielgruppeKriterien);
            setEditKriterien({ ort: kr.ort ?? "", plz: kr.plz ?? "", kategorie: kr.kategorie ?? "", tag: kr.tag ?? "" });
          } catch { /* ignore */ }
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  const loadKundePotenzial = useCallback(async () => {
    if (!id) return;
    setLoadingPotenzial(true);
    try {
      const res = await fetch(`/api/kampagnen/${id}/kunden`);
      if (res.ok) {
        const d = await res.json();
        setKundePotenzial(Array.isArray(d) ? d : []);
      }
    } finally {
      setLoadingPotenzial(false);
    }
  }, [id]);

  useEffect(() => {
    if (activeTab === "kunden" && id) {
      loadKundePotenzial();
    }
  }, [activeTab, id, loadKundePotenzial]);

  const artikelOptions = allArtikel.map((a) => ({
    value: a.id,
    label: a.name,
    sub: [a.artikelnummer, a.einheit].filter(Boolean).join(" · "),
  }));

  const kundenOptions = alleKunden
    .filter((k) => !editKunden.some((s) => s.id === k.id))
    .map((k) => ({
      value: k.id,
      label: k.firma ? `${k.firma} (${k.name})` : k.name,
      sub: k.ort ?? undefined,
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

  function sucheKundenNachKriterien() {
    setLoadingVorschau(true);
    const params = new URLSearchParams({ aktiv: "true", limit: "200", kontakte: "false" });
    if (editKriterien.ort) params.set("ort", editKriterien.ort);
    if (editKriterien.plz) params.set("plz", editKriterien.plz);
    if (editKriterien.kategorie) params.set("kategorie", editKriterien.kategorie);
    if (editKriterien.tag) params.set("tag", editKriterien.tag);
    fetch(`/api/kunden?${params}`)
      .then((r) => r.ok ? r.json() : [])
      .then((data: AlleKunde[]) => {
        setSuchvorschau((Array.isArray(data) ? data : []).filter((k) => !editKunden.some((s) => s.id === k.id)));
      })
      .catch(() => setSuchvorschau([]))
      .finally(() => setLoadingVorschau(false));
  }

  function kundeAusVorschauHinzufuegen(kunde: AlleKunde) {
    setEditKunden((prev) => [...prev, kunde]);
    setSuchvorschau((prev) => prev.filter((k) => k.id !== kunde.id));
  }

  function alleVorschauHinzufuegen() {
    const neu = suchvorschau.filter((k) => !editKunden.some((s) => s.id === k.id));
    setEditKunden((prev) => [...prev, ...neu]);
    setSuchvorschau([]);
  }

  function manuellenKundeHinzufuegen(idStr: string) {
    const kId = parseInt(idStr, 10);
    if (isNaN(kId)) return;
    const kunde = alleKunden.find((k) => k.id === kId);
    if (!kunde || editKunden.some((s) => s.id === kId)) return;
    setEditKunden((prev) => [...prev, kunde]);
    setManuellerKundeId("");
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
      const kriterienObj = Object.values(editKriterien).some((v) => v)
        ? Object.fromEntries(Object.entries(editKriterien).filter(([, v]) => v))
        : null;

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
          zielgruppeKriterien: kriterienObj,
          artikel: validArtikel.map((a) => ({
            artikelId: parseInt(a.artikelId, 10),
            sonderpreis: a.sonderpreis ? parseFloat(a.sonderpreis) : null,
          })),
          kunden: editKunden.map((k) => ({ kundeId: k.id })),
        }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "Fehler."); return; }
      const updated: Kampagne = await res.json();
      setData(updated);
      setEditing(false);
      // Reload potenzial if on that tab
      if (activeTab === "kunden") loadKundePotenzial();
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

  if (loading) return <div className="p-8 text-gray-400">Lade…</div>;
  if (!data) return <div className="p-8 text-red-600">Kampagne nicht gefunden.</div>;

  if (!editing) {
    return (
      <div className="max-w-4xl">
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

        {/* Tabs */}
        <div className="flex gap-1 mb-4 border-b border-gray-200">
          <button
            onClick={() => setActiveTab("details")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "details" ? "border-green-600 text-green-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            Artikel
          </button>
          <button
            onClick={() => setActiveTab("kunden")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "kunden" ? "border-green-600 text-green-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            Kunden & Potenzial
            {data._count.kunden > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 bg-green-100 text-green-800 text-xs rounded-full">{data._count.kunden}</span>
            )}
          </button>
        </div>

        {activeTab === "details" && (
          <>
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
                {data.zielgruppeKriterien && (
                  <div className="sm:col-span-2">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Zielgruppen-Kriterien</p>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(JSON.parse(data.zielgruppeKriterien)).map(([k, v]) => (
                        <span key={k} className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
                          {k}: {String(v)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {data.artikel.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200">
                  <h2 className="text-base font-semibold text-gray-900">Aktionsartikel</h2>
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
                        <td className="px-4 py-3 text-right font-medium text-green-700">
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
          </>
        )}

        {activeTab === "kunden" && (
          <div>
            {loadingPotenzial ? (
              <p className="text-gray-400 text-sm py-8 text-center">Lade Kundendaten…</p>
            ) : kundePotenzial.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <p className="text-gray-400 text-sm mb-3">Keine Kunden dieser Kampagne zugeordnet.</p>
                <button
                  onClick={() => setEditing(true)}
                  className="text-sm text-green-700 hover:underline"
                >
                  Kunden hinzufügen →
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                  <h2 className="text-base font-semibold text-gray-900">
                    {kundePotenzial.length} Kunden — sortiert nach Potenzial
                  </h2>
                  <p className="text-xs text-gray-400">Bedarf-Mengen der Kampagnenartikel</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-100 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">Kunde</th>
                        <th className="hidden sm:table-cell text-left px-4 py-3 font-medium text-gray-600">Ort</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">Bedarfsartikel</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600">Potenzial</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">Aktionen</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {kundePotenzial.map((k) => (
                        <tr key={k.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <Link href={`/kunden/${k.kundeId}`} className="font-medium text-green-700 hover:underline">
                              {k.firma ? k.firma : k.name}
                            </Link>
                            {k.firma && <p className="text-xs text-gray-400">{k.name}</p>}
                            <div className="sm:hidden text-xs text-gray-400">{k.ort}</div>
                          </td>
                          <td className="hidden sm:table-cell px-4 py-3 text-gray-600">{k.ort ?? "—"}</td>
                          <td className="px-4 py-3">
                            {k.bedarfe.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {k.bedarfe.map((b) => (
                                  <span key={b.artikelId} className="text-xs bg-green-50 text-green-800 border border-green-200 px-1.5 py-0.5 rounded">
                                    {b.menge} {b.einheit} {b.artikelName}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">Kein Bedarf hinterlegt</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {k.potenzialMenge > 0 ? (
                              <span className="font-semibold text-green-700">{k.potenzialMenge.toLocaleString("de-DE")}</span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <Link
                                href={`/kunden/${k.kundeId}`}
                                className="text-xs text-green-700 hover:underline"
                              >
                                Profil
                              </Link>
                              <Link
                                href={`/lieferungen/neu?kundeId=${k.kundeId}`}
                                className="text-xs text-blue-600 hover:underline"
                              >
                                Auftrag
                              </Link>
                              {k.telefon && (
                                <a href={`tel:${k.telefon}`} className="text-xs text-gray-600 hover:underline">
                                  Anrufen
                                </a>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Edit mode
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8">
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/kampagnen" className="hover:text-green-700">Kampagnen</Link>
        <span>›</span>
        <span className="text-gray-900 font-medium">{data.name} — Bearbeiten</span>
      </nav>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Kampagne bearbeiten</h1>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Stammdaten */}
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

        {/* Artikel */}
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

        {/* Zielgruppe / Kunden */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-900">Zielgruppe (Kunden)</h2>

          {/* Criteria */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Ort</label>
              <input type="text" value={editKriterien.ort} onChange={(e) => setEditKriterien({ ...editKriterien, ort: e.target.value })}
                placeholder="z.B. Münster" className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">PLZ</label>
              <input type="text" value={editKriterien.plz} onChange={(e) => setEditKriterien({ ...editKriterien, plz: e.target.value })}
                placeholder="z.B. 48" className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Kategorie</label>
              <select value={editKriterien.kategorie} onChange={(e) => setEditKriterien({ ...editKriterien, kategorie: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-600">
                <option value="">Alle</option>
                {KATEGORIEN.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tag</label>
              <input type="text" value={editKriterien.tag} onChange={(e) => setEditKriterien({ ...editKriterien, tag: e.target.value })}
                placeholder="z.B. vip" className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
            </div>
            <div className="flex items-end sm:col-start-3">
              <button type="button" onClick={sucheKundenNachKriterien} disabled={loadingVorschau}
                className="w-full px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg disabled:opacity-50 transition-colors">
                {loadingVorschau ? "Suche…" : "Kunden suchen"}
              </button>
            </div>
          </div>

          {suchvorschau.length > 0 && (
            <div className="border border-blue-200 rounded-lg bg-blue-50 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-blue-800">{suchvorschau.length} Kunden gefunden</p>
                <button type="button" onClick={alleVorschauHinzufuegen}
                  className="text-xs px-2 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
                  Alle hinzufügen
                </button>
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {suchvorschau.map((k) => (
                  <div key={k.id} className="flex items-center justify-between text-xs bg-white rounded px-2 py-1 border border-blue-100">
                    <span className="text-gray-800">{k.firma ? `${k.firma} (${k.name})` : k.name} {k.ort && <span className="text-gray-400">— {k.ort}</span>}</span>
                    <button type="button" onClick={() => kundeAusVorschauHinzufuegen(k)} className="text-green-700 hover:text-green-900 font-medium ml-2 shrink-0">+</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Manual add */}
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Manuell hinzufügen</label>
              <SearchableSelect options={kundenOptions} value={manuellerKundeId} onChange={(v) => setManuellerKundeId(v)} placeholder="Kunde suchen…" />
            </div>
            <button type="button" onClick={() => manuellenKundeHinzufuegen(manuellerKundeId)} disabled={!manuellerKundeId}
              className="px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-40 transition-colors">
              +
            </button>
          </div>

          {/* Selected customers */}
          {editKunden.length > 0 ? (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <span className="text-xs font-medium text-gray-700">{editKunden.length} Kunden ausgewählt</span>
                <button type="button" onClick={() => setEditKunden([])} className="text-xs text-red-500 hover:text-red-700">Alle entfernen</button>
              </div>
              <div className="max-h-48 overflow-y-auto divide-y divide-gray-100">
                {editKunden.map((k) => (
                  <div key={k.id} className="flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50">
                    <span className="text-gray-800">{k.firma ? `${k.firma} (${k.name})` : k.name}
                      {k.ort && <span className="text-gray-400 text-xs ml-1">— {k.ort}</span>}
                    </span>
                    <button type="button" onClick={() => setEditKunden((prev) => prev.filter((x) => x.id !== k.id))}
                      className="text-red-400 hover:text-red-600 text-xs ml-2 shrink-0">✕</button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400">Noch keine Kunden ausgewählt.</p>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
        )}

        <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
          <button type="button" onClick={() => { setEditing(false); setError(""); }}
            className="w-full sm:w-auto text-center px-5 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors">
            Abbrechen
          </button>
          <button type="submit" disabled={saving}
            className="w-full sm:w-auto px-5 py-2 bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {saving ? "Speichere…" : "Speichern"}
          </button>
        </div>
      </form>
    </div>
  );
}
