"use client";
import { useEffect, useState } from "react";
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
    fetch("/api/lieferanten").then(r => r.json()).then(setLieferanten);
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
      <h1 className="text-2xl font-bold mb-6">Preislisten-Import</h1>

      <Card className="mb-6 max-w-xl">
        <h2 className="font-semibold mb-4">Excel-Datei hochladen</h2>
        <p className="text-sm text-gray-500 mb-4">
          Die Datei muss die Spalten <strong>Artikelnummer</strong> und <strong>Einkaufspreis</strong> enthalten.
          Optionale Spalte: <strong>Preis</strong> als Alternative zu Einkaufspreis.
        </p>
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
            <label className="block text-sm font-medium mb-1">Excel-Datei (.xlsx, .xls)</label>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={analysieren}
            disabled={!file || !lieferantId || loading}
            className="bg-green-700 text-white px-4 py-2 rounded text-sm hover:bg-green-800 disabled:opacity-50"
          >
            {loading ? "Analysiere…" : "Analysieren"}
          </button>
        </div>
        {fehler && <p className="text-red-600 text-sm mt-2">{fehler}</p>}
        {gespeichert && <p className="text-green-700 text-sm mt-2 font-medium">✓ Preise erfolgreich übernommen!</p>}
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
        </Card>
      )}
    </div>
  );
}
