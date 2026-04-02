"use client";
import React, { useEffect, useState } from "react";
import { KpiCard } from "@/components/Card";

interface LieferantInfo {
  id: number;
  name: string;
}

interface ArtikelLieferant {
  id: number;
  artikelId: number;
  lieferantId: number;
  einkaufspreis: number;
  bevorzugt: boolean;
  updatedAt: string;
  lieferant: LieferantInfo;
}

interface KalkulationArtikel {
  id: number;
  artikelnummer: string;
  name: string;
  einheit: string;
  kategorie: string;
  einkaufspreis: number;
  verkaufspreis: number;
  marge: number;
  margePercent: number;
  lieferantenPreise: ArtikelLieferant[];
  bestesEinkaufsAngebot: number | null;
  potenzielleErsparnis: number;
}

function fmt(n: number) {
  return n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

function fmtPct(n: number) {
  return n.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
}

function fmtDate(s: string) {
  if (!s) return "–";
  return new Date(s).toLocaleDateString("de-DE");
}

function MargeBadge({ pct }: { pct: number }) {
  const color =
    pct > 20
      ? "bg-green-100 text-green-800"
      : pct >= 10
      ? "bg-yellow-100 text-yellow-800"
      : "bg-red-100 text-red-800";
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${color}`}>
      {fmtPct(pct)}
    </span>
  );
}

export default function KalkulationPage() {
  const [data, setData] = useState<KalkulationArtikel[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterNiedrigMarge, setFilterNiedrigMarge] = useState(false);
  const [filterNurMitLieferanten, setFilterNurMitLieferanten] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/kalkulation");
      const json = await res.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function uebernehmeEinkaufspreis(artikelId: number, neuerPreis: number) {
    setSavingId(artikelId);
    try {
      await fetch(`/api/artikel/${artikelId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ standardpreis: neuerPreis }),
      });
      await load();
    } finally {
      setSavingId(null);
    }
  }

  const filtered = data.filter((a) => {
    if (search && !a.name.toLowerCase().includes(search.toLowerCase()) && !a.artikelnummer.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterNiedrigMarge && a.margePercent >= 10) return false;
    if (filterNurMitLieferanten && a.lieferantenPreise.length === 0) return false;
    return true;
  });

  const artikelMitLieferanten = data.filter((a) => a.lieferantenPreise.length > 0).length;
  const avgMarge =
    data.length > 0 ? data.reduce((s, a) => s + a.margePercent, 0) / data.length : 0;
  const gesamtErsparnis = data.reduce((s, a) => s + a.potenzielleErsparnis, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap print:hidden">
        <h1 className="text-2xl font-bold">Preiskalkulation &amp; Lieferantenvergleich</h1>
        <button
          onClick={() => window.print()}
          className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-gray-300"
        >
          Drucken
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <KpiCard
          label="Artikel mit Lieferantenpreisen"
          value={artikelMitLieferanten}
          sub={`von ${data.length} Artikeln gesamt`}
          color="blue"
        />
        <KpiCard
          label="Durchschnittliche Marge"
          value={fmtPct(avgMarge)}
          color={avgMarge > 20 ? "green" : avgMarge >= 10 ? "yellow" : "red"}
        />
        <KpiCard
          label="Optimierungspotenzial"
          value={fmt(gesamtErsparnis)}
          sub="potenzielle Ersparnis gesamt"
          color={gesamtErsparnis > 0 ? "green" : "blue"}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5 print:hidden">
        <input
          type="text"
          placeholder="Suche Artikel..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-[200px] focus:outline-none focus:ring-2 focus:ring-green-700"
        />
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none border border-gray-300 rounded-lg px-3 py-2 bg-white">
          <input
            type="checkbox"
            checked={filterNiedrigMarge}
            onChange={(e) => setFilterNiedrigMarge(e.target.checked)}
            className="rounded"
          />
          Niedrige Marge (&lt;10%)
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none border border-gray-300 rounded-lg px-3 py-2 bg-white">
          <input
            type="checkbox"
            checked={filterNurMitLieferanten}
            onChange={(e) => setFilterNurMitLieferanten(e.target.checked)}
            className="rounded"
          />
          Nur mit Lieferantenpreisen
        </label>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto shadow-sm">
        {loading ? (
          <p className="p-6 text-gray-400 text-sm">Lade...</p>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-gray-400 text-sm">Keine Artikel gefunden.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {[
                  "Artikel",
                  "EK aktuell",
                  "Bestes Angebot",
                  "Potenz. Ersparnis",
                  "VK-Preis",
                  "DB",
                  "Marge %",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => {
                const expanded = expandedId === a.id;
                return (
                  <React.Fragment key={a.id}>
                    <tr
                      className={`border-b cursor-pointer transition-colors ${
                        expanded ? "bg-green-50" : "hover:bg-green-50"
                      }`}
                      onClick={() => setExpandedId(expanded ? null : a.id)}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{a.name}</div>
                        <div className="text-xs text-gray-400">{a.einheit}</div>
                      </td>
                      <td className="px-4 py-3 font-mono">{fmt(a.einkaufspreis)}</td>
                      <td className="px-4 py-3 font-mono">
                        {a.bestesEinkaufsAngebot !== null ? fmt(a.bestesEinkaufsAngebot) : "—"}
                      </td>
                      <td className="px-4 py-3 font-mono">
                        {a.potenzielleErsparnis > 0 ? (
                          <span className="text-green-700 font-semibold">
                            {fmt(a.potenzielleErsparnis)}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono">{fmt(a.verkaufspreis)}</td>
                      <td className="px-4 py-3 font-mono">{fmt(a.marge)}</td>
                      <td className="px-4 py-3">
                        <MargeBadge pct={a.margePercent} />
                      </td>
                    </tr>
                    {expanded && (
                      <tr key={`${a.id}-expanded`} className="bg-green-50 border-b">
                        <td colSpan={7} className="px-6 py-4">
                          {a.lieferantenPreise.length === 0 ? (
                            <p className="text-sm text-gray-400 italic">
                              Keine Lieferantenpreise hinterlegt.
                            </p>
                          ) : (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                                Lieferantenpreise
                              </p>
                              <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                                <thead className="bg-gray-100">
                                  <tr>
                                    {[
                                      "Lieferant",
                                      "Einkaufspreis",
                                      "Letzte Aktualisierung",
                                      "Differenz zu aktuell",
                                      "",
                                    ].map((h) => (
                                      <th
                                        key={h}
                                        className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide"
                                      >
                                        {h}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {[...a.lieferantenPreise]
                                    .sort((x, y) => x.einkaufspreis - y.einkaufspreis)
                                    .map((lp) => {
                                      const diff = lp.einkaufspreis - a.einkaufspreis;
                                      const billiger = diff < 0;
                                      return (
                                        <tr
                                          key={lp.id}
                                          className="border-t border-gray-200 hover:bg-white transition-colors"
                                        >
                                          <td className="px-3 py-2 font-medium text-gray-800">
                                            {lp.lieferant.name}
                                            {lp.bevorzugt && (
                                              <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                                                bevorzugt
                                              </span>
                                            )}
                                          </td>
                                          <td className="px-3 py-2 font-mono">
                                            {fmt(lp.einkaufspreis)}
                                          </td>
                                          <td className="px-3 py-2 text-gray-500">
                                            {fmtDate(lp.updatedAt)}
                                          </td>
                                          <td className="px-3 py-2 font-mono">
                                            {diff === 0 ? (
                                              <span className="text-gray-400">—</span>
                                            ) : billiger ? (
                                              <span className="text-green-700 font-semibold">
                                                {fmt(diff)} ✓ günstiger
                                              </span>
                                            ) : (
                                              <span className="text-red-600">{fmt(diff)}</span>
                                            )}
                                          </td>
                                          <td className="px-3 py-2 print:hidden">
                                            {billiger && (
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  uebernehmeEinkaufspreis(a.id, lp.einkaufspreis);
                                                }}
                                                disabled={savingId === a.id}
                                                className="text-xs bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white px-2.5 py-1 rounded transition-colors"
                                              >
                                                {savingId === a.id ? "Speichert..." : "Als EK übernehmen"}
                                              </button>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          body { font-size: 12px; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #ccc; padding: 4px 8px; }
          th { background: #f5f5f5; }
        }
      `}</style>
    </div>
  );
}
