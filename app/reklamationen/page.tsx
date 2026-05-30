"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import SearchableSelect from "@/components/SearchableSelect";

interface KundeOption {
  id: number;
  name: string;
  firma: string | null;
}

interface Reklamation {
  id: number;
  nummer: string;
  datum: string;
  betreff: string;
  kategorie: string;
  prioritaet: string;
  status: string;
  zugewiesen: string | null;
  geloestAm: string | null;
  kunde: { id: number; name: string; firma: string | null };
  lieferung: { id: number; datum: string; rechnungNr: string | null } | null;
}

// ─── Badge helpers ────────────────────────────────────────────────────────────

function KategorieBadge({ k }: { k: string }) {
  const map: Record<string, string> = {
    Qualitaet: "bg-yellow-100 text-yellow-800",
    Menge: "bg-blue-100 text-blue-800",
    Lieferung: "bg-orange-100 text-orange-800",
    Preis: "bg-green-100 text-green-800",
    Sonstiges: "bg-gray-100 text-gray-700",
  };
  const label: Record<string, string> = {
    Qualitaet: "Qualität",
    Menge: "Menge",
    Lieferung: "Lieferung",
    Preis: "Preis",
    Sonstiges: "Sonstiges",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[k] ?? "bg-gray-100 text-gray-700"}`}>
      {label[k] ?? k}
    </span>
  );
}

function PrioBadge({ p }: { p: string }) {
  const map: Record<string, string> = {
    kritisch: "bg-red-100 text-red-800",
    hoch: "bg-orange-100 text-orange-800",
    normal: "bg-blue-100 text-blue-700",
    niedrig: "bg-gray-100 text-gray-600",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[p] ?? "bg-gray-100 text-gray-700"}`}>
      {p.charAt(0).toUpperCase() + p.slice(1)}
    </span>
  );
}

