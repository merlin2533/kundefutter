"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Card } from "@/components/Card";

interface Position {
  id: number; sorte: string; ertragDtHa?: number | null; proteinProzent?: number | null;
  feuchteProzent?: number | null; hektolitergew?: number | null; bonitur?: number | null;
}
interface Versuch {
  id: number; name: string; jahr: number; kultur: string; standort?: string | null;
  flaeche?: number | null; status: string;
  kunde?: { id: number; name: string } | null;
  positionen: Position[];
}

export default function Page() {
  const [liste, setListe] = useState<Versuch[]>([]);
  const [filterKultur, setFilterKultur] = useState("");
  const [filterJahr, setFilterJahr] = useState("");
  const [filterSorte, setFilterSorte] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/sortenversuche").then(r => r.ok ? r.json() : []).then(d => setListe(Array.isArray(d) ? d : [])).finally(() => setLoading(false));
  }, []);

  const gefiltert = useMemo(() => {
    return liste.filter(v => {
      if (filterKultur && v.kultur !== filterKultur) return false;
      if (filterJahr && String(v.jahr) !== filterJahr) return false;
      if (filterSorte && !v.positionen.some(p => p.sorte.toLowerCase().includes(filterSorte.toLowerCase()))) return false;
      return true;
    });
  }, [liste, filterKultur, filterJahr, filterSorte]);

  const kulturen = Array.from(new Set(liste.map(v => v.kultur))).sort();
  const jahre = Array.from(new Set(liste.map(v => v.jahr))).sort((a, b) => b - a);

  // Mehrjahres-Vergleich je Sorte
  const sortenVergleich = useMemo(() => {
    const map = new Map<string, { sorte: string; kultur: string; ertraege: { jahr: number; ertrag: number }[] }>();
    for (const v of liste) {
      for (const p of v.positionen) {
        if (p.ertragDtHa == null) continue;
        const key = `${v.kultur}|${p.sorte}`;
        if (!map.has(key)) map.set(key, { sorte: p.sorte, kultur: v.kultur, ertraege: [] });
        map.get(key)!.ertraege.push({ jahr: v.jahr, ertrag: p.ertragDtHa });
      }
    }
    return Array.from(map.values())
      .filter(s => s.ertraege.length >= 1)
      .map(s => ({
        ...s,
        durchschnitt: s.ertraege.reduce((a, b) => a + b.ertrag, 0) / s.ertraege.length,
      }))
      .sort((a, b) => b.durchschnitt - a.durchschnitt);
  }, [liste]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap justify-between items-center mb-6 gap-3">
        <h1 className="text-2xl font-bold">🌾 Sortenversuche / Demoflächen</h1>
        <Link href="/sortenversuche/neu" title="Neuer Versuch" className="inline-flex items-center gap-1.5 bg-green-700 text-white px-2.5 sm:px-4 py-2 rounded hover:bg-green-800">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          <span className="hidden sm:inline">Neuer Versuch</span>
        </Link>
      </div>

      <Card className="mb-4">
        <div className="flex flex-wrap gap-3">
          <select value={filterKultur} onChange={e => setFilterKultur(e.target.value)} className="border rounded px-3 py-2">
            <option value="">Alle Kulturen</option>
            {kulturen.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
          <select value={filterJahr} onChange={e => setFilterJahr(e.target.value)} className="border rounded px-3 py-2">
            <option value="">Alle Jahre</option>
            {jahre.map(j => <option key={j} value={j}>{j}</option>)}
          </select>
          <input type="text" placeholder="Sorte filtern…" value={filterSorte} onChange={e => setFilterSorte(e.target.value)} className="border rounded px-3 py-2 w-full sm:w-60" />
          <div className="ml-auto text-sm text-gray-500 flex items-center">{gefiltert.length} von {liste.length}</div>
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <h2 className="font-semibold mb-3">Versuche</h2>
          {loading ? <div className="text-gray-500">Lade…</div> : gefiltert.length === 0 ? (
            <div className="text-gray-500">Keine Versuche.</div>
          ) : (
            <div className="space-y-2">
              {gefiltert.map(v => (
                <Link href={`/sortenversuche/${v.id}`} key={v.id} className="block border rounded p-3 hover:bg-gray-50">
                  <div className="flex justify-between">
                    <strong>{v.name}</strong>
                    <span className="text-xs text-gray-500">{v.jahr} · {v.status}</span>
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    {v.kultur}{v.standort ? ` · ${v.standort}` : ""}{v.flaeche ? ` · ${v.flaeche} ha` : ""}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {v.positionen.length} Sorte{v.positionen.length !== 1 ? "n" : ""}: {v.positionen.slice(0, 4).map(p => p.sorte).join(", ")}{v.positionen.length > 4 ? "…" : ""}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h2 className="font-semibold mb-3">Sorten-Ranking (Mehrjahres-Vergleich)</h2>
          {sortenVergleich.length === 0 ? (
            <div className="text-gray-500">Noch keine Ertragsdaten.</div>
          ) : (
            <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead><tr className="text-left border-b"><th>Sorte</th><th>Kultur</th><th>∅ Ertrag</th><th>Jahre</th></tr></thead>
              <tbody>
                {sortenVergleich.slice(0, 20).map((s, i) => (
                  <tr key={i} className="border-b">
                    <td className="py-1 pr-2 font-medium">{s.sorte}</td>
                    <td className="py-1 pr-2">{s.kultur}</td>
                    <td className="py-1 pr-2">{s.durchschnitt.toFixed(1)} dt/ha</td>
                    <td className="py-1 pr-2 text-xs text-gray-600">
                      {s.ertraege.sort((a, b) => a.jahr - b.jahr).map(e => `${e.jahr}: ${e.ertrag}`).join(" · ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
