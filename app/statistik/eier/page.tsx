"use client";
import { useCallback, useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { KpiCard } from "@/components/Card";
import * as Sentry from "@sentry/nextjs";

interface Verteilung { key: string; mengeSortiert: number; mengeVerkauft: number }
interface TopErzeuger { erzeugercode: string; haltungsform: string | null; mengeSortiert: number; mengeVerkauft: number }
interface EierStatistik {
  gueteklassen: Verteilung[];
  gewichtsklassen: Verteilung[];
  topErzeuger: TopErzeuger[];
  summeSortiert: number;
  summeVerkauft: number;
}

const heute = new Date().toISOString().split("T")[0];
const vorDreiMonaten = new Date(new Date().setMonth(new Date().getMonth() - 3)).toISOString().split("T")[0];

function BalkenZeile({ label, wert, max, farbe }: { label: string; wert: number; max: number; farbe: string }) {
  const breite = max > 0 ? Math.max((wert / max) * 100, wert > 0 ? 2 : 0) : 0;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-14 shrink-0 text-gray-600 font-medium">{label}</span>
      <div className="flex-1 bg-gray-100 rounded h-5 overflow-hidden">
        <div className={`h-full rounded ${farbe}`} style={{ width: `${breite}%` }} />
      </div>
      <span className="w-16 shrink-0 text-right text-gray-700 tabular-nums">{wert}</span>
    </div>
  );
}

export default function EierStatistikPage() {
  return (
    <Suspense fallback={<p className="text-gray-400 mt-8 text-sm">Lade…</p>}>
      <EierStatistikInner />
    </Suspense>
  );
}

function EierStatistikInner() {
  const searchParams = useSearchParams();
  const [von, setVon] = useState(searchParams.get("von") || vorDreiMonaten);
  const [bis, setBis] = useState(searchParams.get("bis") || heute);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<EierStatistik | null>(null);

  const laden = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ von, bis });
      const res = await fetch(`/api/statistik/eier?${params}`);
      if (!res.ok) throw new Error("Laden fehlgeschlagen");
      setData(await res.json());
    } catch (err) {
      Sentry.captureException(err);
      setError("Eier-Statistik konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [von, bis]);

  useEffect(() => {
    laden();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const maxGuete = data ? Math.max(...data.gueteklassen.map((g) => g.mengeSortiert + g.mengeVerkauft), 1) : 1;
  const maxGewicht = data ? Math.max(...data.gewichtsklassen.map((g) => g.mengeSortiert + g.mengeVerkauft), 1) : 1;

  return (
    <div className="max-w-5xl">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <Link href="/statistik" className="hover:text-green-700">Statistik</Link>
        <span>›</span>
        <span className="text-gray-800 font-medium">Eier-Berichte</span>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">🥚 Eier-Berichte</h1>
        <p className="text-sm text-gray-500">
          Güte-/Gewichtsklassen-Verteilung und Top-Erzeuger im gewählten Zeitraum — nutzt dieselbe
          Aggregation wie die KAT-Meldung (sortierte und verkaufte Mengen).
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
        <Link href="/exporte/kat-meldung" className="px-4 py-2 text-sm bg-white border border-gray-300 hover:bg-gray-50 rounded-lg font-medium">
          → KAT-Meldung / CSV
        </Link>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2 mb-4">{error}</p>}

      {data && (
        <>
          <div className="grid sm:grid-cols-2 gap-3 mb-8">
            <KpiCard label="Sortiert gesamt" value={data.summeSortiert} color="blue" />
            <KpiCard label="Verkauft gesamt" value={data.summeVerkauft} color="green" />
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <h2 className="font-semibold mb-3">Güteklasse A/B</h2>
              {data.gueteklassen.length === 0 ? (
                <p className="text-sm text-gray-400 italic">Keine Daten im Zeitraum.</p>
              ) : (
                <div className="space-y-2">
                  {data.gueteklassen.map((g) => (
                    <BalkenZeile key={g.key} label={g.key} wert={g.mengeSortiert} max={maxGuete} farbe="bg-green-600" />
                  ))}
                </div>
              )}
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <h2 className="font-semibold mb-3">Gewichtsklassen S/M/L/XL</h2>
              {data.gewichtsklassen.length === 0 ? (
                <p className="text-sm text-gray-400 italic">Keine Daten im Zeitraum.</p>
              ) : (
                <div className="space-y-2">
                  {data.gewichtsklassen.map((g) => (
                    <BalkenZeile key={g.key} label={g.key} wert={g.mengeSortiert} max={maxGewicht} farbe="bg-amber-500" />
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-3">Top-Erzeuger</h2>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="text-left px-4 py-2">Erzeugercode</th>
                    <th className="text-left px-4 py-2">Haltungsform</th>
                    <th className="text-right px-4 py-2">Sortiert</th>
                    <th className="text-right px-4 py-2">Verkauft</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.topErzeuger.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-gray-400 italic">Keine Erzeuger im Zeitraum.</td>
                    </tr>
                  ) : (
                    data.topErzeuger.map((e) => (
                      <tr key={e.erzeugercode}>
                        <td className="px-4 py-2">{e.erzeugercode}</td>
                        <td className="px-4 py-2">{e.haltungsform ?? "—"}</td>
                        <td className="px-4 py-2 text-right">{e.mengeSortiert}</td>
                        <td className="px-4 py-2 text-right">{e.mengeVerkauft}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
