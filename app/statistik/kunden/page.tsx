"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatEuro, formatDatum } from "@/lib/utils";

interface KundeRow {
  kundeId: number;
  name: string;
  firma: string | null;
  kategorie: string | null;
  umsatz: number;
  marge: number;
  margeProzent: number;
  anzahlLieferungen: number;
  letzteLieferung: string | null;
}

interface Data {
  kunden: KundeRow[];
  kategorien: string[];
  summe: { umsatz: number; marge: number; anzahlKunden: number };
}

const MONATE = [
  { value: "01", label: "Januar" }, { value: "02", label: "Februar" }, { value: "03", label: "März" },
  { value: "04", label: "April" }, { value: "05", label: "Mai" }, { value: "06", label: "Juni" },
  { value: "07", label: "Juli" }, { value: "08", label: "August" }, { value: "09", label: "September" },
  { value: "10", label: "Oktober" }, { value: "11", label: "November" }, { value: "12", label: "Dezember" },
];
const JAHRE = ["2024", "2025", "2026"];

type SortKey = "umsatz" | "marge" | "anzahlLieferungen";

export default function StatistikKundenPage() {
  const now = new Date();
  const [jahr, setJahr] = useState(String(now.getFullYear()));
  const [vonMonat, setVonMonat] = useState("01");
  const [bisMonat, setBisMonat] = useState(String(now.getMonth() + 1).padStart(2, "0"));
  const [kategorie, setKategorie] = useState("alle");
  const [sortKey, setSortKey] = useState<SortKey>("umsatz");
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const laden = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        von: `${jahr}-${vonMonat}`,
        bis: `${jahr}-${bisMonat}`,
        kategorie,
      });
      const res = await fetch(`/api/statistik/kunden?${params}`);
      if (!res.ok) { setError("Auswertung konnte nicht geladen werden."); return; }
      setData(await res.json());
    } catch {
      setError("Netzwerkfehler beim Laden.");
    } finally {
      setLoading(false);
    }
  }, [jahr, vonMonat, bisMonat, kategorie]);

  useEffect(() => { laden(); }, [laden]);

  const kunden = data
    ? [...data.kunden].sort((a, b) => b[sortKey] - a[sortKey])
    : [];

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <Link href="/statistik" className="hover:text-green-700">Statistik</Link>
          <span>›</span>
          <span className="text-gray-800 font-medium">Kundenauswertung</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Kundenauswertung</h1>
        <p className="text-sm text-gray-500 mt-1">Umsatz, Marge und Lieferungen je Kunde im gewählten Zeitraum.</p>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Jahr</label>
            <select value={jahr} onChange={(e) => setJahr(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
              {JAHRE.map((j) => <option key={j} value={j}>{j}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Von Monat</label>
            <select value={vonMonat} onChange={(e) => setVonMonat(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
              {MONATE.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Bis Monat</label>
            <select value={bisMonat} onChange={(e) => setBisMonat(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
              {MONATE.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Kategorie</label>
            <select value={kategorie} onChange={(e) => setKategorie(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
              <option value="alle">Alle</option>
              {(data?.kategorien ?? []).map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Sortieren nach</label>
            <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
              <option value="umsatz">Umsatz</option>
              <option value="marge">Marge</option>
              <option value="anzahlLieferungen">Lieferungen</option>
            </select>
          </div>
          {loading && <span className="text-sm text-gray-400">Lade…</span>}
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
      )}

      {data && (
        <>
          {/* KPI */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Umsatz gesamt</p>
              <p className="text-2xl font-bold mt-1 text-gray-900">{formatEuro(data.summe.umsatz)}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Rohertrag gesamt</p>
              <p className={`text-2xl font-bold mt-1 ${data.summe.marge >= 0 ? "text-green-700" : "text-red-600"}`}>{formatEuro(data.summe.marge)}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Kunden mit Umsatz</p>
              <p className="text-2xl font-bold mt-1 text-gray-900">{data.summe.anzahlKunden}</p>
            </div>
          </div>

          {/* Tabelle */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {kunden.length === 0 ? (
              <p className="p-6 text-sm text-gray-400">Keine Umsätze im gewählten Zeitraum.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Kunde</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Kategorie</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Umsatz</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Marge</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Marge %</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Lief.</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Letzte Lieferung</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {kunden.map((k, i) => (
                      <tr key={k.kundeId} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5">
                          <span className="text-xs text-gray-400 mr-2">#{i + 1}</span>
                          <Link href={`/kunden/${k.kundeId}`} className="text-green-700 hover:underline font-medium">
                            {k.firma ? `${k.firma} (${k.name})` : k.name}
                          </Link>
                          <div className="sm:hidden text-xs text-gray-400 mt-0.5">{k.kategorie ?? "—"}</div>
                        </td>
                        <td className="px-4 py-2.5 text-gray-600 hidden sm:table-cell">{k.kategorie ?? "—"}</td>
                        <td className="px-4 py-2.5 text-right font-mono font-semibold">{formatEuro(k.umsatz)}</td>
                        <td className="px-4 py-2.5 text-right font-mono hidden md:table-cell">{formatEuro(k.marge)}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-gray-600 hidden md:table-cell">{k.margeProzent.toLocaleString("de-DE")} %</td>
                        <td className="px-4 py-2.5 text-right text-gray-600">{k.anzahlLieferungen}</td>
                        <td className="px-4 py-2.5 text-right text-gray-600 hidden lg:table-cell">{k.letzteLieferung ? formatDatum(k.letzteLieferung) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
