"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { LagerBadge, MargeBadge } from "@/components/Badge";
import { formatEuro, formatDatum, lagerStatus } from "@/lib/utils";
import SearchableSelect from "@/components/SearchableSelect";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ArtikelLieferant {
  id: number;
  lieferantId: number;
  artikelNrBeiLieferant?: string | null;
  einkaufspreis: number;
  mindestbestellmenge?: number | null;
  lieferzeit?: number | null;
  bevorzugt: boolean;
  lieferant: { id: number; name: string };
}

interface Dokument {
  id: number;
  name: string;
  pfad: string;
  notiz?: string | null;
  createdAt: string;
}

interface Bedarf {
  id: number;
  kundeId: number;
  menge: number;
  einheit: string;
  intervall: string;
  kunde: { id: number; name: string };
}

interface Artikel {
  id: number;
  artikelnummer: string;
  name: string;
  kategorie: string;
  einheit: string;
  standardpreis: number;
  aktuellerBestand: number;
  mindestbestand: number;
  beschreibung?: string | null;
  aktiv: boolean;
  lagerort?: string | null;
  lieferanten: ArtikelLieferant[];
  dokumente: Dokument[];
  bedarfe: Bedarf[];
}

interface PreishistorieEntry {
  id: number;
  geaendertAm: string;
  alterPreis: number;
  neuerPreis: number;
}

interface Lieferant {
  id: number;
  name: string;
}

const EINHEITEN = ["kg", "t", "Sack", "Liter", "Stück"];
const KATEGORIEN = ["Futter", "Duenger", "Saatgut"];

const inputCls =
  "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700";

// ─── Component ────────────────────────────────────────────────────────────────

