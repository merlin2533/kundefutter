"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Card } from "@/components/Card";
import { formatDatum } from "@/lib/utils";

interface Bodenprobe {
  id: number;
  schlagId: number;
  datum: string;
  probenNr?: string | null;
  labor?: string | null;
  auftragsNr?: string | null;
  tiefe?: string | null;
  pH?: number | null;
  phosphor?: number | null;
  kalium?: number | null;
  magnesium?: number | null;
  bor?: number | null;
  humus?: number | null;
  nMin?: number | null;
  bodenart?: string | null;
  klasse?: string | null; // deprecated
  klasseP?: string | null;
  klasseK?: string | null;
  klasseMg?: string | null;
  klasseBor?: string | null;
  empfehlungenJson?: string | null;
  belegPfad?: string | null;
  belegName?: string | null;
  schlag?: { id: number; name: string; kundeId: number; kunde?: { name: string } | null };
}

function klassenBadge(k?: string | null) {
  if (!k) return <span className="text-gray-300">–</span>;
  const farben: Record<string, string> = {
    A: "bg-red-100 text-red-800",
    B: "bg-orange-100 text-orange-800",
    C: "bg-green-100 text-green-800",
    D: "bg-blue-100 text-blue-800",
    E: "bg-purple-100 text-purple-800",
  };
  return <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-semibold ${farben[k] ?? "bg-gray-100 text-gray-700"}`}>{k}</span>;
}

export default function BodenprobenSeite() {
  const [proben, setProben] = useState<Bodenprobe[]>([]);
  const [filterLabor, setFilterLabor] = useState("");
  const [filterSchlag, setFilterSchlag] = useState("");
  const [filterKunde, setFilterKunde] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/bodenproben")
      .then(r => r.ok ? r.json() : [])
      .then(d => setProben(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, []);

  const gefiltert = useMemo(() => {
    return proben.filter(p => {
      if (filterLabor && !(p.labor ?? "").toLowerCase().includes(filterLabor.toLowerCase())) return false;
      if (filterSchlag && !(p.schlag?.name ?? "").toLowerCase().includes(filterSchlag.toLowerCase())) return false;
      if (filterKunde && !(p.schlag?.kunde?.name ?? "").toLowerCase().includes(filterKunde.toLowerCase())) return false;
      return true;
    });
  }, [proben, filterLabor, filterSchlag, filterKunde]);

  async function loeschen(id: number) {
    if (!confirm("Bodenprobe wirklich löschen?")) return;
    const r = await fetch(`/api/bodenproben?id=${id}`, { method: "DELETE" });
    if (r.ok) setProben(proben.filter(p => p.id !== id));
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap justify-between items-center mb-6 gap-3">
        <h1 className="text-2xl font-bold">🧪 Bodenproben</h1>
        <div className="flex gap-2">
          <Link href="/bodenproben/neu" className="bg-green-700 text-white px-4 py-2 rounded hover:bg-green-800">
            + Neue Probe
          </Link>
        </div>
      </div>

      <Card className="mb-4">
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Labor filtern…"
            value={filterLabor}
            onChange={e => setFilterLabor(e.target.value)}
            className="border rounded px-3 py-2 w-full sm:w-60"
          />
          <input
            type="text"
            placeholder="Schlag filtern…"
            value={filterSchlag}
            onChange={e => setFilterSchlag(e.target.value)}
            className="border rounded px-3 py-2 w-full sm:w-60"
          />
          <input
            type="text"
            placeholder="Kunde filtern…"
            value={filterKunde}
            onChange={e => setFilterKunde(e.target.value)}
            className="border rounded px-3 py-2 w-full sm:w-60"
          />
          <div className="ml-auto text-sm text-gray-500 flex items-center">
            {gefiltert.length} von {proben.length}
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="text-center text-gray-500 py-8">Lade…</div>
      ) : gefiltert.length === 0 ? (
        <Card>
          <div className="text-center text-gray-500 py-8">Keine Bodenproben gefunden.</div>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-3">Datum</th>
                  <th className="py-2 pr-3">Schlag</th>
                  <th className="py-2 pr-3 hidden md:table-cell">Labor</th>
                  <th className="py-2 pr-3 hidden md:table-cell">Tiefe</th>
                  <th className="py-2 pr-3">pH</th>
                  <th className="py-2 pr-3">P₂O₅</th>
                  <th className="py-2 pr-3">K₂O</th>
                  <th className="py-2 pr-3 hidden lg:table-cell">Mg</th>
                  <th className="py-2 pr-3 hidden lg:table-cell">Humus</th>
                  <th className="py-2 pr-3">N-Min</th>
                  <th className="py-2 pr-3" colSpan={4} title="Versorgungsklasse je Nährstoff (P/K/Mg/Bor)">Klasse P · K · Mg · B</th>
                  <th className="py-2 pr-3 hidden sm:table-cell">Beleg</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {gefiltert.map(p => (
                  <tr key={p.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 pr-3">{formatDatum(p.datum)}</td>
                    <td className="py-2 pr-3">
                      {p.schlag ? (
                        <Link className="text-green-700 hover:underline" href={`/kunden/${p.schlag.kundeId}#schlagkartei`}>
                          {p.schlag.name}
                        </Link>
                      ) : "–"}
                    </td>
                    <td className="py-2 pr-3 hidden md:table-cell">{p.labor ?? "–"}</td>
                    <td className="py-2 pr-3 hidden md:table-cell">{p.tiefe ?? "–"}</td>
                    <td className="py-2 pr-3">{p.pH ?? "–"}</td>
                    <td className="py-2 pr-3">{p.phosphor ?? "–"}</td>
                    <td className="py-2 pr-3">{p.kalium ?? "–"}</td>
                    <td className="py-2 pr-3 hidden lg:table-cell">{p.magnesium ?? "–"}</td>
                    <td className="py-2 pr-3 hidden lg:table-cell">{p.humus ?? "–"}</td>
                    <td className="py-2 pr-3">{p.nMin ?? "–"}</td>
                    <td className="py-1 pr-1 text-center">{klassenBadge(p.klasseP ?? p.klasse)}</td>
                    <td className="py-1 pr-1 text-center">{klassenBadge(p.klasseK ?? p.klasse)}</td>
                    <td className="py-1 pr-1 text-center">{klassenBadge(p.klasseMg ?? p.klasse)}</td>
                    <td className="py-1 pr-3 text-center">{klassenBadge(p.klasseBor)}</td>
                    <td className="py-2 pr-3 hidden sm:table-cell">
                      <div className="flex items-center gap-1">
                        {p.belegPfad ? (
                          <a
                            href={`/api/uploads/${p.belegPfad}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={p.belegName ?? "Beleg herunterladen"}
                            className="text-red-500 hover:text-red-700"
                          >
                            📄
                          </a>
                        ) : <span className="text-gray-300">–</span>}
                        {p.empfehlungenJson && (
                          <span title="Düngungsempfehlung aus PDF hinterlegt" className="text-green-700">📋</span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 text-right">
                      <button onClick={() => loeschen(p.id)} className="text-red-600 hover:underline">Löschen</button>
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
