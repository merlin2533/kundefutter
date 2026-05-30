"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { KpiCard } from "@/components/Card";
import { formatEuro, formatDatum } from "@/lib/utils";

interface Lieferung {
  id: number;
  datum: string;
  rechnungNr: string | null;
  rechnungDatum: string | null;
  bezahltAm: string | null;
  gesamtbetrag: number;
  zahlungsziel: number | null;
  kunde: { id: number; name: string; firma: string | null } | null;
}

interface Eingangsrechnung {
  id: number;
  nummer: string;
  datum: string;
  faelligAm: string | null;
  betrag: number;
  status: string;
  lieferant: { id: number; name: string } | null;
}

interface Sammelrechnung {
  id: number;
  nummer: string;
  datum: string;
  gesamtbetrag: number;
  zahlungsstatus: string;
  faelligAm: string | null;
  bezahltAm: string | null;
  kunde: { id: number; name: string; firma: string | null } | null;
}

function tageDiff(dateStr: string | null): number {
  if (!dateStr) return 0;
  const diff = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24)
  );
  return diff;
}

function faelligAm(lieferung: Lieferung): Date | null {
  const basisDatum = lieferung.rechnungDatum ?? lieferung.datum;
  if (!basisDatum) return null;
  const ziel = lieferung.zahlungsziel ?? 30;
  const d = new Date(basisDatum);
  d.setDate(d.getDate() + ziel);
  return d;
}