export default function ArtikelDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [artikel, setArtikel] = useState<Artikel | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"details" | "lieferanten" | "preishistorie" | "dokumente" | "bedarfe">("details");

  // Details edit state
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Artikel>>({});
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState("");

  // Preishistorie
  const [preishistorie, setPreishistorie] = useState<PreishistorieEntry[]>([]);
  const [loadingPreis, setLoadingPreis] = useState(false);

  // Lieferanten modal
  const [showLiefModal, setShowLiefModal] = useState(false);
  const [lieferantenList, setLieferantenList] = useState<Lieferant[]>([]);
  const [lievForm, setLievForm] = useState({
    lieferantId: "",
    artikelNrBeiLieferant: "",
    einkaufspreis: 0,
    mindestbestellmenge: 0,
    lieferzeit: 0,
    bevorzugt: false,
  });
  const [savingLief, setSavingLief] = useState(false);
  const [liefError, setLiefError] = useState("");

  // Dokumente upload
  const [uploadForm, setUploadForm] = useState({ name: "", notiz: "" });
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);

  const fetchArtikel = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/artikel/${id}`);
    if (!res.ok) { setLoading(false); return; }
    const data: Artikel = await res.json();
    setArtikel(data);
    setEditForm({
      name: data.name,
      artikelnummer: data.artikelnummer,
      kategorie: data.kategorie,
      einheit: data.einheit,
      standardpreis: data.standardpreis,
      mindestbestand: data.mindestbestand,
      beschreibung: data.beschreibung ?? "",
      aktiv: data.aktiv,
      lagerort: data.lagerort ?? "",
    });
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchArtikel(); }, [fetchArtikel]);

  useEffect(() => {
    if (tab === "preishistorie" && preishistorie.length === 0) {
      setLoadingPreis(true);
      fetch(`/api/artikel/${id}/preishistorie`)
        .then((r) => r.json())
        .then((d) => { setPreishistorie(d); setLoadingPreis(false); })
        .catch(() => setLoadingPreis(false));
    }
    if (tab === "lieferanten" && lieferantenList.length === 0) {
      fetch("/api/lieferanten")
        .then((r) => r.json())
        .then(setLieferantenList)
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // ── Details save ──────────────────────────────────────────────────────────
  async function saveDetails() {
    if (!editForm.name?.trim()) { setDetailsError("Name ist erforderlich."); return; }
    setSavingDetails(true);
    setDetailsError("");
    const res = await fetch(`/api/artikel/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...editForm,
        standardpreis: Number(editForm.standardpreis),
        mindestbestand: Number(editForm.mindestbestand),
      }),
    });
    setSavingDetails(false);
    if (res.ok) {
      setEditing(false);
      fetchArtikel();
    } else {
      const d = await res.json().catch(() => ({}));
      setDetailsError(d.error ?? "Fehler beim Speichern.");
    }
  }

  // ── Lieferant add ─────────────────────────────────────────────────────────
  async function addLieferant() {
    if (!lievForm.lieferantId) { setLiefError("Bitte einen Lieferanten wählen."); return; }
    setSavingLief(true);
    setLiefError("");
    const newEntry = {
      lieferantId: Number(lievForm.lieferantId),
      lieferantenArtNr: lievForm.artikelNrBeiLieferant || undefined,
      einkaufspreis: Number(lievForm.einkaufspreis),
      mindestbestellmenge: lievForm.mindestbestellmenge ? Number(lievForm.mindestbestellmenge) : undefined,
      lieferzeitTage: lievForm.lieferzeit ? Number(lievForm.lieferzeit) : undefined,
      bevorzugt: lievForm.bevorzugt,
    };
    const existing = (artikel?.lieferanten ?? []).map((l) => ({
      lieferantId: l.lieferantId,
      lieferantenArtNr: l.artikelNrBeiLieferant,
      einkaufspreis: l.einkaufspreis,
      mindestbestellmenge: l.mindestbestellmenge,
      lieferzeitTage: l.lieferzeit,
      bevorzugt: l.bevorzugt,
    }));
    const res = await fetch(`/api/artikel/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lieferanten: [...existing, newEntry] }),
    });
    setSavingLief(false);
    if (res.ok) {
      setShowLiefModal(false);
      setLievForm({ lieferantId: "", artikelNrBeiLieferant: "", einkaufspreis: 0, mindestbestellmenge: 0, lieferzeit: 0, bevorzugt: false });
      fetchArtikel();
    } else {
      const d = await res.json().catch(() => ({}));
      setLiefError(d.error ?? "Fehler beim Speichern.");
    }
  }

  async function toggleBevorzugt(lieferantId: number) {
    if (!artikel) return;
    const updated = artikel.lieferanten.map((l) => ({
      lieferantId: l.lieferantId,
      lieferantenArtNr: l.artikelNrBeiLieferant,
      einkaufspreis: l.einkaufspreis,
      mindestbestellmenge: l.mindestbestellmenge,
      lieferzeitTage: l.lieferzeit,
      bevorzugt: l.lieferantId === lieferantId ? !l.bevorzugt : l.bevorzugt,
    }));
    await fetch(`/api/artikel/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lieferanten: updated }),
    });
    fetchArtikel();
  }

  // ── Dokument upload ───────────────────────────────────────────────────────
  async function uploadDokument(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadFile) { setUploadError("Bitte eine Datei auswählen."); return; }
    if (!uploadForm.name.trim()) { setUploadError("Bitte einen Namen eingeben."); return; }
    setUploading(true);
    setUploadError("");
    const fd = new FormData();
    fd.append("file", uploadFile);
    fd.append("name", uploadForm.name);
    if (uploadForm.notiz) fd.append("notiz", uploadForm.notiz);
    const res = await fetch(`/api/artikel/${id}/dokumente`, { method: "POST", body: fd });
    setUploading(false);
    if (res.ok) {
      setUploadForm({ name: "", notiz: "" });
      setUploadFile(null);
      fetchArtikel();
    } else {
      const d = await res.json().catch(() => ({}));
      setUploadError(d.error ?? "Fehler beim Hochladen.");
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  function getMarge(): number | null {
    if (!artikel) return null;
    const bev = artikel.lieferanten.find((l) => l.bevorzugt) ?? artikel.lieferanten[0];
    if (!bev || !artikel.standardpreis) return null;
    return ((artikel.standardpreis - bev.einkaufspreis) / artikel.standardpreis) * 100;
  }

  if (loading) return <p className="text-gray-400 text-sm p-6">Lade Artikel…</p>;
  if (!artikel) return (
    <div className="p-6">
      <p className="text-red-600 mb-4">Artikel nicht gefunden.</p>
      <button onClick={() => router.push("/artikel")} className="text-green-700 underline text-sm">← Zurück</button>
    </div>
  );

  const status = lagerStatus(artikel.aktuellerBestand, artikel.mindestbestand);
  const marge = getMarge();

  const TABS = [
    { key: "details", label: "Details" },
    { key: "lieferanten", label: "Lieferanten" },
    { key: "preishistorie", label: "Preishistorie" },
    { key: "dokumente", label: "Dokumente" },
    { key: "bedarfe", label: "Bedarfe" },
  ] as const;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push("/artikel")}
          className="text-sm text-green-700 hover:text-green-900 mb-3 inline-flex items-center gap-1"
        >
          ← Artikel
        </button>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{artikel.name}</h1>
            <p className="text-sm text-gray-500 mt-0.5 font-mono">{artikel.artikelnummer}</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <LagerBadge status={status} />
            {marge !== null && <MargeBadge pct={Math.round(marge * 10) / 10} />}
            {!artikel.aktiv && (
              <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500 border border-gray-200">
                inaktiv
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6 gap-1 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.key
                ? "border-green-700 text-green-800"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Details ─────────────────────────────────────────────────────── */}
      {tab === "details" && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 max-w-2xl">
          {detailsError && (
            <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {detailsError}
            </div>
          )}
          {editing ? (
            <div className="space-y-4">
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Artikelnummer</label>
                <input
                  type="text"
                  value={editForm.artikelnummer ?? ""}
                  onChange={(e) => setEditForm({ ...editForm, artikelnummer: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kategorie</label>
                  <select
                    value={editForm.kategorie ?? "Futter"}
                    onChange={(e) => setEditForm({ ...editForm, kategorie: e.target.value })}
                    className={inputCls}
                  >
                    {KATEGORIEN.map((k) => (
                      <option key={k} value={k}>{k === "Duenger" ? "Dünger" : k}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Einheit</label>
                  <select
                    value={editForm.einheit ?? "kg"}
                    onChange={(e) => setEditForm({ ...editForm, einheit: e.target.value })}
                    className={inputCls}
                  >
                    {EINHEITEN.map((e) => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Standardpreis (€)</label>
                  <input
                    type="number" step="0.01" min="0"
                    value={editForm.standardpreis ?? 0}
                    onChange={(e) => setEditForm({ ...editForm, standardpreis: parseFloat(e.target.value) || 0 })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mindestbestand</label>
                  <input
                    type="number" step="0.01" min="0"
                    value={editForm.mindestbestand ?? 0}
                    onChange={(e) => setEditForm({ ...editForm, mindestbestand: parseFloat(e.target.value) || 0 })}
                    className={inputCls}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label>
                <textarea
                  rows={3}
                  value={editForm.beschreibung ?? ""}
                  onChange={(e) => setEditForm({ ...editForm, beschreibung: e.target.value })}
                  className={`${inputCls} resize-none`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Lagerort <span className="text-gray-400 text-xs">(optional, z.B. Halle 1)</span>
                </label>
                <input
                  type="text"
                  value={editForm.lagerort ?? ""}
                  onChange={(e) => setEditForm({ ...editForm, lagerort: e.target.value })}
                  placeholder="z.B. Halle 1, Außenlager, Silo A"
                  className={inputCls}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="aktiv"
                  checked={editForm.aktiv ?? true}
                  onChange={(e) => setEditForm({ ...editForm, aktiv: e.target.checked })}
                  className="rounded"
                />
                <label htmlFor="aktiv" className="text-sm text-gray-700">Aktiv</label>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setEditing(false); setDetailsError(""); }}
                  className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50"
                >
                  Abbrechen
                </button>
                <button
                  onClick={saveDetails}
                  disabled={savingDetails}
                  className="px-4 py-2 text-sm rounded-lg bg-green-800 hover:bg-green-700 text-white font-medium disabled:opacity-60"
                >
                  {savingDetails ? "Speichern…" : "Speichern"}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <dl className="divide-y divide-gray-100">
                {([
                  ["Artikelnummer", artikel.artikelnummer],
                  ["Kategorie", artikel.kategorie === "Duenger" ? "Dünger" : artikel.kategorie],
                  ["Einheit", artikel.einheit],
                  ["Standardpreis", formatEuro(artikel.standardpreis)],
                  ["Aktueller Bestand", `${artikel.aktuellerBestand} ${artikel.einheit}`],
                  ["Mindestbestand", `${artikel.mindestbestand} ${artikel.einheit}`],
                  ["Status", null],
                  ["Beschreibung", artikel.beschreibung ?? "—"],
                  ["Aktiv", artikel.aktiv ? "Ja" : "Nein"],
                ] as [string, string | null][]).map(([label, value]) => (
                  <div key={label} className="py-3 flex gap-4">
                    <dt className="w-44 flex-shrink-0 text-sm font-medium text-gray-500">{label}</dt>
                    <dd className="text-sm text-gray-900">
                      {label === "Status" ? <LagerBadge status={status} /> : value}
                    </dd>
                  </div>
                ))}
                <div className="py-3 flex gap-4">
                  <dt className="w-44 flex-shrink-0 text-sm font-medium text-gray-500">Lagerort</dt>
                  <dd className="text-sm text-gray-900">
                    {artikel.lagerort ? (
                      <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-700 border border-gray-200 rounded text-xs font-medium">
                        {artikel.lagerort}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </dd>
                </div>
                {marge !== null && (
                  <div className="py-3 flex gap-4">
                    <dt className="w-44 flex-shrink-0 text-sm font-medium text-gray-500">Marge</dt>
                    <dd><MargeBadge pct={Math.round(marge * 10) / 10} /></dd>
                  </div>
                )}
              </dl>
              <div className="mt-5 flex justify-end">
                <button
                  onClick={() => setEditing(true)}
                  className="px-4 py-2 text-sm rounded-lg bg-green-800 hover:bg-green-700 text-white font-medium"
                >
                  Bearbeiten
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Lieferanten ─────────────────────────────────────────────────── */}
      {tab === "lieferanten" && (
        <div>
          <div className="flex justify-end mb-4">
            <button
              onClick={() => { setShowLiefModal(true); setLiefError(""); }}
              className="bg-green-800 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              + Lieferant hinzufügen
            </button>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
            {artikel.lieferanten.length === 0 ? (
              <p className="p-6 text-gray-400 text-sm">Keine Lieferanten zugeordnet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {["Lieferant", "ArtNr beim Lieferant", "Einkaufspreis", "Mindestbestellmenge", "Lieferzeit (Tage)", "Bevorzugt"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {artikel.lieferanten.map((l) => (
                    <tr key={l.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{l.lieferant.name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{l.artikelNrBeiLieferant ?? "—"}</td>
                      <td className="px-4 py-3 font-mono">{formatEuro(l.einkaufspreis)}</td>
                      <td className="px-4 py-3 text-gray-600">{l.mindestbestellmenge ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-600">{l.lieferzeit ?? "—"}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleBevorzugt(l.lieferantId)}
                          title="Bevorzugt umschalten"
                          className={`w-5 h-5 rounded border flex items-center justify-center text-xs transition-colors ${
                            l.bevorzugt
                              ? "bg-green-600 border-green-600 text-white"
                              : "border-gray-300 hover:border-green-400"
                          }`}
                        >
                          {l.bevorzugt ? "✓" : ""}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {showLiefModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
                <h2 className="text-lg font-bold mb-5">Lieferant hinzufügen</h2>
                <div className="space-y-4">
                  {liefError && (
                    <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{liefError}</p>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Lieferant <span className="text-red-500">*</span>
                    </label>
                    <SearchableSelect
                      options={lieferantenList.map((l) => ({ value: l.id, label: l.name }))}
                      value={lievForm.lieferantId}
                      onChange={(v) => setLievForm({ ...lievForm, lieferantId: v })}
                      placeholder="– Lieferant wählen –"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ArtNr beim Lieferant</label>
                    <input
                      type="text"
                      value={lievForm.artikelNrBeiLieferant}
                      onChange={(e) => setLievForm({ ...lievForm, artikelNrBeiLieferant: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Einkaufspreis (€)</label>
                      <input
                        type="number" step="0.01" min="0"
                        value={lievForm.einkaufspreis}
                        onChange={(e) => setLievForm({ ...lievForm, einkaufspreis: parseFloat(e.target.value) || 0 })}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Mindestbestellmenge</label>
                      <input
                        type="number" min="0"
                        value={lievForm.mindestbestellmenge}
                        onChange={(e) => setLievForm({ ...lievForm, mindestbestellmenge: parseInt(e.target.value) || 0 })}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Lieferzeit (Tage)</label>
                      <input
                        type="number" min="0"
                        value={lievForm.lieferzeit}
                        onChange={(e) => setLievForm({ ...lievForm, lieferzeit: parseInt(e.target.value) || 0 })}
                        className={inputCls}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="bev"
                      checked={lievForm.bevorzugt}
                      onChange={(e) => setLievForm({ ...lievForm, bevorzugt: e.target.checked })}
                      className="rounded"
                    />
                    <label htmlFor="bev" className="text-sm text-gray-700">Bevorzugter Lieferant</label>
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      onClick={() => setShowLiefModal(false)}
                      className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50"
                    >
                      Abbrechen
                    </button>
                    <button
                      onClick={addLieferant}
                      disabled={savingLief}
                      className="px-4 py-2 text-sm rounded-lg bg-green-800 hover:bg-green-700 text-white font-medium disabled:opacity-60"
                    >
                      {savingLief ? "Speichern…" : "Hinzufügen"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Preishistorie ───────────────────────────────────────────────── */}
      {tab === "preishistorie" && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
          {loadingPreis ? (
            <p className="p-6 text-gray-400 text-sm">Lade Preishistorie…</p>
          ) : preishistorie.length === 0 ? (
            <p className="p-6 text-gray-400 text-sm">Keine Preisänderungen vorhanden.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {["Datum", "Alter Preis", "Neuer Preis", "Differenz"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {preishistorie.map((p) => {
                  const diff = p.neuerPreis - p.alterPreis;
                  const diffCls = diff > 0 ? "text-red-600" : diff < 0 ? "text-green-700" : "text-gray-500";
                  return (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">{formatDatum(p.geaendertAm)}</td>
                      <td className="px-4 py-3 font-mono">{formatEuro(p.alterPreis)}</td>
                      <td className="px-4 py-3 font-mono">{formatEuro(p.neuerPreis)}</td>
                      <td className={`px-4 py-3 font-mono font-medium ${diffCls}`}>
                        {diff > 0 ? "+" : ""}{formatEuro(diff)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Tab: Dokumente ───────────────────────────────────────────────────── */}
      {tab === "dokumente" && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
            {artikel.dokumente.length === 0 ? (
              <p className="p-6 text-gray-400 text-sm">Keine Dokumente vorhanden.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {["Name", "Notiz", "Datum", "Download"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {artikel.dokumente.map((d) => (
                    <tr key={d.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{d.name}</td>
                      <td className="px-4 py-3 text-gray-500">{d.notiz ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-500">{formatDatum(d.createdAt)}</td>
                      <td className="px-4 py-3">
                        <a
                          href={d.pfad}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-700 hover:text-green-900 hover:underline text-sm font-medium"
                        >
                          Download
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 max-w-lg">
            <h3 className="font-semibold text-gray-800 mb-4">Dokument hochladen</h3>
            <form onSubmit={uploadDokument} className="space-y-4">
              {uploadError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{uploadError}</p>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={uploadForm.name}
                  onChange={(e) => setUploadForm({ ...uploadForm, name: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notiz</label>
                <input
                  type="text"
                  value={uploadForm.notiz}
                  onChange={(e) => setUploadForm({ ...uploadForm, notiz: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Datei <span className="text-red-500">*</span>
                </label>
                <input
                  type="file"
                  onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                  className="w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-4 py-2 text-sm rounded-lg bg-green-800 hover:bg-green-700 text-white font-medium disabled:opacity-60"
                >
                  {uploading ? "Hochladen…" : "Hochladen"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Tab: Bedarfe ─────────────────────────────────────────────────────── */}
      {tab === "bedarfe" && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
          {artikel.bedarfe.length === 0 ? (
            <p className="p-6 text-gray-400 text-sm">Keine Bedarfe erfasst.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {["Kunde", "Menge", "Einheit", "Intervall"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {artikel.bedarfe.map((b) => (
                  <tr key={b.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{b.kunde.name}</td>
                    <td className="px-4 py-3 font-mono">{b.menge}</td>
                    <td className="px-4 py-3 text-gray-600">{b.einheit}</td>
                    <td className="px-4 py-3 text-gray-600">{b.intervall}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
