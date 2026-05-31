"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatEuro } from "@/lib/utils";
import ZeitraumFilter from "@/components/ZeitraumFilter";
import { downloadCSV } from "@/lib/csv";

interface ArtikelUnterMindest {
  id: number;
  name: string;
  bestand: number;
  mindest: number;
  einheit: string;
}

interface BewegungRow {
  typ: string;
  anzahl: number;
  mengeSumme: number;
}

interface SlowMoverRow {
  id: number;
  name: string;
  bestand: number;
  lagerwert: number;
  einheit: string;
  letzteBewegung: string | null;
}

interface Data {
  lagerwert: number;
  artikelUnterMindest: ArtikelUnterMindest[];
  bewegungenNachTyp: BewegungRow[];
  slowMover: SlowMoverRow[];
  turnoverRatio: number;
  slowMoverLagerwert: number;
  summe: { anzahlBewegungen: number };
}

const TYP_LABELS: Record<string, string> = {
  eingang: "Eingang",
  ausgang: "Ausgang",
  korrektur: "Korrektur",
  UMBUCHUNG: "Umbuchung",
};

export default function StatistikLagerPage() {
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
      const res = await fetch(`/api/statistik/lager?${params}`);
      if (!res.ok) { setError("Auswertung konnte nicht geladen werden."); return; }
      setData(await res.json());
    } catch {
      setError("Netzwerkfehler beim Laden.");
    } finally {
      setLoading(false);
    }
  }, [jahr, vonMonat, bisMonat]);

  useEffect(() => { laden(); }, [laden]);

  const artikelUnterMindest = Array.isArray(data?.artikelUnterMindest) ? data!.artikelUnterMindest : [];
  const bewegungenNachTyp = Array.isArray(data?.bewegungenNachTyp) ? data!.bewegungenNachTyp : [];
  const slowMover = Array.isArray(data?.slowMover) ? data!.slowMover : [];

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <Link href="/statistik" className="hover:text-green-700">Statistik</Link>
          <span>›</span>
          <span className="text-gray-800 font-medium">Lager</span>
        </div>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Lager-Auswertung</h1>
            <p className="text-sm text-gray-500 mt-1">
              Lagerwert (stichtagsbezogener Snapshot) und Bewegungen im gewählten Zeitraum.
            </p>
          </div>
          <button
            onClick={() =>
              data &&
              downloadCSV(
                "statistik-lager",
                ["Artikel", "Bestand", "Mindestbestand", "Einheit"],
                artikelUnterMindest.map((a) => [a.name, a.bestand, a.mindest, a.einheit])
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

      <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        Hinweis: Der Lagerwert ist stichtagsbezogen (aktueller Bestand &times; Standardpreis aller aktiven
        Artikel). Die Lagerbewegungen beziehen sich auf den gewählten Zeitraum.
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
      )}

      {data && (
        <>
          {/* KPI-Karten */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Lagerwert (aktuell)</p>
              <p className="text-2xl font-bold mt-1 text-green-700">{formatEuro(data.lagerwert)}</p>
              <p className="text-xs text-gray-400 mt-0.5">Bestand × Standardpreis, aktive Artikel</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Artikel unter Mindestbestand</p>
              <p className={`text-2xl font-bold mt-1 ${artikelUnterMindest.length > 0 ? "text-red-600" : "text-gray-900"}`}>
                {artikelUnterMindest.length}
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Lagerbewegungen (Zeitraum)</p>
              <p className="text-2xl font-bold mt-1 text-gray-900">{data.summe.anzahlBewegungen}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Lagerumschlag</p>
              <p className={`text-2xl font-bold mt-1 ${data.turnoverRatio >= 2 ? "text-green-700" : data.turnoverRatio >= 1 ? "text-amber-600" : "text-red-600"}`}>
                {data.turnoverRatio.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}×
              </p>
              <p className="text-xs text-gray-400 mt-0.5">Abgangswert / Lagerwert im Zeitraum</p>
            </div>
          </div>

          {/* Slow-Mover */}
          {slowMover.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-gray-700">Slow Mover (&gt; 90 Tage keine Bewegung)</h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {slowMover.length} Artikel · Gebundener Lagerwert: {formatEuro(data.slowMoverLagerwert)}
                    {data.lagerwert > 0 && (
                      <span className="ml-1">
                        ({Math.round((data.slowMoverLagerwert / data.lagerwert) * 100)} % des Gesamtlagerwerts)
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Artikel</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Bestand</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Lagerwert</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Letzte Bewegung</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {slowMover.map((a) => (
                      <tr key={a.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5">
                          <Link href={`/artikel/${a.id}`} className="text-green-700 hover:underline font-medium">
                            {a.name}
                          </Link>
                          <div className="md:hidden text-xs text-gray-400 mt-0.5">
                            {a.letzteBewegung ? new Date(a.letzteBewegung).toLocaleDateString("de-DE") : "Nie"}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-amber-700">
                          {a.bestand.toLocaleString("de-DE")} {a.einheit}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-gray-600 hidden sm:table-cell">
                          {formatEuro(a.lagerwert)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-500 text-xs hidden md:table-cell">
                          {a.letzteBewegung ? new Date(a.letzteBewegung).toLocaleDateString("de-DE") : "Nie"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Bewegungen nach Typ */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-700">Bewegungen nach Typ</h2>
            </div>
            {bewegungenNachTyp.length === 0 ? (
              <p className="p-6 text-sm text-gray-400">Keine Lagerbewegungen im gewählten Zeitraum.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Typ</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Anzahl</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Menge (absolut)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {bewegungenNachTyp.map((b) => (
                      <tr key={b.typ} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium text-gray-800">
                          {TYP_LABELS[b.typ] ?? b.typ}
                          <div className="sm:hidden text-xs text-gray-400 mt-0.5">{b.mengeSumme.toLocaleString("de-DE")} (abs.)</div>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono">{b.anzahl}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-gray-600 hidden sm:table-cell">{b.mengeSumme.toLocaleString("de-DE")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Artikel unter Mindestbestand */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-700">Artikel unter Mindestbestand</h2>
            </div>
            {artikelUnterMindest.length === 0 ? (
              <p className="p-6 text-sm text-gray-400">Alle aktiven Artikel haben ausreichend Bestand.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Artikel</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Bestand</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Mindestbestand</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Fehlmenge</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {artikelUnterMindest.map((a) => (
                      <tr key={a.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5">
                          <Link href={`/artikel/${a.id}`} className="text-green-700 hover:underline font-medium">
                            {a.name}
                          </Link>
                          <div className="sm:hidden text-xs text-gray-400 mt-0.5">
                            Mindest: {a.mindest.toLocaleString("de-DE")} {a.einheit}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-red-600">
                          {a.bestand.toLocaleString("de-DE")} {a.einheit}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-gray-600 hidden sm:table-cell">
                          {a.mindest.toLocaleString("de-DE")} {a.einheit}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-amber-700 hidden md:table-cell">
                          {(a.mindest - a.bestand).toLocaleString("de-DE")} {a.einheit}
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
