"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { StatusBadge, MargeBadge } from "@/components/Badge";
import { formatEuro, formatDatum } from "@/lib/utils";

interface Position {
  artikelId: number;
  artikelName: string;
  menge: number;
  verkaufspreis: number;
  einkaufspreis: number;
}

interface Lieferung {
  id: number;
  datum: string;
  kunde: { id: number; name: string; firma?: string };
  status: string;
  notiz?: string;
  positionen: {
    id: number;
    menge: number;
    verkaufspreis: number;
    einkaufspreis: number;
    artikel: { name: string };
  }[];
}

interface Kunde {
  id: number;
  name: string;
  firma?: string;
}

interface Artikel {
  id: number;
  name: string;
  einheit: string;
  standardpreis: number;
  einkaufspreis?: number;
}

interface WiederkehrendBedarf {
  bedarf: {
    id: number;
    kundeId: number;
    artikelId: number;
    menge: number;
    intervallTage: number;
    kunde: { name: string };
    artikel: { name: string; einheit: string };
  };
  letztesDatum?: string;
  naechstesDatum?: string;
  ueberfaellig: boolean;
}

interface NewPosition {
  artikelId: number | "";
  menge: number;
  verkaufspreis: number;
  einkaufspreis: number;
  chargeNr: string;
}

const today = new Date().toISOString().split("T")[0];

const emptyPosition = (): NewPosition => ({
  artikelId: "",
  menge: 1,
  verkaufspreis: 0,
  einkaufspreis: 0,
  chargeNr: "",
});

