"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

const FALLBACK_AUSGABEN_KAT = ["Wareneinkauf", "Betriebsbedarf", "Fahrtkosten", "Bürobedarf", "Telefon/Internet", "Versicherung", "Miete", "Personal", "Sonstige"];

const BUCHUNGSTYPEN_FILTER = ["Betriebsausgabe", "Privatentnahme", "Privateinlage", "Reisekosten", "Bewirtung"];
const ZAHLUNGSWEGE_FILTER = ["Bar", "Überweisung", "EC", "Kreditkarte", "Privat"];

const BUCHUNGSTYP_COLORS: Record<string, string> = {
  Betriebsausgabe: "bg-gray-100 text-gray-700",
  Privatentnahme:  "bg-blue-100 text-blue-700",
  Privateinlage:   "bg-teal-100 text-teal-700",
  Reisekosten:     "bg-sky-100 text-sky-700",
  Bewirtung:       "bg-amber-100 text-amber-700",
};

interface Ausgabe {
  id: number;
  datum: string;
  belegNr: string | null;
  beschreibung: string;
  betragNetto: number;
  mwstSatz: number;
  kategorie: string;
  buchungstyp: string;
  sachkonto: string | null;
  zahlungsweg: string | null;
  kostenstelle: string | null;
  lieferant: { id: number; name: string } | null;
  bezahltAm: string | null;
  notiz: string | null;
  belegPfad: string | null;
  belegDateiname: string | null;
  ausleger: string | null;
  erfasstVon: string | null;
  bezahltVon: string | null;
}