export default function CashflowPage() {
  const [lieferungen, setLieferungen] = useState<Lieferung[]>([]);
  const [eingangsrechnungen, setEingangsrechnungen] = useState<Eingangsrechnung[]>([]);
  const [sammelrechnungen, setSammelrechnungen] = useState<Sammelrechnung[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [lRes, eRes, sRes] = await Promise.all([
          fetch("/api/lieferungen?status=geliefert&limit=500"),
          fetch("/api/eingangsrechnungen?status=OFFEN&limit=500"),
          fetch("/api/sammelrechnungen?limit=500"),
        ]);
        if (lRes.ok) {
          const d = await lRes.json();
          setLieferungen(Array.isArray(d) ? d : []);
        }
        if (eRes.ok) {
          const d = await eRes.json();
          setEingangsrechnungen(Array.isArray(d) ? d : (d?.eingangsrechnungen ?? []));
        }
        if (sRes.ok) {
          const d = await sRes.json();
          setSammelrechnungen(Array.isArray(d) ? d : []);
        }
      } catch {
        setError("Fehler beim Laden der Cashflow-Daten.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Offene Forderungen: Lieferungen mit Rechnungsnr., nicht bezahlt
  const offeneForderungen = lieferungen.filter(
    (l) => l.rechnungNr !== null && l.bezahltAm === null
  );

  // Offene Sammelrechnungen
  const offeneSammel = sammelrechnungen.filter(
    (s) => s.zahlungsstatus !== "bezahlt" && s.bezahltAm === null
  );

  const today = new Date();

  // Gesamtforderungen
  const forderungGesamt =
    offeneForderungen.reduce((s, l) => s + (l.gesamtbetrag ?? 0), 0) +
    offeneSammel.reduce((s, s2) => s + (s2.gesamtbetrag ?? 0), 0);

  // Überfällige Forderungen
  const ueberfaelligeForderungen = offeneForderungen.filter((l) => {
    const f = faelligAm(l);
    return f !== null && f < today;
  });
  const ueberfaelligSammel = offeneSammel.filter((s) => {
    if (!s.faelligAm) return false;
    return new Date(s.faelligAm) < today;
  });
  const forderungUeberfaellig =
    ueberfaelligeForderungen.reduce((s, l) => s + (l.gesamtbetrag ?? 0), 0) +
    ueberfaelligSammel.reduce((s, s2) => s + (s2.gesamtbetrag ?? 0), 0);

  // Offene Verbindlichkeiten
  const verbindlichkeitGesamt = eingangsrechnungen.reduce(
    (s, e) => s + (e.betrag ?? 0),
    0
  );

  const nettoCashflow = forderungGesamt - verbindlichkeitGesamt;

  // Sort Forderungen: älteste zuerst
  const sortedForderungen = [...offeneForderungen].sort(
    (a, b) =>
      new Date(a.rechnungDatum ?? a.datum).getTime() -
      new Date(b.rechnungDatum ?? b.datum).getTime()
  );

  // Sort Verbindlichkeiten: bald fällig zuerst
  const sortedVerbindlichkeiten = [...eingangsrechnungen].sort((a, b) => {
    if (!a.faelligAm && !b.faelligAm) return 0;
    if (!a.faelligAm) return 1;
    if (!b.faelligAm) return -1;
    return new Date(a.faelligAm).getTime() - new Date(b.faelligAm).getTime();
  });

  return (
    <div className="max-w-screen-xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cashflow-Übersicht</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Offene Forderungen und Verbindlichkeiten im Überblick
          </p>
        </div>
        <Link
          href="/statistik/liquiditaet"
          className="text-sm text-green-700 hover:text-green-800 underline underline-offset-2 whitespace-nowrap"
        >
          → Liquiditätsanalyse &amp; Trend
        </Link>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-gray-400 text-sm">Lade Cashflow-Daten…</p>
      ) : (
        <>
          {/* KPI-Leiste */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <KpiCard
              label="Offene Forderungen gesamt"
              value={formatEuro(forderungGesamt)}
              sub={`${offeneForderungen.length + offeneSammel.length} offene Rechnungen`}
              color="green"
            />
            <KpiCard
              label="Davon überfällig"
              value={formatEuro(forderungUeberfaellig)}
              sub={`${ueberfaelligeForderungen.length + ueberfaelligSammel.length} Rechnungen überfällig`}
              color="red"
            />
            <KpiCard
              label="Offene Verbindlichkeiten"
              value={formatEuro(verbindlichkeitGesamt)}
              sub={`${eingangsrechnungen.length} Eingangsrechnungen offen`}
              color="orange"
            />
          </div>

          {/* Cashflow-Saldo */}
          <div
            className={`rounded-xl border p-4 mb-8 flex items-center justify-between ${
              nettoCashflow >= 0
                ? "bg-green-50 border-green-200"
                : "bg-red-50 border-red-200"
            }`}
          >
            <div>
              <p className="text-sm font-medium text-gray-600">
                Netto-Cashflow-Position (Forderungen − Verbindlichkeiten)
              </p>
              <p
                className={`text-3xl font-bold mt-1 ${
                  nettoCashflow >= 0 ? "text-green-700" : "text-red-700"
                }`}
              >
                {nettoCashflow >= 0 ? "+" : ""}
                {formatEuro(nettoCashflow)}
              </p>
            </div>
            <div className="text-4xl">{nettoCashflow >= 0 ? "✓" : "!"}</div>
          </div>

          {/* Forderungen-Tabelle */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-3">
              Offene Forderungen ({sortedForderungen.length})
            </h2>
            {sortedForderungen.length === 0 ? (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-700">
                Keine offenen Forderungen.
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                          Rechnung-Nr.
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                          Datum
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          Kunde
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                          Betrag
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap hidden sm:table-cell">
                          Fällig am
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap hidden md:table-cell">
                          Tage überfällig
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {sortedForderungen.map((l) => {
                        const fDate = faelligAm(l);
                        const tageUeber = fDate
                          ? Math.floor(
                              (today.getTime() - fDate.getTime()) /
                                (1000 * 60 * 60 * 24)
                            )
                          : 0;
                        const ueberfaellig = tageUeber > 30;
                        return (
                          <tr
                            key={l.id}
                            className={ueberfaellig ? "bg-red-50" : "hover:bg-gray-50"}
                          >
                            <td className="px-4 py-3 font-mono whitespace-nowrap">
                              <Link
                                href={`/lieferungen/${l.id}`}
                                className="text-blue-600 hover:underline"
                              >
                                {l.rechnungNr}
                              </Link>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                              {formatDatum(l.rechnungDatum ?? l.datum)}
                            </td>
                            <td className="px-4 py-3">
                              {l.kunde ? (
                                <Link
                                  href={`/kunden/${l.kunde.id}`}
                                  className="text-green-700 hover:underline font-medium"
                                >
                                  {l.kunde.firma ?? l.kunde.name}
                                </Link>
                              ) : (
                                <span className="text-gray-400">–</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-semibold whitespace-nowrap">
                              {formatEuro(l.gesamtbetrag ?? 0)}
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap text-gray-600 hidden sm:table-cell">
                              {fDate ? fDate.toLocaleDateString("de-DE") : "–"}
                            </td>
                            <td className="px-4 py-3 text-right hidden md:table-cell">
                              {tageUeber > 0 ? (
                                <span
                                  className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                    tageUeber > 30
                                      ? "bg-red-100 text-red-700"
                                      : "bg-orange-100 text-orange-700"
                                  }`}
                                >
                                  {tageUeber} Tage
                                </span>
                              ) : (
                                <span className="text-green-600 text-xs">Offen</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t border-gray-200">
                      <tr>
                        <td
                          colSpan={3}
                          className="px-4 py-3 text-sm font-semibold text-gray-700"
                        >
                          Gesamt ({sortedForderungen.length})
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-gray-900 font-mono whitespace-nowrap">
                          {formatEuro(
                            sortedForderungen.reduce(
                              (s, l) => s + (l.gesamtbetrag ?? 0),
                              0
                            )
                          )}
                        </td>
                        <td colSpan={2} className="hidden md:table-cell" />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Verbindlichkeiten-Tabelle */}
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">
              Offene Verbindlichkeiten ({sortedVerbindlichkeiten.length})
            </h2>
            {sortedVerbindlichkeiten.length === 0 ? (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-700">
                Keine offenen Verbindlichkeiten.
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                          Nr.
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          Lieferant
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap hidden sm:table-cell">
                          Datum
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                          Betrag
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap hidden sm:table-cell">
                          Fällig am
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap hidden md:table-cell">
                          Tage bis Fälligkeit
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {sortedVerbindlichkeiten.map((e) => {
                        const faellig = e.faelligAm ? new Date(e.faelligAm) : null;
                        const tageVerblieben = faellig
                          ? Math.floor(
                              (faellig.getTime() - today.getTime()) /
                                (1000 * 60 * 60 * 24)
                            )
                          : null;
                        const istUeberfaellig =
                          tageVerblieben !== null && tageVerblieben < 0;
                        const baldFaellig =
                          tageVerblieben !== null &&
                          tageVerblieben >= 0 &&
                          tageVerblieben < 7;
                        return (
                          <tr
                            key={e.id}
                            className={
                              istUeberfaellig
                                ? "bg-red-50"
                                : baldFaellig
                                ? "bg-orange-50"
                                : "hover:bg-gray-50"
                            }
                          >
                            <td className="px-4 py-3 font-mono whitespace-nowrap text-gray-700">
                              <Link
                                href={`/eingangsrechnungen/${e.id}`}
                                className="text-blue-600 hover:underline"
                              >
                                {e.nummer}
                              </Link>
                            </td>
                            <td className="px-4 py-3">
                              {e.lieferant ? (
                                <Link
                                  href={`/lieferanten/${e.lieferant.id}`}
                                  className="text-green-700 hover:underline font-medium"
                                >
                                  {e.lieferant.name}
                                </Link>
                              ) : (
                                <span className="text-gray-400">–</span>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-gray-600 hidden sm:table-cell">
                              {formatDatum(e.datum)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-semibold whitespace-nowrap">
                              {formatEuro(e.betrag ?? 0)}
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap text-gray-600 hidden sm:table-cell">
                              {faellig
                                ? faellig.toLocaleDateString("de-DE")
                                : "–"}
                            </td>
                            <td className="px-4 py-3 text-right hidden md:table-cell">
                              {tageVerblieben !== null ? (
                                <span
                                  className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                    istUeberfaellig
                                      ? "bg-red-100 text-red-700"
                                      : baldFaellig
                                      ? "bg-orange-100 text-orange-700"
                                      : "bg-gray-100 text-gray-600"
                                  }`}
                                >
                                  {istUeberfaellig
                                    ? `${Math.abs(tageVerblieben)} Tage überfällig`
                                    : `${tageVerblieben} Tage`}
                                </span>
                              ) : (
                                <span className="text-gray-400">–</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t border-gray-200">
                      <tr>
                        <td
                          colSpan={3}
                          className="px-4 py-3 text-sm font-semibold text-gray-700"
                        >
                          Gesamt ({sortedVerbindlichkeiten.length})
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-gray-900 font-mono whitespace-nowrap">
                          {formatEuro(verbindlichkeitGesamt)}
                        </td>
                        <td colSpan={2} className="hidden md:table-cell" />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
