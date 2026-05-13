"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Card, KpiCard } from "@/components/Card";
import { formatDatum } from "@/lib/utils";

interface Eintrag {
  id: number; kundeId: number; typ: string; nummer?: string | null;
  ausstellung?: string | null; gueltigBis?: string | null;
  ausgestelltVon?: string | null; notiz?: string | null;
  kunde?: { id: number; name: string; firma?: string | null };
}

export default function Page() {
  const [liste, setListe] = useState<Eintrag[]>([]);
  const [filterTyp, setFilterTyp] = useState("");
  const [filterStatus, setFilterStatus] = useState<"alle" | "gueltig" | "ablaufend" | "abgelaufen">("alle");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/sachkundenachweise")
      .then(r => r.ok ? r.json() : [])
      .then(d => setListe(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, []);

  async function loeschen(id: number) {
    if (!confirm("Nachweis wirklich löschen?")) return;
    const r = await fetch(`/api/sachkundenachweise?id=${id}`, { method: "DELETE" });
    if (r.ok) setListe(liste.filter(l => l.id !== id));
  }

  const now = new Date();
  const grenz90 = new Date(now.getTime() + 90 * 86400000);

  const gefiltert = useMemo(() => {
    return liste.filter(e => {
      if (filterTyp && e.typ !== filterTyp) return false;
      const bis = e.gueltigBis ? new Date(e.gueltigBis) : null;
      if (filterStatus === "abgelaufen" && (!bis || bis >= now)) return false;
      if (filterStatus === "ablaufend" && (!bis || bis < now || bis > grenz90)) return false;
      if (filterStatus === "gueltig" && bis && bis < now) return false;
      return true;
    });
  }, [liste, filterTyp, filterStatus]);

  const abgelaufen = liste.filter(e => e.gueltigBis && new Date(e.gueltigBis) < now).length;
  const ablaufend = liste.filter(e => {
    if (!e.gueltigBis) return false;
    const d = new Date(e.gueltigBis);
    return d >= now && d <= grenz90;
  }).length;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap justify-between items-center mb-6 gap-3">
        <h1 className="text-2xl font-bold">📜 Sachkundenachweise</h1>
        <Link href="/sachkundenachweise/neu" className="bg-green-700 text-white px-4 py-2 rounded hover:bg-green-800">
          + Neuer Nachweis
        </Link>
      </div>

      <div className="grid sm:grid-cols-3 gap-3 mb-4">
        <KpiCard label="Gesamt" value={liste.length} color="blue" />
        <KpiCard label="Läuft in 90 Tagen ab" value={ablaufend} color="yellow" />
        <KpiCard label="Abgelaufen" value={abgelaufen} color="red" />
      </div>

      <Card className="mb-4">
        <div className="flex flex-wrap gap-3">
          <select value={filterTyp} onChange={e => setFilterTyp(e.target.value)} className="border rounded px-3 py-2">
            <option value="">Alle Typen</option>
            <option value="PSM-Sachkunde">PSM-Sachkunde</option>
            <option value="Spritzgeraetekontrolle">Spritzgerätekontrolle</option>
            <option value="Duengerschulung">Düngerschulung</option>
            <option value="Sprengstoff-Sachkunde">Sprengstoff-Sachkunde</option>
            <option value="Mais-Beize-Sachkunde">Mais-Beize</option>
            <option value="Wildlebensmittel-Schulung">Wildlebensmittel</option>
            <option value="Sonstige">Sonstige</option>
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as "alle" | "gueltig" | "ablaufend" | "abgelaufen")} className="border rounded px-3 py-2">
            <option value="alle">Alle Status</option>
            <option value="gueltig">Gültig</option>
            <option value="ablaufend">Läuft bald ab</option>
            <option value="abgelaufen">Abgelaufen</option>
          </select>
          <div className="ml-auto text-sm text-gray-500 flex items-center">
            {gefiltert.length} von {liste.length}
          </div>
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
                  <th className="py-2 pr-3">Kunde</th>
                  <th className="py-2 pr-3">Typ</th>
                  <th className="py-2 pr-3 hidden md:table-cell">Nummer</th>
                  <th className="py-2 pr-3 hidden md:table-cell">Ausgestellt</th>
                  <th className="py-2 pr-3">Gültig bis</th>
                  <th className="py-2 pr-3">Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {gefiltert.map(e => {
                  const bis = e.gueltigBis ? new Date(e.gueltigBis) : null;
                  const status = !bis ? "–" : bis < now ? "abgelaufen" : bis < grenz90 ? "ablaufend" : "gültig";
                  const cls = status === "abgelaufen" ? "text-red-700 bg-red-50" : status === "ablaufend" ? "text-yellow-800 bg-yellow-50" : status === "gültig" ? "text-green-700 bg-green-50" : "text-gray-500";
                  return (
                    <tr key={e.id} className="border-b hover:bg-gray-50">
                      <td className="py-2 pr-3">
                        {e.kunde ? (
                          <Link href={`/kunden/${e.kunde.id}`} className="text-green-700 hover:underline">
                            {e.kunde.firma ?? e.kunde.name}
                          </Link>
                        ) : "–"}
                      </td>
                      <td className="py-2 pr-3">{e.typ}</td>
                      <td className="py-2 pr-3 hidden md:table-cell">{e.nummer ?? "–"}</td>
                      <td className="py-2 pr-3 hidden md:table-cell">{e.ausstellung ? formatDatum(e.ausstellung) : "–"}</td>
                      <td className="py-2 pr-3">{e.gueltigBis ? formatDatum(e.gueltigBis) : "–"}</td>
                      <td className="py-2 pr-3"><span className={`px-2 py-0.5 rounded text-xs ${cls}`}>{status}</span></td>
                      <td className="py-2 text-right">
                        <button onClick={() => loeschen(e.id)} className="text-red-600 hover:underline">Löschen</button>
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
