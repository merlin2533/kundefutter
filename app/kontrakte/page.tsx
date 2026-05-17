"use client";
import { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import SearchableSelect from "@/components/SearchableSelect";

interface KontraktPosition {
  id: number;
  menge: number;
  mengeAbgerufen: number;
  einheit: string;
  artikel: { id: number; name: string } | null;
}

interface Kontrakt {
  id: number;
  nummer: string;
  gueltigVon: string;
  gueltigBis: string;
  status: string;
  notiz: string | null;
  kundeId: number;
  kunde: { id: number; name: string; firma: string | null } | null;
  positionen: KontraktPosition[];
}

interface Kunde {
  id: number;
  name: string;
  firma: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  AKTIV: "bg-green-100 text-green-800",
  ABGESCHLOSSEN: "bg-gray-100 text-gray-600",
  STORNIERT: "bg-red-100 text-red-700",
};

const STATUS_LABELS: Record<string, string> = {
  AKTIV: "Aktiv",
  ABGESCHLOSSEN: "Abgeschlossen",
  STORNIERT: "Storniert",
};

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? "bg-gray-100 text-gray-600";
  const label = STATUS_LABELS[status] ?? status;
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>{label}</span>;
}

function AblaufBadge({ gueltigBis }: { gueltigBis: string }) {
  const bis = new Date(gueltigBis);
  const now = new Date();
  const diffDays = Math.ceil((bis.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) {
    return <span className="ml-1 px-1.5 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">Abgelaufen</span>;
  }
  if (diffDays <= 30) {
    return <span className="ml-1 px-1.5 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full">läuft ab in {diffDays}d</span>;
  }
  return null;
}

function AbrufFortschritt({ positionen }: { positionen: KontraktPosition[] }) {
  const gesamt = positionen.reduce((s, p) => s + p.menge, 0);
  const abgerufen = positionen.reduce((s, p) => s + p.mengeAbgerufen, 0);
  if (gesamt === 0) return <span className="text-gray-400 text-xs">—</span>;
  const pct = Math.min(100, Math.round((abgerufen / gesamt) * 100));
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full ${pct >= 100 ? "bg-green-500" : pct > 50 ? "bg-blue-500" : "bg-orange-400"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-gray-600 whitespace-nowrap">{pct}%</span>
    </div>
  );
}

function KontrakteListeInner() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<Kontrakt[]>([]);
  const [loading, setLoading] = useState(true);
  const [kunden, setKunden] = useState<Kunde[]>([]);
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") ?? "");
  const [kundeId, setKundeId] = useState(searchParams.get("kundeId") ?? "");

  useEffect(() => {
    fetch("/api/kunden?limit=500")
      .then((r) => r.json())
      .then((d) => setKunden(Array.isArray(d) ? d : (d.kunden ?? [])))
      .catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (kundeId) params.set("kundeId", kundeId);
    try {
      const res = await fetch(`/api/kontrakte?${params}`);
      if (!res.ok) { setLoading(false); return; }
      const d = await res.json();
      setData(Array.isArray(d) ? d : []);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [statusFilter, kundeId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const kundenOptions = kunden.map((k) => ({
    value: k.id,
    label: k.firma ?? k.name,
    sub: k.firma ? k.name : undefined,
  }));

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-900">Kontrakte</h1>
        <Link
          href="/kontrakte/neu"
          title="Neuer Kontrakt"
          className="inline-flex items-center gap-1.5 bg-green-700 text-white px-2.5 sm:px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-800 transition-colors"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          <span className="hidden sm:inline">Neuer Kontrakt</span>
        </Link>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="">Alle Status</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <div className="w-full sm:w-64">
          <SearchableSelect
            options={kundenOptions}
            value={kundeId}
            onChange={setKundeId}
            placeholder="Alle Kunden"
            allowClear
          />
        </div>
        {(statusFilter || kundeId) && (
          <button
            onClick={() => { setStatusFilter(""); setKundeId(""); }}
            className="text-sm text-gray-500 hover:text-gray-700 border border-gray-300 px-3 py-2 rounded-lg"
          >
            Filter zurücksetzen
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <p className="p-6 text-gray-400 text-sm">Lade Kontrakte…</p>
        ) : data.length === 0 ? (
          <p className="p-6 text-gray-400 text-sm">Keine Kontrakte gefunden.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Nummer</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Kunde</th>
                  <th className="hidden sm:table-cell text-left px-4 py-3 font-medium text-gray-600">Gültig von/bis</th>
                  <th className="hidden md:table-cell text-left px-4 py-3 font-medium text-gray-600">Positionen</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="hidden lg:table-cell text-left px-4 py-3 font-medium text-gray-600">Abruf</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">{item.nummer}</td>
                    <td className="px-4 py-3">
                      {item.kunde ? (
                        <Link href={`/kunden/${item.kunde.id}`} className="text-green-700 hover:underline">
                          {item.kunde.firma ?? item.kunde.name}
                        </Link>
                      ) : "—"}
                      <div className="sm:hidden text-xs text-gray-500 mt-0.5">
                        {new Date(item.gueltigVon).toLocaleDateString("de-DE")} – {new Date(item.gueltigBis).toLocaleDateString("de-DE")}
                      </div>
                    </td>
                    <td className="hidden sm:table-cell px-4 py-3 text-gray-600 whitespace-nowrap">
                      {new Date(item.gueltigVon).toLocaleDateString("de-DE")}
                      {" – "}
                      {new Date(item.gueltigBis).toLocaleDateString("de-DE")}
                      <AblaufBadge gueltigBis={item.gueltigBis} />
                    </td>
                    <td className="hidden md:table-cell px-4 py-3 text-gray-600">
                      {item.positionen.length}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="hidden lg:table-cell px-4 py-3">
                      <AbrufFortschritt positionen={item.positionen} />
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/kontrakte/${item.id}`} className="text-green-700 hover:underline text-xs font-medium">
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

export default function KontraktePage() {
  return (
    <Suspense fallback={<div className="container mx-auto px-4 py-8 text-gray-400">Lade…</div>}>
      <KontrakteListeInner />
    </Suspense>
  );
}
