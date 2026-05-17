"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/Card";
import { formatEuro } from "@/lib/utils";

interface Lieferant { id: number; name: string }
interface Vorschlag {
  artikelLieferantId: number;
  artikelId: number;
  artikelnummer: string;
  artikelName: string;
  alterPreis: number;
  neuerPreis: number;
  differenz: number;
}

const BEISPIEL_CSV = `Artikelnummer,Einkaufspreis
MAR-001,33.50
MAR-002,28.00
BVG-001,19.90
`;

function downloadBeispielCsv() {
  const blob = new Blob([BEISPIEL_CSV], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "preisliste-vorlage.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function PreislistenImportPage() {
  const [lieferanten, setLieferanten] = useState<Lieferant[]>([]);
  const [lieferantId, setLieferantId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [vorschlaege, setVorschlaege] = useState<Vorschlag[]>([]);
  const [ausgewaehlt, setAusgewaehlt] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [gespeichert, setGespeichert] = useState(false);
  const [fehler, setFehler] = useState("");

  useEffect(() => {
    fetch("/api/lieferanten").then(r => r.ok ? r.json() : []).then(d => setLieferanten(Array.isArray(d) ? d : []));
  }, []);

  async function analysieren() {
    if (!file || !lieferantId) return;
    setLoading(true); setFehler(""); setGespeichert(false); setVorschlaege([]);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("lieferantId", lieferantId);
    const res = await fetch("/api/preislisten-import", { method: "POST", body: fd });
    setLoading(false);
    if (!res.ok) { setFehler("Fehler beim Analysieren"); return; }
    const data: Vorschlag[] = await res.json();
    setVorschlaege(data);
    setAusgewaehlt(new Set(data.map(v => v.artikelLieferantId)));
  }

  async function uebernehmen() {
    const updates = vorschlaege
      .filter(v => ausgewaehlt.has(v.artikelLieferantId))
      .map(v => ({ artikelLieferantId: v.artikelLieferantId, neuerPreis: v.neuerPreis }));
    setLoading(true);
    const res = await fetch("/api/preislisten-import", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates }),
    });
    setLoading(false);
    if (res.ok) { setGespeichert(true); setVorschlaege([]); setFile(null); }
    else setFehler("Fehler beim Speichern");
  }

  const toggleAlle = () => {
    if (ausgewaehlt.size === vorschlaege.length) setAusgewaehlt(new Set());
    else setAusgewaehlt(new Set(vorschlaege.map(v => v.artikelLieferantId)));
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <h1 className="text-2xl font-bold flex-1">Preislisten-Import</h1>
        <Link href="/hilfe/import" className="text-sm text-green-700 hover:underline flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Import-Anleitung
        </Link>
      </div>

      {/* Aufklappbare Anleitung */}
      <details className="mb-6 bg-blue-50 border border-blue-200 rounded-xl overflow-hidden">
        <summary className="px-4 py-3 cursor-pointer font-medium text-blue-800 hover:bg-blue-100 transition-colors list-none flex items-center justify-between select-none">
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Anleitung: Welche Spalten werden erkannt?
          </span>
          <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </summary>
        <div className="px-4 pb-4 pt-2 border-t border-blue-200">
          <p className="text-sm text-blue-700 mb-4">
            Der Preislisten-Import liest Einkaufspreise aus deiner Lieferanten-Datei und schlägt dir
            Preisänderungen vor. Du wählst selbst welche Preise übernommen werden.
          </p>

          <div className="bg-white rounded-lg border border-blue-200 overflow-x-auto mb-4">
            <table className="w-full text-sm">
              <thead className="bg-blue-50 border-b border-blue-200">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold text-blue-800 text-xs uppercase tracking-wide">Spalte</th>
                  <th className="text-left px-3 py-2 font-semibold text-blue-800 text-xs uppercase tracking-wide">Erkannte Varianten</th>
                  <th className="text-left px-3 py-2 font-semibold text-blue-800 text-xs uppercase tracking-wide hidden sm:table-cell">Hinweis</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr className="hover:bg-gray-50">
                  <td className="px-3 py-2.5 font-medium text-gray-800">
                    Artikelnummer
                    <span className="ml-1.5 text-red-500 text-xs font-bold" title="Pflichtfeld">Pflicht</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {["Artikelnummer", "artikelnummer", "ArtNr"].map(v => (
                        <code key={v} className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono text-gray-700">{v}</code>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-500 hidden sm:table-cell">
                    Muss mit einer Artikelnummer in der Datenbank übereinstimmen
                  </td>
                </tr>
                <tr className="hover:bg-gray-50">
                  <td className="px-3 py-2.5 font-medium text-gray-800">Einkaufspreis</td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {["Einkaufspreis", "Preis", "preis"].map(v => (
                        <code key={v} className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono text-gray-700">{v}</code>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-500 hidden sm:table-cell">
                    Netto in Euro, Komma oder Punkt als Dezimaltrennzeichen
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            <button
              onClick={downloadBeispielCsv}
              className="inline-flex items-center gap-2 px-3 py-2 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Beispiel-Vorlage herunterladen
            </button>
            <Link href="/hilfe/import" className="text-sm text-blue-700 hover:underline">
              Vollständige Import-Anleitung ansehen
            </Link>
          </div>
        </div>
      </details>

      <Card className="mb-6 max-w-xl">
        <h2 className="font-semibold mb-4">Preisliste hochladen</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Lieferant</label>
            <select
              value={lieferantId}
              onChange={e => setLieferantId(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            >
              <option value="">-- Lieferant wählen --</option>
              {lieferanten.map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Preisliste (.xlsx, .xls, .csv)</label>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              className="w-full border rounded px-3 py-2 text-sm"
            />
            {file && (
              <p className="text-xs text-gray-500 mt-1">
                Ausgewählt: <span className="font-medium">{file.name}</span>
              </p>
            )}
          </div>
          <button
            onClick={analysieren}
            disabled={!file || !lieferantId || loading}
            className="bg-green-700 text-white px-4 py-2 rounded text-sm hover:bg-green-800 disabled:opacity-50"
          >
            {loading ? "Analysiere…" : "Analysieren & Vorschau laden"}
          </button>
        </div>
        {fehler && <p className="text-red-600 text-sm mt-2">{fehler}</p>}
        {gespeichert && <p className="text-green-700 text-sm mt-2 font-medium">&#x2713; Preise erfolgreich übernommen!</p>}
      </Card>

      {vorschlaege.length > 0 && (
        <Card>
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold">
              {vorschlaege.length} Artikel gefunden – {ausgewaehlt.size} ausgewählt
            </h2>
            <div className="flex gap-2">
              <button onClick={toggleAlle} className="text-sm text-green-700 hover:underline">
                {ausgewaehlt.size === vorschlaege.length ? "Alle abwählen" : "Alle auswählen"}
              </button>
              <button
                onClick={uebernehmen}
                disabled={ausgewaehlt.size === 0 || loading}
                className="bg-green-700 text-white px-4 py-2 rounded text-sm hover:bg-green-800 disabled:opacity-50"
              >
                {loading ? "Speichere…" : `${ausgewaehlt.size} Preise übernehmen`}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b text-xs uppercase">
                <th className="pb-2 w-8"><input type="checkbox" checked={ausgewaehlt.size === vorschlaege.length} onChange={toggleAlle} /></th>
                <th className="pb-2">Artikelnummer</th>
                <th className="pb-2">Artikel</th>
                <th className="pb-2 text-right">Alter Preis</th>
                <th className="pb-2 text-right">Neuer Preis</th>
                <th className="pb-2 text-right">Differenz</th>
              </tr>
            </thead>
            <tbody>
              {vorschlaege.map(v => (
                <tr key={v.artikelLieferantId} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="py-2">
                    <input
                      type="checkbox"
                      checked={ausgewaehlt.has(v.artikelLieferantId)}
                      onChange={() => {
                        const next = new Set(ausgewaehlt);
                        next.has(v.artikelLieferantId) ? next.delete(v.artikelLieferantId) : next.add(v.artikelLieferantId);
                        setAusgewaehlt(next);
                      }}
                    />
                  </td>
                  <td className="py-2 font-mono text-xs">{v.artikelnummer}</td>
                  <td className="py-2">{v.artikelName}</td>
                  <td className="py-2 text-right">{formatEuro(v.alterPreis)}</td>
                  <td className="py-2 text-right font-medium">{formatEuro(v.neuerPreis)}</td>
                  <td className={`py-2 text-right font-medium ${v.differenz > 0 ? "text-red-600" : v.differenz < 0 ? "text-green-600" : "text-gray-400"}`}>
                    {v.differenz > 0 ? "+" : ""}{formatEuro(v.differenz)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </Card>
      )}
    </div>
  );
}