export default function LieferungenPage() {
  const [tab, setTab] = useState<"liste" | "wiederkehrend">("liste");

  // List state
  const [lieferungen, setLieferungen] = useState<Lieferung[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("alle");
  const [vonFilter, setVonFilter] = useState("");
  const [bisFilter, setBisFilter] = useState("");
  const [kundeSearch, setKundeSearch] = useState("");

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [kunden, setKunden] = useState<Kunde[]>([]);
  const [artikel, setArtikel] = useState<Artikel[]>([]);
  const [formKundeId, setFormKundeId] = useState<number | "">("");
  const [formKundeSearch, setFormKundeSearch] = useState("");
  const [formDatum, setFormDatum] = useState(today);
  const [formNotiz, setFormNotiz] = useState("");
  const [positionen, setPositionen] = useState<NewPosition[]>([emptyPosition()]);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState("");

  // Wiederkehrend state
  const [wiederkehrend, setWiederkehrend] = useState<WiederkehrendBedarf[]>([]);
  const [wLoading, setWLoading] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [wSaving, setWSaving] = useState(false);

  const fetchLieferungen = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter !== "alle") params.set("status", statusFilter);
    if (vonFilter) params.set("von", vonFilter);
    if (bisFilter) params.set("bis", bisFilter);
    if (kundeSearch) params.set("search", kundeSearch);
    const res = await fetch(`/api/lieferungen?${params}`);
    const data = await res.json();
    setLieferungen(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [statusFilter, vonFilter, bisFilter, kundeSearch]);

  useEffect(() => {
    const t = setTimeout(fetchLieferungen, 300);
    return () => clearTimeout(t);
  }, [fetchLieferungen]);

  async function fetchKundenArtikel() {
    const [kr, ar] = await Promise.all([
      fetch("/api/kunden").then((r) => r.json()),
      fetch("/api/artikel").then((r) => r.json()),
    ]);
    setKunden(Array.isArray(kr) ? kr : []);
    setArtikel(Array.isArray(ar) ? ar : []);
  }

  function openModal() {
    setShowModal(true);
    setFormKundeId("");
    setFormKundeSearch("");
    setFormDatum(today);
    setFormNotiz("");
    setPositionen([emptyPosition()]);
    setModalError("");
    fetchKundenArtikel();
  }

  function updatePosition(idx: number, field: keyof NewPosition, value: string | number) {
    const updated = positionen.map((p, i) => {
      if (i !== idx) return p;
      const next = { ...p, [field]: value };
      if (field === "artikelId") {
        const art = artikel.find((a) => a.id === Number(value));
        if (art) {
          next.verkaufspreis = art.standardpreis;
          next.einkaufspreis = art.einkaufspreis ?? 0;
        }
      }
      return next;
    });
    setPositionen(updated);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formKundeId) { setModalError("Bitte einen Kunden auswählen."); return; }
    if (positionen.some((p) => !p.artikelId)) { setModalError("Bitte alle Positionen mit einem Artikel belegen."); return; }
    setSaving(true);
    setModalError("");
    try {
      const res = await fetch("/api/lieferungen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kundeId: formKundeId,
          datum: formDatum,
          notiz: formNotiz || undefined,
          positionen: positionen.map((p) => ({
            artikelId: p.artikelId,
            menge: Number(p.menge),
            verkaufspreis: Number(p.verkaufspreis),
            einkaufspreis: Number(p.einkaufspreis),
            chargeNr: p.chargeNr || undefined,
          })),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Fehler beim Speichern");
      }
      setShowModal(false);
      await fetchLieferungen();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Fehler beim Speichern.");
    } finally {
      setSaving(false);
    }
  }

  async function fetchWiederkehrend() {
    setWLoading(true);
    const res = await fetch("/api/lieferungen/wiederkehrend?tage=30");
    const data = await res.json();
    setWiederkehrend(Array.isArray(data) ? data : []);
    setWLoading(false);
  }

  useEffect(() => {
    if (tab === "wiederkehrend") fetchWiederkehrend();
  }, [tab]);

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === wiederkehrend.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(wiederkehrend.map((w) => w.bedarf.id)));
    }
  }

  async function handleWiederkehrendAnlegen() {
    if (selected.size === 0) return;
    setWSaving(true);
    try {
      await fetch("/api/lieferungen/wiederkehrend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bedarfIds: Array.from(selected) }),
      });
      setSelected(new Set());
      await fetchWiederkehrend();
    } finally {
      setWSaving(false);
    }
  }

  function calcUmsatz(l: Lieferung) {
    return l.positionen.reduce((sum, p) => sum + p.menge * p.verkaufspreis, 0);
  }
  function calcMarge(l: Lieferung) {
    return l.positionen.reduce((sum, p) => sum + p.menge * (p.verkaufspreis - p.einkaufspreis), 0);
  }

  const filteredKunden = kunden.filter((k) =>
    formKundeSearch === "" ||
    k.name.toLowerCase().includes(formKundeSearch.toLowerCase()) ||
    (k.firma ?? "").toLowerCase().includes(formKundeSearch.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">Lieferungen</h1>
        <button
          onClick={openModal}
          className="bg-green-800 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + Neue Lieferung
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {(["liste", "wiederkehrend"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t
                ? "border-green-800 text-green-800"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "liste" ? "Lieferungen" : "Wiederkehrend"}
          </button>
        ))}
      </div>

      {tab === "liste" && (
        <>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 mb-5">
            <div className="flex gap-1 flex-wrap">
              {["alle", "geplant", "geliefert", "storniert"].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors capitalize ${
                    statusFilter === s
                      ? "bg-green-800 text-white border-green-800"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="flex gap-2 items-center flex-wrap">
              <input
                type="date"
                value={vonFilter}
                onChange={(e) => setVonFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
              />
              <span className="text-gray-500 text-sm">bis</span>
              <input
                type="date"
                value={bisFilter}
                onChange={(e) => setBisFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
              />
            </div>
            <input
              type="text"
              placeholder="Kunde suchen…"
              value={kundeSearch}
              onChange={(e) => setKundeSearch(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full sm:w-52 focus:outline-none focus:ring-2 focus:ring-green-700"
            />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto shadow-sm">
            {loading ? (
              <p className="p-6 text-gray-400 text-sm">Lade Lieferungen…</p>
            ) : lieferungen.length === 0 ? (
              <p className="p-6 text-gray-400 text-sm">Keine Lieferungen gefunden.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {[
                      { label: "Datum", cls: "" },
                      { label: "Kunde", cls: "" },
                      { label: "Positionen", cls: "hidden md:table-cell" },
                      { label: "Gesamtumsatz", cls: "hidden sm:table-cell" },
                      { label: "Gesamtmarge", cls: "hidden lg:table-cell" },
                      { label: "Status", cls: "" },
                      { label: "Aktionen", cls: "" },
                    ].map((h) => (
                      <th key={h.label} className={`px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap ${h.cls}`}>
                        {h.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lieferungen.map((l) => {
                    const umsatz = calcUmsatz(l);
                    const marge = calcMarge(l);
                    const margePct = umsatz > 0 ? (marge / umsatz) * 100 : 0;
                    return (
                      <tr key={l.id} className="border-b last:border-0 hover:bg-green-50 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">{formatDatum(l.datum)}</td>
                        <td className="px-4 py-3 font-medium">
                          {l.kunde.firma ? `${l.kunde.firma} (${l.kunde.name})` : l.kunde.name}
                          <div className="sm:hidden text-xs text-gray-500 font-mono mt-0.5">{formatEuro(umsatz)}</div>
                        </td>
                        <td className="hidden md:table-cell px-4 py-3 text-center">{l.positionen.length}</td>
                        <td className="hidden sm:table-cell px-4 py-3 font-mono whitespace-nowrap">{formatEuro(umsatz)}</td>
                        <td className="hidden lg:table-cell px-4 py-3">
                          <MargeBadge pct={margePct} />
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={l.status} />
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/lieferungen/${l.id}`}
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
            )}
          </div>
        </>
      )}

      {tab === "wiederkehrend" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">Regelmäßige Bedarfe der nächsten 30 Tage</p>
            <button
              onClick={handleWiederkehrendAnlegen}
              disabled={selected.size === 0 || wSaving}
              className="bg-green-800 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {wSaving ? "Anlegen…" : `Lieferungen anlegen (${selected.size})`}
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto shadow-sm">
            {wLoading ? (
              <p className="p-6 text-gray-400 text-sm">Lade wiederkehrende Bedarfe…</p>
            ) : wiederkehrend.length === 0 ? (
              <p className="p-6 text-gray-400 text-sm">Keine wiederkehrenden Bedarfe gefunden.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.size === wiederkehrend.length}
                        onChange={toggleAll}
                        className="rounded border-gray-300 text-green-700 focus:ring-green-700"
                      />
                    </th>
                    {["Kunde", "Artikel", "Menge", "Letztes Datum", "Nächstes Datum", "Status"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {wiederkehrend.map((w) => (
                    <tr key={w.bedarf.id} className="border-b last:border-0 hover:bg-green-50 transition-colors">
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={selected.has(w.bedarf.id)}
                          onChange={() => toggleSelect(w.bedarf.id)}
                          className="rounded border-gray-300 text-green-700 focus:ring-green-700"
                        />
                      </td>
                      <td className="px-4 py-3 font-medium">{w.bedarf.kunde.name}</td>
                      <td className="px-4 py-3">{w.bedarf.artikel.name}</td>
                      <td className="px-4 py-3">{w.bedarf.menge} {w.bedarf.artikel.einheit}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {w.letztesDatum ? formatDatum(w.letztesDatum) : "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {w.naechstesDatum ? formatDatum(w.naechstesDatum) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {w.ueberfaellig ? (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700 border border-red-200">
                            Überfällig
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700 border border-green-200">
                            Geplant
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* New Lieferung Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-8">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h2 className="text-lg font-semibold">Neue Lieferung</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-5">
              {modalError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {modalError}
                </div>
              )}

              {/* Kunde */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kunde <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Kunde suchen…"
                  value={formKundeSearch}
                  onChange={(e) => { setFormKundeSearch(e.target.value); setFormKundeId(""); }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700 mb-1"
                />
                {formKundeSearch && !formKundeId && (
                  <div className="border border-gray-200 rounded-lg overflow-hidden max-h-40 overflow-y-auto">
                    {filteredKunden.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-gray-400">Keine Kunden gefunden</p>
                    ) : (
                      filteredKunden.slice(0, 10).map((k) => (
                        <button
                          key={k.id}
                          type="button"
                          onClick={() => { setFormKundeId(k.id); setFormKundeSearch(k.firma ? `${k.firma} (${k.name})` : k.name); }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-green-50 transition-colors border-b last:border-0 border-gray-100"
                        >
                          {k.firma ? `${k.firma} – ` : ""}{k.name}
                        </button>
                      ))
                    )}
                  </div>
                )}
                {formKundeId && (
                  <p className="text-xs text-green-700 mt-1">Ausgewählt: {formKundeSearch}</p>
                )}
              </div>

              {/* Datum */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Datum</label>
                <input
                  type="date"
                  value={formDatum}
                  onChange={(e) => setFormDatum(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
                />
              </div>

              {/* Notiz */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notiz</label>
                <textarea
                  rows={2}
                  value={formNotiz}
                  onChange={(e) => setFormNotiz(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700 resize-none"
                />
              </div>

              {/* Positionen */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">Positionen</label>
                  <button
                    type="button"
                    onClick={() => setPositionen([...positionen, emptyPosition()])}
                    className="text-sm text-green-700 hover:text-green-900 font-medium"
                  >
                    + Position hinzufügen
                  </button>
                </div>
                <div className="space-y-3">
                  {positionen.map((pos, idx) => {
                    const margeEuro = pos.menge * (pos.verkaufspreis - pos.einkaufspreis);
                    const margePct = pos.verkaufspreis > 0
                      ? ((pos.verkaufspreis - pos.einkaufspreis) / pos.verkaufspreis) * 100
                      : 0;
                    return (
                      <div key={idx} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                        <div className="grid grid-cols-2 gap-2 mb-2">
                          <div className="col-span-2">
                            <label className="block text-xs text-gray-500 mb-1">Artikel</label>
                            <select
                              value={pos.artikelId}
                              onChange={(e) => updatePosition(idx, "artikelId", e.target.value)}
                              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
                            >
                              <option value="">— Artikel wählen —</option>
                              {artikel.map((a) => (
                                <option key={a.id} value={a.id}>{a.name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Menge</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={pos.menge}
                              onChange={(e) => updatePosition(idx, "menge", parseFloat(e.target.value) || 0)}
                              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Verkaufspreis (€)</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={pos.verkaufspreis}
                              onChange={(e) => updatePosition(idx, "verkaufspreis", parseFloat(e.target.value) || 0)}
                              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Einkaufspreis (€)</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={pos.einkaufspreis}
                              onChange={(e) => updatePosition(idx, "einkaufspreis", parseFloat(e.target.value) || 0)}
                              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
                            />
                          </div>
                          <div className="flex items-end gap-2">
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Marge</label>
                              <div className="flex items-center gap-1.5">
                                <MargeBadge pct={margePct} />
                                <span className="text-xs text-gray-500">({formatEuro(margeEuro)})</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        {positionen.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setPositionen(positionen.filter((_, i) => i !== idx))}
                            className="text-xs text-red-500 hover:text-red-700"
                          >
                            Position entfernen
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
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
                  className="px-4 py-2 text-sm bg-green-800 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-60"
                >
                  {saving ? "Speichern…" : "Lieferung anlegen"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
