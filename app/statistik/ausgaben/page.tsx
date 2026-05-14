"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatEuro } from "@/lib/utils";
import ZeitraumFilter from "@/components/ZeitraumFilter";
import { downloadCSV } from "@/lib/csv";

interface KategorieRow {
  kategorie: string;
  netto: number;
  brutto: number;
  anteilProzent: number;
}

interface MonatRow {
  monat: string;
  brutto: number;
}

interface Data {
  nachKategorie: KategorieRow[];
  nachMonat: MonatRow[];
  summe: {
    netto: number;
    brutto: number;
    anzahl: number;
  };
}

export default function StatistikAusgabenPage() {
  const now = new Date();
  const [jahr, setJahr] = useState(String(now.getFullYear()));
  const [vonMonat, setVonMonat] = useState("01");
  const [bisMonat, setBisMonat] = useState(
    String(now.getMonth() + 1).padStart(2, "0")
  );
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
      const res = await fetch(`/api/statistik/ausgaben?${params}`);
      if (!res.ok) {
        setError("Auswertung konnte nicht geladen werden.");
        return;
      }
      setData(await res.json());
    } catch {
      setError("Netzwerkfehler beim Laden.");
    } finally {
      setLoading(false);
    }
  }, [jahr, vonMonat, bisMonat]);

  useEffect(() => {
    laden();
  }, [laden]);

  const maxMonatBrutto = data
    ? Math.max(...data.nachMonat.map((m) => m.brutto), 1)
    : 1;

  function monatLabel(ym: string): string {
    const [y, m] = ym.split("-");
    const d = new Date(Number(y), Number(m) - 1, 1);
    return d.toLocaleDateString("de-DE", { month: "short", year: "2-digit" });
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb + Titel */}
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <Link href="/statistik" className="hover:text-green-700">
            Statistik
          </Link>
          <span>›</span>
          <span className="text-gray-800 font-medium">Ausgaben</span>
        </div>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Ausgaben-Auswertung</h1>
            <p className="text-sm text-gray-500 mt-1">
              Betriebsausgaben nach Kategorie und Monat im gewählten Zeitraum.
            </p>
          </div>
          <button
            onClick={() =>
              data &&
              downloadCSV(
                "statistik-ausgaben",
                ["Kategorie", "Netto (EUR)", "Brutto (EUR)", "Anteil (%)"],
                data.nachKategorie.map((k) => [
                  k.kategorie,
                  k.netto,
                  k.brutto,
                  k.anteilProzent,
                ])
              )
            }
            disabled={!data}
            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            CSV-Export
          </button>
        </div>
      </div>

      {/* Filter */}
      <ZeitraumFilter
        jahr={jahr}
        setJahr={setJahr}
        vonMonat={vonMonat}
        setVonMonat={setVonMonat}
        bisMonat={bisMonat}
        setBisMonat={setBisMonat}
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
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Summe Brutto
              </p>
              <p className="text-2xl font-bold mt-1 text-gray-900">
                {formatEuro(data.summe.brutto)}
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Summe Netto
              </p>
              <p className="text-2xl font-bold mt-1 text-gray-600">
                {formatEuro(data.summe.netto)}
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 col-span-2 lg:col-span-1">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Anzahl Belege
              </p>
              <p className="text-2xl font-bold mt-1 text-gray-900">
                {data.summe.anzahl}
              </p>
            </div>
          </div>

          {/* Ausgaben nach Kategorie */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-3">
            <h2 className="text-sm font-semibold text-gray-700">
              Ausgaben nach Kategorie
            </h2>
            {data.nachKategorie.length === 0 ? (
              <p className="text-sm text-gray-400">
                Keine Ausgaben im gewählten Zeitraum.
              </p>
            ) : (
              data.nachKategorie.map((k) => (
                <div key={k.kategorie}>
                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                    <span className="font-medium">{k.kategorie}</span>
                    <span>
                      {k.anteilProzent.toLocaleString("de-DE", {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1,
                      })}{" "}
                      % ·{" "}
                      <span className="font-semibold">
                        {formatEuro(k.brutto)}
                      </span>
                    </span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-green-600"
                      style={{ width: `${Math.min(100, k.anteilProzent)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Ausgaben je Monat als Balken */}
          {data.nachMonat.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">
                Ausgaben je Monat (Brutto)
              </h2>
              <div className="flex items-end gap-2 h-32 overflow-x-auto">
                {data.nachMonat.map((m) => (
                  <div
                    key={m.monat}
                    className="flex flex-col items-center gap-1 flex-shrink-0"
                    title={`${m.monat}: ${formatEuro(m.brutto)}`}
                  >
                    <div
                      className="w-8 bg-green-500 rounded-t"
                      style={{
                        height: `${Math.max(4, (m.brutto / maxMonatBrutto) * 112)}px`,
                      }}
                    />
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      {monatLabel(m.monat)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tabelle nach Kategorie */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700">
                Detailübersicht nach Kategorie
              </h2>
            </div>
            {data.nachKategorie.length === 0 ? (
              <p className="p-6 text-sm text-gray-400">
                Keine Ausgaben im gewählten Zeitraum.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Kategorie
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Brutto
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">
                        Netto
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">
                        Anteil
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.nachKategorie.map((k) => (
                      <tr key={k.kategorie} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium text-gray-800">
                          {k.kategorie}
                          <div className="sm:hidden text-xs text-gray-400 mt-0.5">
                            Netto: {formatEuro(k.netto)}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-semibold">
                          {formatEuro(k.brutto)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-gray-600 hidden sm:table-cell">
                          {formatEuro(k.netto)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-600 hidden md:table-cell">
                          {k.anteilProzent.toLocaleString("de-DE", {
                            minimumFractionDigits: 1,
                            maximumFractionDigits: 1,
                          })}{" "}
                          %
                        </td>
                      </tr>
                    ))}
                    {/* Summenzeile */}
                    <tr className="bg-gray-50 font-semibold border-t-2 border-gray-200">
                      <td className="px-4 py-2.5 text-gray-900">Gesamt</td>
                      <td className="px-4 py-2.5 text-right font-mono">
                        {formatEuro(data.summe.brutto)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-gray-600 hidden sm:table-cell">
                        {formatEuro(data.summe.netto)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-600 hidden md:table-cell">
                        100,0 %
                      </td>
                    </tr>
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
