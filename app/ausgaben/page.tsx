"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

const KATEGORIEN = [
  "Alle",
  "Wareneinkauf",
  "Betriebsbedarf",
  "Fahrtkosten",
  "Bürobedarf",
  "Telefon/Internet",
  "Versicherung",
  "Miete",
  "Sonstige",
];

interface Ausgabe {
  id: number;
  datum: string;
  belegNr: string | null;
  beschreibung: string;
  betragNetto: number;
  mwstSatz: number;
  kategorie: string;
  lieferant: { id: number; name: string } | null;
  bezahltAm: string | null;
  notiz: string | null;
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
  const [nurUnbezahlt, setNurUnbezahlt] = useState(false);

  async function laden() {
    setLoading(true);
    const params = new URLSearchParams();
    if (von) params.set("von", von);
    if (bis) params.set("bis", bis);
    if (kategorie && kategorie !== "Alle") params.set("kategorie", kategorie);
    if (nurUnbezahlt) params.set("unbezahlt", "true");
    const res = await fetch(`/api/ausgaben?${params}`);
    if (res.ok) setAusgaben(await res.json());
    setLoading(false);
  }

  useEffect(() => { laden(); }, [von, bis, kategorie, nurUnbezahlt]);

  async function alsBezahlt(id: number) {
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

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Ausgabenbuch</h1>
        <Link href="/ausgaben/neu" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm">
          + Neue Ausgabe
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
            {KATEGORIEN.map(k => <option key={k}>{k}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer pb-1">
          <input type="checkbox" checked={nurUnbezahlt} onChange={e => setNurUnbezahlt(e.target.checked)} />
          Nur unbezahlte
        </label>
      </div>

      {/* Summen-Leiste */}
      <div className="grid grid-cols-3 gap-4 mb-4">
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
                <th className="text-left px-3 py-2 hidden md:table-cell">Kategorie</th>
                <th className="text-left px-3 py-2 hidden lg:table-cell">Lieferant</th>
                <th className="text-right px-3 py-2">Netto</th>
                <th className="text-right px-3 py-2 hidden sm:table-cell">MwSt</th>
                <th className="text-right px-3 py-2">Brutto</th>
                <th className="text-left px-3 py-2 hidden md:table-cell">Bezahlt</th>
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
                    </td>
                    <td className="px-3 py-2 hidden md:table-cell">
                      <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs">{a.kategorie}</span>
                    </td>
                    <td className="px-3 py-2 text-gray-600 hidden lg:table-cell">{a.lieferant?.name ?? "—"}</td>
                    <td className="px-3 py-2 text-right">{formatEuro(a.betragNetto)}</td>
                    <td className="px-3 py-2 text-right text-gray-500 hidden sm:table-cell">
                      {a.mwstSatz}% / {formatEuro(mwstBetrag)}
                    </td>
                    <td className="px-3 py-2 text-right font-medium">{formatEuro(brutto)}</td>
                    <td className="px-3 py-2 hidden md:table-cell">
                      {a.bezahltAm ? (
                        <span className="text-green-600 text-xs">{formatDatum(a.bezahltAm)}</span>
                      ) : (
                        <button onClick={() => alsBezahlt(a.id)}
                          className="text-xs text-blue-600 hover:underline">
                          Als bezahlt
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex gap-2 justify-end">
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
