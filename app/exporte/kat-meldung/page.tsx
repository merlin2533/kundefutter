"use client";
import { useState, useCallback, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import * as Sentry from "@sentry/nextjs";

interface KatMeldungZeile {
  woche: string;
  erzeugercode: string;
  haltungsform: string | null;
  gueteklasse: string;
  gewichtsklasse: string;
  mengeSortiert: number;
  mengeVerkauft: number;
}

interface VorschauResponse {
  anzahl: number;
  zeilen: KatMeldungZeile[];
  summeSortiert: number;
  summeVerkauft: number;
}

const today = new Date().toISOString().split("T")[0];
const vorEinerWoche = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];

export default function KatMeldungPage() {
  return (
    <Suspense fallback={<p className="text-gray-400 mt-8 text-sm">Lade…</p>}>
      <KatMeldungInner />
    </Suspense>
  );
}

function KatMeldungInner() {
  const searchParams = useSearchParams();
  const [von, setVon] = useState(searchParams.get("von") || vorEinerWoche);
  const [bis, setBis] = useState(searchParams.get("bis") || today);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<VorschauResponse | null>(null);

  const laden = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ von, bis });
      const res = await fetch(`/api/exporte/kat-meldung/vorschau?${params}`);
      if (!res.ok) throw new Error("Laden fehlgeschlagen");
      const json = await res.json();
      setData(json);
    } catch (err) {
      Sentry.captureException(err);
      setError("Warenströme konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [von, bis]);

  useEffect(() => {
    laden();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function downloadUrl() {
    const params = new URLSearchParams({ von, bis });
    return `/api/exporte/kat-meldung?${params}`;
  }

  return (
    <div className="max-w-5xl">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <Link href="/exporte" className="hover:text-green-700">Exporte</Link>
        <span>›</span>
        <span className="text-gray-800 font-medium">KAT-Meldung</span>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">KAT-Meldung (Warenstrom)</h1>
        <p className="text-sm text-gray-500">
          Wöchentliche Aggregation der Eier-Warenströme (sortierte und verkaufte Mengen je
          Erzeugercode/Güte-/Gewichtsklasse) für die Meldung an die KAT-Datenbank
          (datenbank.kat.eu) — Vorschau vor dem CSV-Download.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 mb-6">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Von</label>
          <input type="date" value={von} onChange={(e) => setVon(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Bis</label>
          <input type="date" value={bis} onChange={(e) => setBis(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <button onClick={laden} disabled={loading} className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg font-medium">
          {loading ? "Lädt…" : "Aktualisieren"}
        </button>
        <a href={downloadUrl()} className="px-4 py-2 text-sm bg-green-700 hover:bg-green-800 text-white rounded-lg font-medium">
          CSV herunterladen
        </a>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2 mb-4">{error}</p>}

      {data && (
        <>
          <div className="flex gap-4 mb-4 text-sm text-gray-600">
            <span>{data.anzahl} Zeilen</span>
            <span>Sortiert gesamt: {data.summeSortiert}</span>
            <span>Verkauft gesamt: {data.summeVerkauft}</span>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="text-left px-4 py-2">Woche</th>
                  <th className="text-left px-4 py-2">Erzeugercode</th>
                  <th className="text-left px-4 py-2">Haltungsform</th>
                  <th className="text-left px-4 py-2">Güte</th>
                  <th className="text-left px-4 py-2">Gewicht</th>
                  <th className="text-right px-4 py-2">Sortiert</th>
                  <th className="text-right px-4 py-2">Verkauft</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.zeilen.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-gray-400 italic">Keine Eier-Warenströme im Zeitraum.</td>
                  </tr>
                ) : (
                  data.zeilen.map((z, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2">{z.woche}</td>
                      <td className="px-4 py-2">{z.erzeugercode}</td>
                      <td className="px-4 py-2">{z.haltungsform ?? "—"}</td>
                      <td className="px-4 py-2">{z.gueteklasse}</td>
                      <td className="px-4 py-2">{z.gewichtsklasse}</td>
                      <td className="px-4 py-2 text-right">{z.mengeSortiert}</td>
                      <td className="px-4 py-2 text-right">{z.mengeVerkauft}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
