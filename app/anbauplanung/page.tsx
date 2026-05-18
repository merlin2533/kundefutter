"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

interface Schlag {
  id: number;
  name: string;
  flaeche: number | null;
}

interface Anbauplan {
  id: number;
  schlagId: number;
  kundeId: number;
  jahr: number;
  fruchtart: string;
  sorte: string | null;
  aussaatDatum: string | null;
  ernteDatum: string | null;
  ertragDt: number | null;
  status: string;
  notiz: string | null;
  schlag: Schlag;
  kunde: { id: number; name: string; firma: string | null };
}

interface KundeOption {
  id: number;
  name: string;
  firma: string | null;
}

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  geplant: { bg: "bg-gray-100", text: "text-gray-600", label: "Geplant" },
  ausgesaet: { bg: "bg-green-100", text: "text-green-700", label: "Ausgesät" },
  geerntet: { bg: "bg-amber-100", text: "text-amber-700", label: "Geerntet" },
  abgebrochen: { bg: "bg-red-100", text: "text-red-600", label: "Abgebrochen" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.geplant;
  return (
    <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
}

function formatDatum(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
}

function AuflistungView({ plaene, onDelete }: { plaene: Anbauplan[]; onDelete: (id: number) => void }) {
  const [editing, setEditing] = useState<number | null>(null);
  const [editData, setEditData] = useState<Partial<Anbauplan>>({});

  async function saveEdit(id: number) {
    const res = await fetch(`/api/anbauplanung/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editData),
    });
    if (!res.ok) return;
    setEditing(null);
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-3 font-semibold text-gray-600">Schlag</th>
            <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden sm:table-cell">Fläche</th>
            <th className="text-left px-4 py-3 font-semibold text-gray-600">Fruchtart</th>
            <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">Sorte</th>
            <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden lg:table-cell">Aussaat</th>
            <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden lg:table-cell">Ernte</th>
            <th className="text-right px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">Ertrag</th>
            <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
            <th className="text-right px-4 py-3 font-semibold text-gray-600">Aktionen</th>
          </tr>
        </thead>
        <tbody>
          {plaene.map((p) =>
            editing === p.id ? (
              <tr key={p.id} className="border-b border-gray-50 bg-green-50">
                <td className="px-4 py-2 text-gray-600">{p.schlag.name}</td>
                <td className="px-4 py-2 hidden sm:table-cell text-gray-500">{p.schlag.flaeche ? `${p.schlag.flaeche} ha` : "—"}</td>
                <td className="px-4 py-2">
                  <input
                    type="text"
                    value={editData.fruchtart ?? p.fruchtart}
                    onChange={(e) => setEditData((d) => ({ ...d, fruchtart: e.target.value }))}
                    className="border border-gray-300 rounded px-2 py-1 text-xs w-full"
                  />
                </td>
                <td className="px-4 py-2 hidden md:table-cell">
                  <input
                    type="text"
                    value={editData.sorte ?? p.sorte ?? ""}
                    onChange={(e) => setEditData((d) => ({ ...d, sorte: e.target.value }))}
                    className="border border-gray-300 rounded px-2 py-1 text-xs w-full"
                  />
                </td>
                <td className="px-4 py-2 hidden lg:table-cell" />
                <td className="px-4 py-2 hidden lg:table-cell" />
                <td className="px-4 py-2 hidden md:table-cell">
                  <input
                    type="number"
                    value={editData.ertragDt ?? p.ertragDt ?? ""}
                    onChange={(e) => setEditData((d) => ({ ...d, ertragDt: e.target.value ? parseFloat(e.target.value) : null }))}
                    className="border border-gray-300 rounded px-2 py-1 text-xs w-20"
                    placeholder="dt/ha"
                  />
                </td>
                <td className="px-4 py-2">
                  <select
                    value={editData.status ?? p.status}
                    onChange={(e) => setEditData((d) => ({ ...d, status: e.target.value }))}
                    className="border border-gray-300 rounded px-2 py-1 text-xs bg-white"
                  >
                    {Object.entries(STATUS_STYLE).map(([v, s]) => (
                      <option key={v} value={v}>{s.label}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2 text-right">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => saveEdit(p.id)} className="text-xs px-2 py-1 bg-green-700 text-white rounded hover:bg-green-800">Speichern</button>
                    <button onClick={() => setEditing(null)} className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-50">✕</button>
                  </div>
                </td>
              </tr>
            ) : (
              <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-800">
                  {p.schlag.name}
                  <div className="sm:hidden text-xs text-gray-400 mt-0.5">
                    {p.schlag.flaeche ? `${p.schlag.flaeche} ha · ` : ""}{p.sorte ?? ""}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{p.schlag.flaeche ? `${p.schlag.flaeche} ha` : "—"}</td>
                <td className="px-4 py-3 text-gray-700">{p.fruchtart}</td>
                <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{p.sorte ?? "—"}</td>
                <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">{formatDatum(p.aussaatDatum)}</td>
                <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">{formatDatum(p.ernteDatum)}</td>
                <td className="px-4 py-3 text-right text-gray-700 hidden md:table-cell">{p.ertragDt ? `${p.ertragDt} dt/ha` : "—"}</td>
                <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => { setEditing(p.id); setEditData({}); }}
                      className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-50"
                    >
                      Bearbeiten
                    </button>
                    <button
                      onClick={() => onDelete(p.id)}
                      className="text-xs px-2 py-1 border border-red-200 text-red-600 rounded hover:bg-red-50"
                    >
                      Löschen
                    </button>
                  </div>
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}

function FruchtfolgeMatrix({ plaene, jahre }: { plaene: Anbauplan[]; jahre: number[] }) {
  // Schlags ermitteln
  const schlaege = Array.from(
    new Map(plaene.map((p) => [p.schlagId, p.schlag])).values()
  ).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
      <table className="text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-3 font-semibold text-gray-600 sticky left-0 bg-gray-50">Schlag</th>
            <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden sm:table-cell">ha</th>
            {jahre.map((j) => (
              <th key={j} className="text-center px-4 py-3 font-semibold text-gray-600 min-w-[100px]">{j}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {schlaege.map((schlag) => (
            <tr key={schlag.id} className="border-b border-gray-50">
              <td className="px-4 py-3 font-medium text-gray-800 sticky left-0 bg-white">{schlag.name}</td>
              <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{schlag.flaeche ? `${schlag.flaeche}` : "—"}</td>
              {jahre.map((j) => {
                const plan = plaene.find((p) => p.schlagId === schlag.id && p.jahr === j);
                return (
                  <td key={j} className="px-3 py-3 text-center">
                    {plan ? (
                      <div>
                        <span className="font-medium text-gray-700 text-xs">{plan.fruchtart}</span>
                        {plan.sorte && <div className="text-xs text-gray-400">{plan.sorte}</div>}
                        <StatusBadge status={plan.status} />
                      </div>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AnbauplanungContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const aktuellesJahr = new Date().getFullYear();
  const [jahr, setJahr] = useState(() => parseInt(searchParams.get("jahr") ?? String(aktuellesJahr), 10));
  const [kundeId, setKundeId] = useState(() => searchParams.get("kundeId") ?? "");
  const [schlagId, setSchlagId] = useState(searchParams.get("schlagId") ?? "");
  const [ansicht, setAnsicht] = useState<"liste" | "fruchtfolge">("liste");

  const [plaene, setPlaene] = useState<Anbauplan[]>([]);
  const [loading, setLoading] = useState(false);
  const [kunden, setKunden] = useState<KundeOption[]>([]);
  const [kundeSearch, setKundeSearch] = useState("");
  const [schlaegte, setSchlaegte] = useState<Schlag[]>([]);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (kundeId) params.set("kundeId", kundeId);
    if (schlagId) params.set("schlagId", schlagId);
    if (ansicht === "liste") params.set("jahr", String(jahr));
    else if (kundeId) {
      // Fruchtfolge: letzte 5 Jahre
      params.delete("jahr");
    }

    const res = await fetch(`/api/anbauplanung?${params}`);
    const d = await res.json();
    setPlaene(Array.isArray(d) ? d : []);
    setLoading(false);
  }

  useEffect(() => {
    // Persist filters in sessionStorage
    try {
      sessionStorage.setItem("anbauplanung-filters", JSON.stringify({ jahr, kundeId, schlagId }));
    } catch { /* ignore */ }
    load();
  }, [jahr, kundeId, schlagId, ansicht]);

  useEffect(() => {
    if (kundeId) {
      fetch(`/api/kunden/${kundeId}/schlaegte`)
        .then((r) => r.ok ? r.json() : [])
        .then((d) => setSchlaegte(Array.isArray(d) ? d : []));
    } else {
      setSchlaegte([]);
    }
  }, [kundeId]);

  useEffect(() => {
    if (kundeSearch.length < 2) { setKunden([]); return; }
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/kunden?search=${encodeURIComponent(kundeSearch)}&limit=10`);
      if (!res.ok) return;
      const d = await res.json();
      setKunden(Array.isArray(d) ? d : (d.kunden ?? []));
    }, 200);
    return () => clearTimeout(timer);
  }, [kundeSearch]);

  async function handleDelete(id: number) {
    if (!confirm("Anbauplan löschen?")) return;
    await fetch(`/api/anbauplanung?id=${id}`, { method: "DELETE" });
    load();
  }

  const jahre5 = Array.from({ length: 5 }, (_, i) => aktuellesJahr - 2 + i);

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">Anbauplanung</h1>
          <p className="text-sm text-gray-500 mt-0.5">Fruchtfolge und Anbauplanung je Schlag</p>
        </div>
        <Link
          href="/anbauplanung/neu"
          className="px-4 py-2 bg-green-700 hover:bg-green-800 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          + Anbauplan erstellen
        </Link>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex flex-wrap gap-3 items-end">
        {/* Kundenauswahl */}
        <div className="relative">
          <label className="block text-xs font-medium text-gray-500 mb-1">Kunde</label>
          <input
            type="text"
            value={kundeSearch}
            onChange={(e) => { setKundeSearch(e.target.value); if (!e.target.value) { setKundeId(""); setSchlagId(""); } }}
            placeholder="Kundensuche…"
            className="border border-gray-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 w-48"
          />
          {kunden.length > 0 && (
            <div className="absolute top-full left-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10 mt-1 w-64 max-h-40 overflow-y-auto">
              {kunden.map((k) => (
                <button
                  key={k.id}
                  onClick={() => { setKundeId(String(k.id)); setKundeSearch(k.firma ?? k.name); setKunden([]); setSchlagId(""); }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-green-50 border-b border-gray-50 last:border-0"
                >
                  {k.firma ?? k.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Schlag */}
        {schlaegte.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Schlag</label>
            <select
              value={schlagId}
              onChange={(e) => setSchlagId(e.target.value)}
              className="border border-gray-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 bg-white"
            >
              <option value="">Alle</option>
              {schlaegte.map((s) => (
                <option key={s.id} value={String(s.id)}>{s.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Jahr-Navigation */}
        {ansicht === "liste" && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Jahr</label>
            <div className="flex items-center gap-1">
              <button onClick={() => setJahr((j) => j - 1)} className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-50 text-gray-600">←</button>
              <span className="w-16 text-center text-sm font-semibold">{jahr}</span>
              <button onClick={() => setJahr((j) => j + 1)} className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-50 text-gray-600">→</button>
            </div>
          </div>
        )}

        {/* Ansicht Toggle */}
        {kundeId && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Ansicht</label>
            <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm">
              <button
                onClick={() => setAnsicht("liste")}
                className={`px-3 py-1.5 transition-colors ${ansicht === "liste" ? "bg-green-700 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
              >
                Liste
              </button>
              <button
                onClick={() => setAnsicht("fruchtfolge")}
                className={`px-3 py-1.5 transition-colors border-l border-gray-300 ${ansicht === "fruchtfolge" ? "bg-green-700 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
              >
                Fruchtfolge
              </button>
            </div>
          </div>
        )}
      </div>

      {loading && <p className="text-sm text-gray-400 mt-4">Lade…</p>}

      {!loading && plaene.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
          Keine Anbauplaene gefunden.{" "}
          <Link href="/anbauplanung/neu" className="text-green-700 hover:underline">Jetzt erstellen →</Link>
        </div>
      )}

      {!loading && plaene.length > 0 && (
        <>
          {ansicht === "liste" ? (
            <AuflistungView plaene={plaene} onDelete={handleDelete} />
          ) : (
            <FruchtfolgeMatrix plaene={plaene} jahre={jahre5} />
          )}
          <p className="text-xs text-gray-400 mt-2">{plaene.length} Einträge</p>
        </>
      )}
    </div>
  );
}

export default function AnbauplanungPage() {
  return (
    <Suspense fallback={<p className="text-gray-400 text-sm mt-8">Lade…</p>}>
      <AnbauplanungContent />
    </Suspense>
  );
}
