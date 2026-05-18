"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

interface Zertifizierung {
  id: number;
  kundeId: number;
  typ: string;
  nummer: string | null;
  ausstellerOrg: string | null;
  ausstellungsdatum: string | null;
  ablaufdatum: string | null;
  status: string;
  notiz: string | null;
  kunde: { id: number; name: string; firma: string | null };
}

const TYPEN = ["QS", "GlobalGAP", "Bio/Öko", "Cross-Compliance", "Ernte-Plus", "DLG", "Sonstige"];

function formatDatum(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("de-DE");
}

function ablaufAmpel(ablaufdatum: string | null): { icon: string; bg: string; text: string; label: string } {
  if (!ablaufdatum) return { icon: "⚪", bg: "bg-gray-100", text: "text-gray-500", label: "Kein Ablaufdatum" };
  const diff = (new Date(ablaufdatum).getTime() - Date.now()) / 86400000;
  if (diff < 0) return { icon: "🔴", bg: "bg-red-50", text: "text-red-600", label: "Abgelaufen" };
  if (diff < 30) return { icon: "🟠", bg: "bg-orange-50", text: "text-orange-600", label: `< 30 Tage` };
  if (diff < 90) return { icon: "🟡", bg: "bg-amber-50", text: "text-amber-600", label: `${Math.round(diff)} Tage` };
  return { icon: "🟢", bg: "bg-green-50", text: "text-green-700", label: "Gültig" };
}

function ZertifizierungContent() {
  const searchParams = useSearchParams();
  const [zertifizierungen, setZertifizierungen] = useState<Zertifizierung[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTyp, setFilterTyp] = useState(searchParams.get("typ") ?? "");
  const [filterStatus, setFilterStatus] = useState(searchParams.get("status") ?? "");
  const [kundeSearch, setKundeSearch] = useState("");

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterTyp) params.set("typ", filterTyp);
    const res = await fetch(`/api/zertifizierungen?${params}`);
    const d = await res.json();
    setZertifizierungen(Array.isArray(d) ? d : []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [filterTyp]);

  async function handleDelete(id: number) {
    if (!confirm("Zertifizierung löschen?")) return;
    await fetch(`/api/zertifizierungen/${id}`, { method: "DELETE" });
    load();
  }

  const filtered = zertifizierungen.filter((z) => {
    if (filterStatus === "abgelaufen") return ablaufAmpel(z.ablaufdatum).label === "Abgelaufen";
    if (filterStatus === "bald") {
      const diff = z.ablaufdatum ? (new Date(z.ablaufdatum).getTime() - Date.now()) / 86400000 : Infinity;
      return diff >= 0 && diff < 90;
    }
    if (kundeSearch) {
      const label = (z.kunde.firma ?? z.kunde.name).toLowerCase();
      return label.includes(kundeSearch.toLowerCase());
    }
    return true;
  });

  // KPI-Counts
  const abgelaufen = zertifizierungen.filter((z) => ablaufAmpel(z.ablaufdatum).label === "Abgelaufen").length;
  const baldAblaufend = zertifizierungen.filter((z) => {
    const diff = z.ablaufdatum ? (new Date(z.ablaufdatum).getTime() - Date.now()) / 86400000 : Infinity;
    return diff >= 0 && diff < 90;
  }).length;
  const gueltig = zertifizierungen.filter((z) => {
    if (!z.ablaufdatum) return false;
    const diff = (new Date(z.ablaufdatum).getTime() - Date.now()) / 86400000;
    return diff >= 90;
  }).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">Zertifizierungen</h1>
          <p className="text-sm text-gray-500 mt-0.5">QS, GlobalGAP, Bio, Cross-Compliance u.a.</p>
        </div>
        <Link
          href="/zertifizierungen/neu"
          className="px-4 py-2 bg-green-700 hover:bg-green-800 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          + Neue Zertifizierung
        </Link>
      </div>

      {/* KPI-Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <button
          onClick={() => setFilterStatus(filterStatus === "abgelaufen" ? "" : "abgelaufen")}
          className={`rounded-xl border p-4 text-left transition-colors ${filterStatus === "abgelaufen" ? "border-red-400 bg-red-50" : "bg-white border-gray-200 hover:border-red-300"}`}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Abgelaufen</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{abgelaufen}</p>
        </button>
        <button
          onClick={() => setFilterStatus(filterStatus === "bald" ? "" : "bald")}
          className={`rounded-xl border p-4 text-left transition-colors ${filterStatus === "bald" ? "border-amber-400 bg-amber-50" : "bg-white border-gray-200 hover:border-amber-300"}`}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Bald ablaufend</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{baldAblaufend}</p>
        </button>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Gültig (&gt;90 Tage)</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{gueltig}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 mb-4 flex flex-wrap gap-3">
        <input
          type="text"
          value={kundeSearch}
          onChange={(e) => setKundeSearch(e.target.value)}
          placeholder="Kundensuche…"
          className="border border-gray-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 w-48"
        />
        <select
          value={filterTyp}
          onChange={(e) => { setFilterTyp(e.target.value); }}
          className="border border-gray-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 bg-white"
        >
          <option value="">Alle Typen</option>
          {TYPEN.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        {(filterStatus || filterTyp || kundeSearch) && (
          <button
            onClick={() => { setFilterStatus(""); setFilterTyp(""); setKundeSearch(""); }}
            className="text-sm text-gray-500 hover:text-gray-700 px-2 py-1 border border-gray-200 rounded"
          >
            Filter zurücksetzen
          </button>
        )}
        <span className="ml-auto text-xs text-gray-400 self-center">{filtered.length} Einträge</span>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 mt-4">Lade…</p>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
          Keine Zertifizierungen gefunden.{" "}
          <Link href="/zertifizierungen/neu" className="text-green-700 hover:underline">Jetzt erstellen →</Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Kunde</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Typ</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden sm:table-cell">Nummer</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">Aussteller</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden lg:table-cell">Ausstellungsdatum</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Ablaufdatum</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((z) => {
                const ampel = ablaufAmpel(z.ablaufdatum);
                return (
                  <tr key={z.id} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${ampel.bg}`}>
                    <td className="px-4 py-3">
                      <Link href={`/kunden/${z.kundeId}?tab=Zertifizierungen`} className="font-medium text-green-700 hover:underline">
                        {z.kunde.firma ?? z.kunde.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{z.typ}</td>
                    <td className="px-4 py-3 text-gray-500 hidden sm:table-cell font-mono text-xs">{z.nummer ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{z.ausstellerOrg ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">{formatDatum(z.ausstellungsdatum)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium ${ampel.text}`}>
                        {ampel.icon} {formatDatum(z.ablaufdatum)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ampel.bg} ${ampel.text}`}>
                        {ampel.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Link
                          href={`/zertifizierungen/${z.id}`}
                          className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                        >
                          Bearbeiten
                        </Link>
                        <button
                          onClick={() => handleDelete(z.id)}
                          className="text-xs px-2 py-1 border border-red-200 text-red-600 rounded hover:bg-red-50 transition-colors"
                        >
                          Löschen
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function ZertifizierungenPage() {
  return (
    <Suspense fallback={<p className="text-gray-400 text-sm mt-8">Lade…</p>}>
      <ZertifizierungContent />
    </Suspense>
  );
}
