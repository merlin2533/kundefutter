"use client";
import { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import SearchableSelect from "@/components/SearchableSelect";

interface Lieferant {
  id: number;
  name: string;
  firma: string | null;
}

interface Bestellung {
  id: number;
  nummer: string;
  datum: string;
  lieferdatum: string | null;
  status: string;
  notiz: string | null;
  lieferantId: number;
  lieferant: { id: number; name: string; firma: string | null } | null;
  _count: { positionen: number };
}

type Status = "OFFEN" | "BESTAETIGT" | "TEILGELIEFERT" | "ABGESCHLOSSEN" | "STORNIERT";

const STATUS_COLORS: Record<Status, string> = {
  OFFEN: "bg-yellow-100 text-yellow-800",
  BESTAETIGT: "bg-blue-100 text-blue-800",
  TEILGELIEFERT: "bg-orange-100 text-orange-800",
  ABGESCHLOSSEN: "bg-green-100 text-green-800",
  STORNIERT: "bg-gray-100 text-gray-600",
};

const STATUS_LABELS: Record<Status, string> = {
  OFFEN: "Offen",
  BESTAETIGT: "Bestätigt",
  TEILGELIEFERT: "Teilgeliefert",
  ABGESCHLOSSEN: "Abgeschlossen",
  STORNIERT: "Storniert",
};

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status as Status] ?? "bg-gray-100 text-gray-600";
  const label = STATUS_LABELS[status as Status] ?? status;
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>{label}</span>;
}

function BestellungenListeInner() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<Bestellung[]>([]);
  const [loading, setLoading] = useState(true);
  const [lieferanten, setLieferanten] = useState<Lieferant[]>([]);
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") ?? "");
  const [lieferantId, setLieferantId] = useState(searchParams.get("lieferantId") ?? "");

  useEffect(() => {
    fetch("/api/lieferanten?limit=500")
      .then((r) => r.json())
      .then((d) => setLieferanten(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (lieferantId) params.set("lieferantId", lieferantId);
    try {
      const res = await fetch(`/api/bestellungen?${params}`);
      if (!res.ok) { setLoading(false); return; }
      const d = await res.json();
      setData(Array.isArray(d) ? d : []);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [statusFilter, lieferantId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const lieferantenOptions = lieferanten.map((l) => ({
    value: l.id,
    label: l.firma ?? l.name,
    sub: l.firma ? l.name : undefined,
  }));

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-900">Lieferantenbestellungen</h1>
        <Link
          href="/bestellungen/neu"
          className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-800 transition-colors whitespace-nowrap"
        >
          + Neue Bestellung
        </Link>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="">Alle Status</option>
          {(Object.keys(STATUS_LABELS) as Status[]).map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
        <div className="w-full sm:w-64">
          <SearchableSelect
            options={lieferantenOptions}
            value={lieferantId}
            onChange={setLieferantId}
            placeholder="Alle Lieferanten"
            allowClear
          />
        </div>
        {(statusFilter || lieferantId) && (
          <button
            onClick={() => { setStatusFilter(""); setLieferantId(""); }}
            className="text-sm text-gray-500 hover:text-gray-700 border border-gray-300 px-3 py-2 rounded-lg"
          >
            Filter zurücksetzen
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <p className="p-6 text-gray-400 text-sm">Lade Bestellungen…</p>
        ) : data.length === 0 ? (
          <p className="p-6 text-gray-400 text-sm">Keine Bestellungen gefunden.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Nummer</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Datum</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Lieferant</th>
                  <th className="hidden sm:table-cell text-left px-4 py-3 font-medium text-gray-600">Positionen</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="hidden md:table-cell text-left px-4 py-3 font-medium text-gray-600">Lieferdatum</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">{item.nummer}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {new Date(item.datum).toLocaleDateString("de-DE")}
                      <div className="sm:hidden text-xs text-gray-500 mt-0.5">
                        {item._count.positionen} Pos.
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {item.lieferant ? (item.lieferant.firma ?? item.lieferant.name) : "—"}
                    </td>
                    <td className="hidden sm:table-cell px-4 py-3 text-gray-600">
                      {item._count.positionen}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="hidden md:table-cell px-4 py-3 text-gray-600">
                      {item.lieferdatum ? new Date(item.lieferdatum).toLocaleDateString("de-DE") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/bestellungen/${item.id}`} className="text-green-700 hover:underline text-xs font-medium">
                        Öffnen
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function BestellungenPage() {
  return (
    <Suspense fallback={<div className="container mx-auto px-4 py-8 text-gray-400">Lade…</div>}>
      <BestellungenListeInner />
    </Suspense>
  );
}
