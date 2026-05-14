"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { downloadCSV } from "@/lib/csv";
import { formatEuro } from "@/lib/utils";

interface BucketRow {
  label: string;
  anzahl: number;
  summe: number;
}

interface KundeRow {
  kundeId: number;
  name: string;
  firma: string | null;
  offen: number;
  aeltesteTage: number;
}

interface Data {
  stichtag: string;
  buckets: BucketRow[];
  kunden: KundeRow[];
  summe: {
    offen: number;
    anzahl: number;
    durchschnittUeberfaelligTage: number;
  };
}

function bucketColor(label: string): string {
  if (label === "Nicht fällig") return "bg-green-500";
  if (label === "1–30 Tage") return "bg-yellow-400";
  if (label === "31–60 Tage") return "bg-orange-400";
  if (label === "61–90 Tage") return "bg-red-400";
  return "bg-red-700";
}

export default function AgingPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const laden = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/statistik/aging");
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
  }, []);

  useEffect(() => {
    laden();
  }, [laden]);

  const maxBucketSumme = data
    ? Math.max(...data.buckets.map((b) => b.summe), 1)
    : 1;

  return (
    <div className="space-y-6">
      {/* Breadcrumb + Titel */}
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <Link href="/statistik" className="hover:text-green-700">
            Statistik
          </Link>
          <span>›</span>
          <span className="text-gray-800 font-medium">Offene-Posten-Aging</span>
        </div>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Offene-Posten-Aging</h1>
            <p className="text-sm text-gray-500 mt-1">
              Stichtagsbezogen — zeigt alle offenen, unbezahlten Rechnungen zum heutigen Tag.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                data &&
                downloadCSV(
                  "aging",
                  ["Kunde", "Firma", "Offen (EUR)", "Älteste Überfälligkeit (Tage)"],
                  data.kunden.map((k) => [
                    k.name,
                    k.firma ?? "",
                    k.offen,
                    k.aeltesteTage,
                  ])
                )
              }
              disabled={!data}
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              CSV-Export
            </button>
            <Link
              href="/mahnwesen"
              className="text-sm px-3 py-2 bg-green-700 hover:bg-green-800 text-white rounded-lg font-medium transition-colors whitespace-nowrap"
            >
              Zum Mahnwesen →
            </Link>
          </div>
        </div>
      </div>

      {loading && (
        <p className="text-sm text-gray-400">Lade Daten…</p>
      )}

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {data && (
        <>
          {/* Stichtagsinfo */}
          <div className="text-xs text-gray-400">
            Stichtag:{" "}
            {new Date(data.stichtag).toLocaleDateString("de-DE", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            })}
          </div>

          {/* KPI-Karten */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Gesamt offen
              </p>
              <p className="text-2xl font-bold mt-1 text-red-600">
                {formatEuro(data.summe.offen)}
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Offene Rechnungen
              </p>
              <p className="text-2xl font-bold mt-1 text-gray-900">
                {data.summe.anzahl}
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 col-span-2 lg:col-span-1">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Ø Überfälligkeitstage
              </p>
              <p
                className={`text-2xl font-bold mt-1 ${
                  data.summe.durchschnittUeberfaelligTage > 30
                    ? "text-red-600"
                    : data.summe.durchschnittUeberfaelligTage > 0
                    ? "text-orange-500"
                    : "text-green-700"
                }`}
              >
                {data.summe.durchschnittUeberfaelligTage} Tage
              </p>
            </div>
          </div>

          {/* Bucket-Übersicht */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-3">
            <h2 className="text-sm font-semibold text-gray-700">Altersstruktur</h2>
            {data.buckets.map((b) => (
              <div key={b.label}>
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span className="font-medium">{b.label}</span>
                  <span>
                    {b.anzahl} Rechnung{b.anzahl !== 1 ? "en" : ""} ·{" "}
                    <span className="font-semibold">{formatEuro(b.summe)}</span>
                  </span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${bucketColor(b.label)}`}
                    style={{
                      width:
                        maxBucketSumme > 0
                          ? `${Math.min(100, (b.summe / maxBucketSumme) * 100)}%`
                          : "0%",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Kundentabelle */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700">
                Kunden mit offenen Posten
              </h2>
            </div>
            {data.kunden.length === 0 ? (
              <p className="p-6 text-sm text-gray-400">
                Keine offenen Rechnungen vorhanden.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Kunde
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Offen
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">
                        Älteste Überfälligkeit
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.kunden.map((k) => (
                      <tr key={k.kundeId} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5">
                          <Link
                            href={`/kunden/${k.kundeId}`}
                            className="text-green-700 hover:underline font-medium"
                          >
                            {k.firma ? `${k.firma} (${k.name})` : k.name}
                          </Link>
                          <div className="sm:hidden text-xs text-gray-400 mt-0.5">
                            {k.aeltesteTage > 0
                              ? `${k.aeltesteTage} Tage überfällig`
                              : "Nicht fällig"}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-semibold text-red-600">
                          {formatEuro(k.offen)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-600 hidden sm:table-cell">
                          {k.aeltesteTage > 0 ? (
                            <span
                              className={
                                k.aeltesteTage > 90
                                  ? "text-red-700 font-semibold"
                                  : k.aeltesteTage > 30
                                  ? "text-orange-600"
                                  : "text-yellow-700"
                              }
                            >
                              {k.aeltesteTage} Tage
                            </span>
                          ) : (
                            <span className="text-green-700">Nicht fällig</span>
                          )}
                        </td>
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
