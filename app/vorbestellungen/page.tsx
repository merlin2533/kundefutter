"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Card, KpiCard } from "@/components/Card";
import { formatDatum, formatEuro } from "@/lib/utils";

interface Position {
  id: number; menge: number; preis?: number | null; einheit: string;
  artikel: { id: number; name: string; einheit: string; standardpreis: number };
}
interface Vorbestellung {
  id: number; nummer: string; saison: string; status: string;
  bestelldatum: string; bestellfrist?: string | null; lieferdatum?: string | null;
  rabattProzent?: number | null;
  lieferungId?: number | null;
  lieferung?: { id: number; status: string; rechnungNr: string | null } | null;
  kunde: { id: number; name: string; firma?: string | null };
  positionen: Position[];
}

function loadVorbestellungFilters() {
  try { return JSON.parse(sessionStorage.getItem("vorbestellung-filters") ?? "{}"); } catch { return {}; }
}

export default function Page() {
  const [liste, setListe] = useState<Vorbestellung[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>(() => loadVorbestellungFilters().filterStatus ?? "");
  const [filterSaison, setFilterSaison] = useState<string>(() => loadVorbestellungFilters().filterSaison ?? "");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try { sessionStorage.setItem("vorbestellung-filters", JSON.stringify({ filterStatus, filterSaison })); } catch {}
  }, [filterStatus, filterSaison]);

  useEffect(() => {
    fetch("/api/vorbestellungen").then(r => r.ok ? r.json() : []).then(d => setListe(Array.isArray(d) ? d : [])).finally(() => setLoading(false));
  }, []);

  const saisonen = Array.from(new Set(liste.map(v => v.saison))).sort();

  const gefiltert = useMemo(() => {
    return liste.filter(v => {
      if (filterStatus && v.status !== filterStatus) return false;
      if (filterSaison && v.saison !== filterSaison) return false;
      return true;
    });
  }, [liste, filterStatus, filterSaison]);

  const offen = liste.filter(v => v.status === "OFFEN").length;
  const bestaetigt = liste.filter(v => v.status === "BESTAETIGT").length;
  const wert = liste
    .filter(v => v.status !== "STORNIERT")
    .reduce((sum, v) => sum + v.positionen.reduce((s, p) => s + p.menge * (p.preis ?? p.artikel.standardpreis), 0), 0);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-wrap justify-between items-center mb-6 gap-3">
        <h1 className="text-2xl font-bold">📋 Vorbestellungen (Frühbezug)</h1>
        <div className="flex gap-2">
          <Link href="/einstellungen/fruehbezug" title="Rabatt-Staffeln" className="inline-flex items-center gap-1.5 border px-2.5 sm:px-4 py-2 rounded hover:bg-gray-50">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            <span className="hidden sm:inline">Rabatt-Staffeln</span>
          </Link>
          <Link href="/vorbestellungen/neu" title="Neue Vorbestellung" className="inline-flex items-center gap-1.5 bg-green-700 text-white px-2.5 sm:px-4 py-2 rounded hover:bg-green-800">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            <span className="hidden sm:inline">Neue Vorbestellung</span>
          </Link>
        </div>
      </div>

      <div className="grid sm:grid-cols-4 gap-3 mb-4">
        <KpiCard label="Gesamt" value={liste.length} color="blue" />
        <KpiCard label="Offen" value={offen} color="yellow" />
        <KpiCard label="Bestätigt" value={bestaetigt} color="green" />
        <KpiCard label="Auftragswert" value={formatEuro(wert)} color="green" sub="ohne stornierte" />
      </div>

      <Card className="mb-4">
        <div className="flex flex-wrap gap-3">
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="border rounded px-3 py-2">
            <option value="">Alle Status</option>
            <option value="OFFEN">Offen</option>
            <option value="BESTAETIGT">Bestätigt</option>
            <option value="UMGEWANDELT">Umgewandelt</option>
            <option value="STORNIERT">Storniert</option>
          </select>
          <select value={filterSaison} onChange={e => setFilterSaison(e.target.value)} className="border rounded px-3 py-2">
            <option value="">Alle Saisons</option>
            {saisonen.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <div className="ml-auto text-sm text-gray-500 flex items-center">{gefiltert.length} von {liste.length}</div>
        </div>
      </Card>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Lade…</div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-3 text-xs font-semibold text-gray-500 uppercase">Nr.</th>
                  <th className="py-2 pr-3 text-xs font-semibold text-gray-500 uppercase">Kunde</th>
                  <th className="py-2 pr-3 text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Saison</th>
                  <th className="py-2 pr-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Bestelldatum</th>
                  <th className="py-2 pr-3 text-xs font-semibold text-gray-500 uppercase hidden lg:table-cell">Frist</th>
                  <th className="py-2 pr-3 text-xs font-semibold text-gray-500 uppercase hidden lg:table-cell">Rabatt</th>
                  <th className="py-2 pr-3 text-xs font-semibold text-gray-500 uppercase">Vorgangskette</th>
                </tr>
              </thead>
              <tbody>
                {gefiltert.map(v => {
                  const hatLieferung = !!v.lieferungId;
                  const liefStatus = v.lieferung?.status ?? null;
                  const hatRechnung = !!v.lieferung?.rechnungNr;
                  const bestaetigt = v.status === "BESTAETIGT" || v.status === "UMGEWANDELT";
                  const storniert = v.status === "STORNIERT";
                  return (
                    <tr key={v.id} className="border-b hover:bg-gray-50">
                      <td className="py-2 pr-3">
                        <Link href={`/vorbestellungen/${v.id}`} className="text-green-700 hover:underline font-mono text-sm">{v.nummer}</Link>
                        <div className="sm:hidden text-xs text-gray-500 mt-0.5">{v.saison}</div>
                      </td>
                      <td className="py-2 pr-3">
                        <Link href={`/kunden/${v.kunde.id}`} className="hover:underline font-medium">{v.kunde.firma ?? v.kunde.name}</Link>
                      </td>
                      <td className="py-2 pr-3 hidden sm:table-cell text-sm text-gray-600">{v.saison}</td>
                      <td className="py-2 pr-3 hidden md:table-cell text-sm text-gray-600">{formatDatum(v.bestelldatum)}</td>
                      <td className="py-2 pr-3 hidden lg:table-cell text-sm text-gray-600">{v.bestellfrist ? formatDatum(v.bestellfrist) : "–"}</td>
                      <td className="py-2 pr-3 hidden lg:table-cell text-sm text-gray-600">{v.rabattProzent != null ? `${v.rabattProzent}%` : "–"}</td>
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-1 flex-wrap text-xs">
                          {/* Schritt 1: Vorbestellung bestätigt? */}
                          {storniert ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded font-medium bg-red-100 text-red-700 border border-red-200 whitespace-nowrap">✕ Storniert</span>
                          ) : bestaetigt ? (
                            <Link href={`/vorbestellungen/${v.id}`} title="Bestätigte Vorbestellung"
                              className="inline-flex items-center px-1.5 py-0.5 rounded font-medium bg-green-100 text-green-800 border border-green-200 hover:bg-green-200 transition-colors whitespace-nowrap">
                              ✓ Bestätigt
                            </Link>
                          ) : (
                            <Link href={`/vorbestellungen/${v.id}`} title="Vorbestellung bestätigen"
                              className="inline-flex items-center px-1.5 py-0.5 rounded font-medium bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100 transition-colors whitespace-nowrap">
                              ○ Offen
                            </Link>
                          )}
                          {!storniert && (
                            <>
                              <span className="text-gray-300">›</span>
                              {/* Schritt 2: Lieferung erstellt? */}
                              {hatLieferung && v.lieferung ? (
                                <Link href={`/lieferungen/${v.lieferung.id}`} title={`Lieferung (${v.lieferung.status})`}
                                  className={`inline-flex items-center px-1.5 py-0.5 rounded font-medium border transition-colors whitespace-nowrap ${
                                    liefStatus === "geliefert"
                                      ? "bg-green-100 text-green-800 border-green-200 hover:bg-green-200"
                                      : "bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100"
                                  }`}>
                                  ✓ Lieferung{liefStatus === "geplant" ? " (geplant)" : ""}
                                </Link>
                              ) : (
                                <Link href={`/lieferungen/neu?kundeId=${v.kunde.id}`} title="Lieferung anlegen"
                                  className="inline-flex items-center px-1.5 py-0.5 rounded font-medium bg-gray-50 text-gray-500 border border-gray-300 hover:bg-gray-100 transition-colors whitespace-nowrap">
                                  ○ Lieferung
                                </Link>
                              )}
                              <span className="text-gray-300">›</span>
                              {/* Schritt 3: Rechnung erstellt? */}
                              {hatRechnung ? (
                                <Link href={`/lieferungen/${v.lieferung!.id}/rechnung`} title="Rechnung anzeigen"
                                  className="inline-flex items-center px-1.5 py-0.5 rounded font-medium bg-green-100 text-green-800 border border-green-200 hover:bg-green-200 transition-colors whitespace-nowrap">
                                  ✓ Rechnung
                                </Link>
                              ) : (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded font-medium bg-gray-50 text-gray-400 border border-gray-200 whitespace-nowrap">
                                  ○ Rechnung
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
