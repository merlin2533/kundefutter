"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatEuro } from "@/lib/utils";
import ZeitraumFilter from "@/components/ZeitraumFilter";
import { downloadCSV } from "@/lib/csv";

interface LieferantRow {
  lieferantId: number;
  name: string;
  anzahl: number;
  summe: number;
  offen: number;
}

interface StatusRow {
  status: string;
  anzahl: number;
  summe: number;
}

interface Data {
  lieferanten: LieferantRow[];
  nachStatus: StatusRow[];
  summe: { anzahl: number; betrag: number; offen: number };
}

const STATUS_LABEL: Record<string, string> = {
  OFFEN: "Offen",
  BEZAHLT: "Bezahlt",
  STORNIERT: "Storniert",
};

const STATUS_COLOR: Record<string, string> = {
  OFFEN: "text-amber-700 bg-amber-50",
  BEZAHLT: "text-green-700 bg-green-50",
  STORNIERT: "text-gray-500 bg-gray-100",
};

export default function StatistikLieferantenPage() {
  const now = new Date();
  const [jahr, setJahr] = useState(String(now.getFullYear()));
  const [vonMonat, setVonMonat] = useState("01");
  const [bisMonat, setBisMonat] = useState(String(now.getMonth() + 1).padStart(2, "0"));
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
      });
      const res = await fetch(`/api/statistik/lieferanten?${params}`);
      if (!res.ok) { setError("Auswertung konnte nicht geladen werden."); return; }
      setData(await res.json());
    } catch {
      setError("Netzwerkfehler beim Laden.");
    } finally {
      setLoading(false);
    }
  }, [jahr, vonMonat, bisMonat]);

  useEffect(() => { laden(); }, [laden]);

  const maxSumme = data && data.lieferanten.length > 0
    ? data.lieferanten[0].summe
    : 1;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <Link href="/statistik" className="hover:text-green-700">Statistik</Link>
          <span>›</span>
          <span className="text-gray-800 font-medium">Lieferanten</span>
        </div>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Lieferanten-Auswertung</h1>
            <p className="text-sm text-gray-500 mt-1">
              Einkaufsvolumen und Eingangsrechnungen je Lieferant im gewählten Zeitraum.
            </p>
          </div>
          <button
            onClick={() =>
              data &&
              downloadCSV(
                "statistik-lieferanten",
                ["Name", "Anzahl Rechnungen", "Summe (EUR)", "Davon offen (EUR)"],
                data.lieferanten.map((l) => [l.name, l.anzahl, l.summe, l.offen])
              )
            }
            disabled={!data}
            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            CSV-Export
          </button>
        </div>
      </div>

      <ZeitraumFilter
        jahr={jahr} setJahr={setJahr}
        vonMonat={vonMonat} setVonMonat={setVonMonat}
        bisMonat={bisMonat} setBisMonat={setBisMonat}
        showQuickButtons
        loading={loading}
      />

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {data && (
        <>
          {/* KPI-Karten */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Einkaufsvolumen gesamt</p>
              <p className="text-2xl font-bold mt-1 text-gray-900">{formatEuro(data.summe.betrag)}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Offener Betrag</p>
              <p className={`text-2xl font-bold mt-1 ${data.summe.offen > 0 ? "text-amber-600" : "text-green-700"}`}>
                {formatEuro(data.summe.offen)}
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Eingangsrechnungen</p>
              <p className="text-2xl font-bold mt-1 text-gray-900">{data.summe.anzahl}</p>
            </div>
          </div>

          {/* Status-Aufschlüsselung */}
          {data.nachStatus.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Aufschlüsselung nach Status</h2>
              <div className="flex flex-wrap gap-3">
                {data.nachStatus.map((s) => (
                  <div
                    key={s.status}
                    className={`flex flex-col items-center rounded-lg px-5 py-3 min-w-[120px] ${STATUS_COLOR[s.status] ?? "text-gray-700 bg-gray-50"}`}
                  >
                    <span className="text-lg font-bold">{s.anzahl}</span>
                    <span className="text-xs font-medium mt-0.5">{STATUS_LABEL[s.status] ?? s.status}</span>
                    <span className="text-xs mt-0.5 opacity-80">{formatEuro(s.summe)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lieferanten-Tabelle */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-700">Lieferanten nach Einkaufsvolumen</h2>
            </div>
            {data.lieferanten.length === 0 ? (
              <p className="p-6 text-sm text-gray-400">Keine Eingangsrechnungen im gewählten Zeitraum.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Lieferant</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Rechnungen</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Volumen</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Offen</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Anteil</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.lieferanten.map((l, i) => {
                      const anteilProzent = maxSumme > 0 ? (l.summe / maxSumme) * 100 : 0;
                      return (
                        <tr key={l.lieferantId} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5">
                            <span className="text-xs text-gray-400 mr-2">#{i + 1}</span>
                            <Link
                              href={`/lieferanten/${l.lieferantId}`}
                              className="text-green-700 hover:underline font-medium"
                            >
                              {l.name}
                            </Link>
                            <div className="sm:hidden text-xs text-gray-400 mt-0.5">{l.anzahl} Rechnungen</div>
                          </td>
                          <td className="px-4 py-2.5 text-right text-gray-600 hidden sm:table-cell">{l.anzahl}</td>
                          <td className="px-4 py-2.5 text-right font-mono font-semibold">{formatEuro(l.summe)}</td>
                          <td className="px-4 py-2.5 text-right font-mono hidden md:table-cell">
                            {l.offen > 0
                              ? <span className="text-amber-600">{formatEuro(l.offen)}</span>
                              : <span className="text-green-700">{formatEuro(0)}</span>}
                          </td>
                          <td className="px-4 py-2.5 hidden lg:table-cell">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-green-600 rounded-full"
                                  style={{ width: `${Math.min(100, anteilProzent)}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-500 w-10 text-right">
                                {Math.round(anteilProzent)}&nbsp;%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
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
