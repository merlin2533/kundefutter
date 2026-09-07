"use client";
import { useState, useCallback, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { formatDatum, formatEuro } from "@/lib/utils";
import * as Sentry from "@sentry/nextjs";

interface Buchung {
  datum: string;
  herkunft: string;
  belegNr: string;
  buchungstext: string;
  konto: string;
  gegenkonto: string;
  umsatz: number;
  sollHaben: string;
  steuersatz: string;
}

interface KontoSumme {
  konto: string;
  saldo: number;
}

interface VorschauResponse {
  kontenrahmen: string;
  anzahl: number;
  buchungen: Buchung[];
  summeProKonto: KontoSumme[];
}

const today = new Date().toISOString().split("T")[0];
const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  .toISOString()
  .split("T")[0];

export default function DatevVorschauPage() {
  return (
    <Suspense fallback={<p className="text-gray-400 mt-8 text-sm">Lade…</p>}>
      <DatevVorschauInner />
    </Suspense>
  );
}

function DatevVorschauInner() {
  const searchParams = useSearchParams();
  const [von, setVon] = useState(searchParams.get("von") || firstOfMonth);
  const [bis, setBis] = useState(searchParams.get("bis") || today);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<VorschauResponse | null>(null);

  const laden = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ von, bis });
      const res = await fetch(`/api/exporte/datev/vorschau?${params}`);
      if (!res.ok) throw new Error("Laden fehlgeschlagen");
      const json = await res.json();
      setData(json);
    } catch (err) {
      Sentry.captureException(err);
      setError("Buchungen konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [von, bis]);

  // Direktaufruf mit von/bis in der URL (Link von /exporte) lädt sofort
  useEffect(() => {
    if (searchParams.get("von") || searchParams.get("bis")) {
      laden();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function downloadUrl() {
    const params = new URLSearchParams({ von, bis });
    return `/api/exporte/datev?${params}`;
  }

  return (
    <div className="max-w-5xl">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <Link href="/exporte" className="hover:text-green-700">
          Exporte
        </Link>
        <span>›</span>
        <span className="text-gray-800 font-medium">DATEV-Buchungen</span>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">DATEV-Buchungen ansehen</h1>
        <p className="text-sm text-gray-500">
          Vorschau der Buchungszeilen (Konto, Gegenkonto, Betrag), die ein DATEV-Export für den
          gewählten Zeitraum erzeugen würde — zur Kontrolle, bevor die Datei tatsächlich
          heruntergeladen bzw. an den Steuerberater übergeben wird.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6">
        <div className="flex gap-3 flex-wrap items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Von</label>
            <input
              type="date"
              value={von}
              onChange={(e) => setVon(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Bis</label>
            <input
              type="date"
              value={bis}
              onChange={(e) => setBis(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
            />
          </div>
          <button
            onClick={laden}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium bg-green-800 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-60"
          >
            {loading ? "Lade…" : "Buchungen anzeigen"}
          </button>
          {data && (
            <a
              href={downloadUrl()}
              className="px-4 py-2 text-sm font-medium bg-white border border-green-300 text-green-700 hover:bg-green-50 rounded-lg transition-colors"
            >
              Als CSV exportieren
            </a>
          )}
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>

      {data && (
        <>
          <p className="text-sm text-gray-500 mb-3">
            {data.anzahl} Buchungszeile{data.anzahl === 1 ? "" : "n"} im Zeitraum {formatDatum(von)}–
            {formatDatum(bis)} · Kontenrahmen {data.kontenrahmen}
          </p>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                  <tr>
                    <th className="text-left px-3 py-2">Datum</th>
                    <th className="text-left px-3 py-2">Herkunft</th>
                    <th className="text-left px-3 py-2">Beleg</th>
                    <th className="text-left px-3 py-2">Buchungstext</th>
                    <th className="text-left px-3 py-2">Konto</th>
                    <th className="text-left px-3 py-2">Gegenkonto</th>
                    <th className="text-right px-3 py-2">Betrag</th>
                    <th className="text-center px-3 py-2">S/H</th>
                    <th className="text-right px-3 py-2">MwSt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.buchungen.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-3 py-6 text-center text-gray-400">
                        Keine Buchungen im gewählten Zeitraum.
                      </td>
                    </tr>
                  )}
                  {data.buchungen.map((b, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-3 py-2 whitespace-nowrap">{formatDatum(b.datum)}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-gray-500">{b.herkunft}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{b.belegNr}</td>
                      <td className="px-3 py-2">{b.buchungstext}</td>
                      <td className="px-3 py-2 whitespace-nowrap font-mono">{b.konto}</td>
                      <td className="px-3 py-2 whitespace-nowrap font-mono">{b.gegenkonto}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-right">{formatEuro(b.umsatz)}</td>
                      <td className="px-3 py-2 text-center">{b.sollHaben}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-right text-gray-500">{b.steuersatz} %</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {data.summeProKonto.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Saldo je Konto</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-gray-500 text-xs uppercase">
                    <tr>
                      <th className="text-left px-3 py-1">Konto</th>
                      <th className="text-right px-3 py-1">Saldo (Soll − Haben)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.summeProKonto.map((k) => (
                      <tr key={k.konto}>
                        <td className="px-3 py-1.5 font-mono">{k.konto}</td>
                        <td className={`px-3 py-1.5 text-right ${k.saldo < 0 ? "text-red-600" : "text-gray-800"}`}>
                          {formatEuro(k.saldo)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
