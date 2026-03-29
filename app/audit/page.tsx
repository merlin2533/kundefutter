"use client";
import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/Card";
import { AuditAktionBadge } from "@/components/Badge";
import { formatDatum } from "@/lib/utils";

interface AuditEntry {
  id: number;
  zeitpunkt: string;
  entitaet: string;
  entitaetId: number;
  aktion: string;
  feld: string | null;
  alterWert: string | null;
  neuerWert: string | null;
  beschreibung: string | null;
}

const ENTITAETEN = ["", "Kunde", "Artikel", "Lieferung", "Lager"];
const LIMIT = 50;

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [entitaet, setEntitaet] = useState("");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const laden = useCallback(async (reset = false) => {
    setLoading(true);
    const o = reset ? 0 : offset;
    const params = new URLSearchParams({ limit: String(LIMIT), offset: String(o) });
    if (entitaet) params.set("entitaet", entitaet);
    try {
      const res = await fetch(`/api/audit?${params}`);
      if (!res.ok) return;
      const data: AuditEntry[] = await res.json();
      if (reset) {
        setEntries(data);
        setOffset(data.length);
      } else {
        setEntries((prev) => [...prev, ...data]);
        setOffset(o + data.length);
      }
      setHasMore(data.length === LIMIT);
    } finally {
      setLoading(false);
    }
  }, [entitaet, offset]);

  useEffect(() => {
    setOffset(0);
    laden(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entitaet]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Änderungshistorie</h1>

      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={entitaet}
          onChange={(e) => setEntitaet(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
        >
          <option value="">Alle Entitäten</option>
          {ENTITAETEN.filter(Boolean).map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
      </div>

      <Card>
        {entries.length === 0 && !loading ? (
          <p className="text-gray-500 text-sm">Keine Einträge gefunden.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b text-xs uppercase">
                  <th className="pb-2">Zeitpunkt</th>
                  <th className="pb-2">Entität</th>
                  <th className="pb-2 hidden sm:table-cell">ID</th>
                  <th className="pb-2">Aktion</th>
                  <th className="pb-2 hidden md:table-cell">Feld</th>
                  <th className="pb-2 hidden md:table-cell">Alter Wert</th>
                  <th className="pb-2 hidden md:table-cell">Neuer Wert</th>
                  <th className="pb-2 hidden lg:table-cell">Beschreibung</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-2.5 whitespace-nowrap text-gray-600">{formatDatum(e.zeitpunkt)}</td>
                    <td className="py-2.5 font-medium">{e.entitaet}</td>
                    <td className="py-2.5 hidden sm:table-cell text-gray-500">#{e.entitaetId}</td>
                    <td className="py-2.5"><AuditAktionBadge aktion={e.aktion} /></td>
                    <td className="py-2.5 hidden md:table-cell text-gray-600">{e.feld ?? "–"}</td>
                    <td className="py-2.5 hidden md:table-cell text-red-600 max-w-[150px] truncate">{e.alterWert ?? "–"}</td>
                    <td className="py-2.5 hidden md:table-cell text-green-700 max-w-[150px] truncate">{e.neuerWert ?? "–"}</td>
                    <td className="py-2.5 hidden lg:table-cell text-gray-500 max-w-[200px] truncate">{e.beschreibung ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {hasMore && entries.length > 0 && (
          <div className="mt-4 text-center">
            <button
              onClick={() => laden(false)}
              disabled={loading}
              className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg disabled:opacity-50"
            >
              {loading ? "Lade..." : "Mehr laden"}
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}