function StatusBadge({ s }: { s: string }) {
  const map: Record<string, string> = {
    OFFEN: "bg-yellow-100 text-yellow-800",
    IN_BEARBEITUNG: "bg-blue-100 text-blue-800",
    GELOEST: "bg-green-100 text-green-800",
    GESCHLOSSEN: "bg-gray-100 text-gray-700",
  };
  const label: Record<string, string> = {
    OFFEN: "Offen",
    IN_BEARBEITUNG: "In Bearbeitung",
    GELOEST: "Gelöst",
    GESCHLOSSEN: "Geschlossen",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[s] ?? "bg-gray-100 text-gray-700"}`}>
      {label[s] ?? s}
    </span>
  );
}

// ─── Inner component (uses useSearchParams) ───────────────────────────────────

function ReklamationenInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [reklamationen, setReklamationen] = useState<Reklamation[]>([]);
  const [kunden, setKunden] = useState<KundeOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterStatus, setFilterStatus] = useState(searchParams.get("status") ?? "");
  const [filterPrio, setFilterPrio] = useState(searchParams.get("prioritaet") ?? "");
  const [filterKunde, setFilterKunde] = useState(searchParams.get("kundeId") ?? "");

  // Load kunden for filter select
  useEffect(() => {
    fetch("/api/kunden?limit=500&aktiv=true")
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setKunden(Array.isArray(d) ? d : d.kunden ?? []))
      .catch(() => {});
  }, []);

  const fetchReklamationen = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterStatus) params.set("status", filterStatus);
    if (filterPrio) params.set("prioritaet", filterPrio);
    if (filterKunde) params.set("kundeId", filterKunde);
    try {
      const res = await fetch(`/api/reklamationen?${params.toString()}`);
      if (!res.ok) { setReklamationen([]); return; }
      const data = await res.json();
      setReklamationen(Array.isArray(data) ? data : []);
    } catch {
      setReklamationen([]);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterPrio, filterKunde]);

  useEffect(() => { fetchReklamationen(); }, [fetchReklamationen]);

  // KPIs
  const offene = reklamationen.filter((r) => r.status === "OFFEN").length;
  const heute = new Date().toDateString();
  const heuteFaellig = reklamationen.filter((r) => {
    if (r.status === "GELOEST" || r.status === "GESCHLOSSEN") return false;
    return new Date(r.datum).toDateString() === heute;
  }).length;
  const geloest = reklamationen.filter((r) => r.geloestAm && r.status === "GELOEST");
  const avgLoese = geloest.length > 0
    ? geloest.reduce((sum, r) => {
        const days = Math.round((new Date(r.geloestAm!).getTime() - new Date(r.datum).getTime()) / 86400000);
        return sum + days;
      }, 0) / geloest.length
    : null;

  const kundenOptions = kunden.map((k) => ({
    value: k.id,
    label: k.firma ?? k.name,
    sub: k.firma ? k.name : undefined,
  }));

  return (
    <div className="max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reklamationen</h1>
          <p className="text-sm text-gray-500 mt-0.5">Kundenbeschwerden und Reklamationen verwalten</p>
        </div>
        <Link
          href="/reklamationen/neu"
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Neue Reklamation
        </Link>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Offene Reklamationen</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{offene}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Heute fällig</p>
          <p className="text-2xl font-bold text-orange-600 mt-1">{heuteFaellig}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 col-span-2 sm:col-span-1">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Ø Lösezeit</p>
          <p className="text-2xl font-bold text-green-700 mt-1">
            {avgLoese !== null ? `${avgLoese.toFixed(1)} Tage` : "–"}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs text-gray-500 mb-1">Kunde</label>
            <SearchableSelect
              options={kundenOptions}
              value={filterKunde}
              onChange={setFilterKunde}
              placeholder="Alle Kunden"
              allowClear
              clearLabel="Alle Kunden"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
            >
              <option value="">Alle Status</option>
              <option value="OFFEN">Offen</option>
              <option value="IN_BEARBEITUNG">In Bearbeitung</option>
              <option value="GELOEST">Gelöst</option>
              <option value="GESCHLOSSEN">Geschlossen</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Priorität</label>
            <select
              value={filterPrio}
              onChange={(e) => setFilterPrio(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
            >
              <option value="">Alle Prioritäten</option>
              <option value="kritisch">Kritisch</option>
              <option value="hoch">Hoch</option>
              <option value="normal">Normal</option>
              <option value="niedrig">Niedrig</option>
            </select>
          </div>
          {(filterStatus || filterPrio || filterKunde) && (
            <button
              onClick={() => { setFilterStatus(""); setFilterPrio(""); setFilterKunde(""); }}
              className="px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Filter zurücksetzen
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500 text-sm">Lade Reklamationen…</div>
        ) : reklamationen.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">Keine Reklamationen gefunden.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Nummer</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Datum</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Kunde</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Betreff</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Kategorie</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Priorität</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden xl:table-cell">Zugewiesen</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {reklamationen.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/reklamationen/${r.id}`} className="font-mono text-xs text-green-700 hover:text-green-900 hover:underline font-medium">
                        {r.nummer}
                      </Link>
                      <div className="sm:hidden text-xs text-gray-500 mt-0.5">
                        {new Date(r.datum).toLocaleDateString("de-DE")}
                        {" · "}
                        {r.kunde.firma ?? r.kunde.name}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">
                      {new Date(r.datum).toLocaleDateString("de-DE")}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <Link href={`/kunden/${r.kunde.id}`} className="text-gray-900 hover:text-green-700 hover:underline">
                        {r.kunde.firma ?? r.kunde.name}
                      </Link>
                      {r.kunde.firma && <div className="text-xs text-gray-500">{r.kunde.name}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-900 max-w-[200px] truncate">{r.betreff}</td>
                    <td className="px-4 py-3 hidden lg:table-cell"><KategorieBadge k={r.kategorie} /></td>
                    <td className="px-4 py-3 hidden lg:table-cell"><PrioBadge p={r.prioritaet} /></td>
                    <td className="px-4 py-3"><StatusBadge s={r.status} /></td>
                    <td className="px-4 py-3 text-gray-600 text-xs hidden xl:table-cell">{r.zugewiesen ?? "–"}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/reklamationen/${r.id}`}
                        className="text-xs text-green-700 hover:text-green-900 hover:underline font-medium"
                      >
                        Bearbeiten
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

export default function ReklamationenPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">Lade…</div>}>
      <ReklamationenInner />
    </Suspense>
  );
}