function formatEuro(n: number) {
  return n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

function formatDatum(d: string) {
  return new Date(d).toLocaleDateString("de-DE");
}

function AusgabenContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [ausgaben, setAusgaben] = useState<Ausgabe[]>([]);
  const [loading, setLoading] = useState(true);

  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const todayStr = today.toISOString().slice(0, 10);

  const [von, setVon] = useState(searchParams.get("von") ?? firstOfMonth);
  const [bis, setBis] = useState(searchParams.get("bis") ?? todayStr);
  const [kategorie, setKategorie] = useState(searchParams.get("kategorie") ?? "Alle");
  const [buchungstyp, setBuchungstyp] = useState("Alle");
  const [zahlungsweg, setZahlungsweg] = useState("Alle");
  const [nurUnbezahlt, setNurUnbezahlt] = useState(false);
  const [nurAuslagen, setNurAuslagen] = useState(false);
  const [kategorienList, setKategorienList] = useState<string[]>(FALLBACK_AUSGABEN_KAT);

  useEffect(() => {
    fetch("/api/einstellungen?prefix=ausgaben.")
      .then((r) => r.json())
      .then((d) => {
        if (d["ausgaben.kategorien"]) {
          try {
            const parsed = JSON.parse(d["ausgaben.kategorien"]);
            if (Array.isArray(parsed) && parsed.length) setKategorienList(parsed);
          } catch { /* ignore */ }
        }
      })
      .catch(() => {});
  }, []);

  async function laden() {
    setLoading(true);
    const params = new URLSearchParams();
    if (von) params.set("von", von);
    if (bis) params.set("bis", bis);
    if (kategorie && kategorie !== "Alle") params.set("kategorie", kategorie);
    if (buchungstyp && buchungstyp !== "Alle") params.set("buchungstyp", buchungstyp);
    if (zahlungsweg && zahlungsweg !== "Alle") params.set("zahlungsweg", zahlungsweg);
    if (nurUnbezahlt) params.set("unbezahlt", "true");
    if (nurAuslagen) params.set("nurAuslagen", "true");
    const res = await fetch(`/api/ausgaben?${params}`);
    if (res.ok) setAusgaben(await res.json());
    setLoading(false);
  }

  useEffect(() => { laden(); }, [von, bis, kategorie, buchungstyp, zahlungsweg, nurUnbezahlt, nurAuslagen]);

  async function alsBezahlt(id: number) {
    await fetch(`/api/ausgaben/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bezahltAm: new Date().toISOString() }),
    });
    laden();
  }

  async function alsErstattet(id: number) {
    await fetch(`/api/ausgaben/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bezahltAm: new Date().toISOString() }),
    });
    laden();
  }

  async function loeschen(id: number) {
    if (!confirm("Ausgabe wirklich löschen?")) return;
    await fetch(`/api/ausgaben/${id}`, { method: "DELETE" });
    laden();
  }

  const summeNetto = ausgaben.reduce((s, a) => s + a.betragNetto, 0);
  const summeMwst = ausgaben.reduce((s, a) => s + a.betragNetto * (a.mwstSatz / 100), 0);
  const summeBrutto = summeNetto + summeMwst;
  const offeneAuslagen = ausgaben
    .filter(a => a.ausleger && !a.bezahltAm)
    .reduce((s, a) => s + a.betragNetto * (1 + a.mwstSatz / 100), 0);

  const bezahltBrutto = ausgaben.filter(a => a.bezahltAm).reduce((s, a) => s + a.betragNetto * (1 + a.mwstSatz / 100), 0);
  const offenBrutto = ausgaben.filter(a => !a.bezahltAm).reduce((s, a) => s + a.betragNetto * (1 + a.mwstSatz / 100), 0);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Ausgabenbuch</h1>
        <Link href="/ausgaben/neu" title="Neue Ausgabe" className="inline-flex items-center gap-1.5 bg-blue-600 text-white px-2.5 sm:px-4 py-2 rounded hover:bg-blue-700 text-sm">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          <span className="hidden sm:inline">Neue Ausgabe</span>
        </Link>
      </div>

      {/* Filter */}
      <div className="bg-white border rounded p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Von</label>
          <input type="date" value={von} onChange={e => setVon(e.target.value)}
            className="border rounded px-2 py-1 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Bis</label>
          <input type="date" value={bis} onChange={e => setBis(e.target.value)}
            className="border rounded px-2 py-1 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Kategorie</label>
          <select value={kategorie} onChange={e => setKategorie(e.target.value)}
            className="border rounded px-2 py-1 text-sm">
            <option key="Alle">Alle</option>
            {kategorienList.map(k => <option key={k}>{k}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Buchungstyp</label>
          <select value={buchungstyp} onChange={e => setBuchungstyp(e.target.value)}
            className="border rounded px-2 py-1 text-sm">
            <option>Alle</option>
            {BUCHUNGSTYPEN_FILTER.map(bt => <option key={bt}>{bt}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Zahlungsweg</label>
          <select value={zahlungsweg} onChange={e => setZahlungsweg(e.target.value)}
            className="border rounded px-2 py-1 text-sm">
            <option>Alle</option>
            {ZAHLUNGSWEGE_FILTER.map(z => <option key={z}>{z}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer pb-1">
          <input type="checkbox" checked={nurUnbezahlt} onChange={e => setNurUnbezahlt(e.target.checked)} />
          Nur unbezahlte
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer pb-1">
          <input type="checkbox" checked={nurAuslagen} onChange={e => setNurAuslagen(e.target.checked)} />
          Nur private Auslagen
        </label>
      </div>

      {/* Summen-Leiste */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-4">
        <div className="bg-white border rounded p-3 text-center">
          <div className="text-xs text-gray-500">Netto gesamt</div>
          <div className="text-lg font-bold text-gray-800">{formatEuro(summeNetto)}</div>
        </div>
        <div className="bg-white border rounded p-3 text-center">
          <div className="text-xs text-gray-500">MwSt gesamt</div>
          <div className="text-lg font-bold text-amber-600">{formatEuro(summeMwst)}</div>
        </div>
        <div className="bg-white border rounded p-3 text-center">
          <div className="text-xs text-gray-500">Brutto gesamt</div>
          <div className="text-lg font-bold text-blue-700">{formatEuro(summeBrutto)}</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded p-3 text-center">
          <div className="text-xs text-green-600">Bezahlt (Brutto)</div>
          <div className="text-lg font-bold text-green-700">{formatEuro(bezahltBrutto)}</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded p-3 text-center">
          <div className="text-xs text-red-600">Offen (Brutto)</div>
          <div className="text-lg font-bold text-red-700">{formatEuro(offenBrutto)}</div>
        </div>
        {offeneAuslagen > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded p-3 text-center">
            <div className="text-xs text-orange-600">Offene Auslagen</div>
            <div className="text-lg font-bold text-orange-700">{formatEuro(offeneAuslagen)}</div>
          </div>
        )}
      </div>

      {/* Tabelle */}
      <div className="bg-white border rounded overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Lade…</div>
        ) : ausgaben.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Keine Ausgaben im gewählten Zeitraum.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-3 py-2">Datum</th>
                <th className="text-left px-3 py-2 hidden sm:table-cell">Beleg-Nr.</th>
                <th className="text-left px-3 py-2">Beschreibung</th>
                <th className="text-left px-3 py-2 hidden md:table-cell">Kategorie / Typ</th>
                <th className="text-left px-3 py-2 hidden lg:table-cell">Zahlungsweg / Konto</th>
                <th className="text-left px-3 py-2 hidden xl:table-cell">Lieferant</th>
                <th className="text-right px-3 py-2">Netto</th>
                <th className="text-right px-3 py-2 hidden sm:table-cell">MwSt</th>
                <th className="text-right px-3 py-2">Brutto</th>
                <th className="text-left px-3 py-2 hidden lg:table-cell">Bezahlt / Erstattet</th>
                <th className="text-left px-3 py-2 hidden xl:table-cell">Ausgelegt von</th>
                <th className="text-left px-3 py-2 hidden 2xl:table-cell">Erfasst von</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {ausgaben.map(a => {
                const mwstBetrag = a.betragNetto * (a.mwstSatz / 100);
                const brutto = a.betragNetto + mwstBetrag;
                return (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 whitespace-nowrap">{formatDatum(a.datum)}</td>
                    <td className="px-3 py-2 text-gray-500 hidden sm:table-cell">{a.belegNr ?? "—"}</td>
                    <td className="px-3 py-2 font-medium">
                      {a.beschreibung}
                      <div className="sm:hidden text-xs text-gray-400">{a.kategorie}</div>
                      <div className="md:hidden mt-0.5">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${BUCHUNGSTYP_COLORS[a.buchungstyp] ?? "bg-gray-100 text-gray-600"}`}>{a.buchungstyp}</span>
                      </div>
                      {a.ausleger && (
                        <div className="lg:hidden text-xs text-orange-600 mt-0.5">👤 {a.ausleger}</div>
                      )}
                      {a.erfasstVon && (
                        <div className="xl:hidden text-xs text-gray-400 mt-0.5">✏️ {a.erfasstVon}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 hidden md:table-cell">
                      <div className="flex flex-col gap-1">
                        <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs w-fit">{a.kategorie}</span>
                        {a.buchungstyp && a.buchungstyp !== "Betriebsausgabe" && (
                          <span className={`text-xs px-2 py-0.5 rounded w-fit ${BUCHUNGSTYP_COLORS[a.buchungstyp] ?? "bg-gray-100 text-gray-600"}`}>{a.buchungstyp}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 hidden lg:table-cell">
                      <div className="flex flex-col gap-0.5">
                        {a.zahlungsweg && <span className="text-xs text-gray-600">{a.zahlungsweg}</span>}
                        {a.sachkonto && <span className="text-xs font-mono text-gray-400">{a.sachkonto}</span>}
                        {a.kostenstelle && <span className="text-xs text-gray-400">{a.kostenstelle}</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-gray-600 hidden xl:table-cell">{a.lieferant?.name ?? "—"}</td>
                    <td className="px-3 py-2 text-right">{formatEuro(a.betragNetto)}</td>
                    <td className="px-3 py-2 text-right text-gray-500 hidden sm:table-cell">
                      {a.mwstSatz}% / {formatEuro(mwstBetrag)}
                    </td>
                    <td className="px-3 py-2 text-right font-medium">{formatEuro(brutto)}</td>
                    <td className="px-3 py-2 hidden lg:table-cell">
                      {a.bezahltAm ? (
                        <span className="text-green-600 text-xs">
                          {a.ausleger ? "Erstattet" : "Bezahlt"} {formatDatum(a.bezahltAm)}
                          {a.bezahltVon && <span className="ml-1 text-gray-400">({a.bezahltVon})</span>}
                        </span>
                      ) : a.ausleger ? (
                        <button onClick={() => alsErstattet(a.id)}
                          className="text-xs text-orange-600 hover:underline">
                          Als erstattet
                        </button>
                      ) : (
                        <button onClick={() => alsBezahlt(a.id)}
                          className="text-xs text-blue-600 hover:underline">
                          Als bezahlt
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-2 hidden xl:table-cell">
                      {a.ausleger ? (
                        <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-xs font-medium">
                          👤 {a.ausleger}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 hidden 2xl:table-cell">
                      {a.erfasstVon ? (
                        <span className="text-xs text-gray-500">{a.erfasstVon}</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex gap-2 justify-end items-center">
                        {a.belegPfad && (
                          <a href={a.belegPfad} target="_blank" rel="noreferrer"
                            className="text-gray-500 hover:text-gray-800 text-xs" title={a.belegDateiname ?? "Beleg öffnen"}>
                            📎
                          </a>
                        )}
                        <Link href={`/ausgaben/${a.id}`} className="text-blue-600 hover:underline text-xs">
                          Bearbeiten
                        </Link>
                        <button onClick={() => loeschen(a.id)}
                          className="text-red-500 hover:underline text-xs">
                          Löschen
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default function AusgabenPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-400">Lade…</div>}>
      <AusgabenContent />
    </Suspense>
  );
}
