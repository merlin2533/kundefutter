"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface Aufgabe {
  id: number;
  betreff: string;
  beschreibung: string | null;
  faelligAm: string | null;
  erledigt: boolean;
  erledigtAm: string | null;
  prioritaet: string;
  tags: string;
  typ: string;
  kundeId: number | null;
  erstellt: string;
  kunde: { id: number; name: string; firma: string | null } | null;
}

const PRIORITAET_BADGE: Record<string, string> = {
  kritisch: "bg-red-100 text-red-800 border border-red-300",
  hoch: "bg-orange-100 text-orange-800",
  normal: "bg-blue-100 text-blue-700",
  niedrig: "bg-gray-100 text-gray-600",
};

const TYP_BADGE: Record<string, string> = {
  aufgabe: "bg-yellow-100 text-yellow-800",
  anruf: "bg-blue-100 text-blue-700",
  besuch: "bg-purple-100 text-purple-700",
  email: "bg-teal-100 text-teal-700",
};

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("de-DE");
}

function isUeberfaellig(faelligAm: string | null, erledigt: boolean) {
  if (!faelligAm || erledigt) return false;
  return new Date(faelligAm) < new Date();
}

export default function AufgabenPage() {
  const [aufgaben, setAufgaben] = useState<Aufgabe[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"offen" | "erledigt" | "alle">("offen");
  const [prioritaet, setPrioritaet] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [toggling, setToggling] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  const fetchAufgaben = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("status", status);
    if (prioritaet) params.set("prioritaet", prioritaet);
    if (tagFilter.trim()) params.set("tag", tagFilter.trim());
    const res = await fetch(`/api/aufgaben?${params}`);
    const data = await res.json();
    setAufgaben(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [status, prioritaet, tagFilter]);

  useEffect(() => {
    const t = setTimeout(fetchAufgaben, 200);
    return () => clearTimeout(t);
  }, [fetchAufgaben]);

  async function toggleErledigt(a: Aufgabe) {
    setToggling(a.id);
    await fetch(`/api/aufgaben/${a.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ erledigt: !a.erledigt }),
    });
    await fetchAufgaben();
    setToggling(null);
  }

  async function deleteAufgabe(id: number, betreff: string) {
    if (!confirm(`Aufgabe "${betreff}" löschen?`)) return;
    setDeleting(id);
    await fetch(`/api/aufgaben/${id}`, { method: "DELETE" });
    setAufgaben((prev) => prev.filter((a) => a.id !== id));
    setDeleting(null);
  }

  const offeneCount = aufgaben.filter((a) => !a.erledigt).length;
  const ueberfaelligCount = aufgaben.filter((a) => isUeberfaellig(a.faelligAm, a.erledigt)).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Aufgaben</h1>
          {status === "offen" && (
            <p className="text-sm text-gray-500 mt-0.5">
              {offeneCount} offen
              {ueberfaelligCount > 0 && (
                <span className="ml-2 text-red-600 font-medium">{ueberfaelligCount} überfällig</span>
              )}
            </p>
          )}
        </div>
        <Link
          href="/aufgaben/neu"
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + Neue Aufgabe
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm">
          {(["offen", "erledigt", "alle"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-4 py-2 capitalize transition-colors ${
                status === s ? "bg-green-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50"
              } ${s !== "offen" ? "border-l border-gray-300" : ""}`}
            >
              {s === "offen" ? "Offen" : s === "erledigt" ? "Erledigt" : "Alle"}
            </button>
          ))}
        </div>
        <select
          value={prioritaet}
          onChange={(e) => setPrioritaet(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="">Alle Prioritäten</option>
          <option value="kritisch">Kritisch</option>
          <option value="hoch">Hoch</option>
          <option value="normal">Normal</option>
          <option value="niedrig">Niedrig</option>
        </select>
        <input
          type="text"
          placeholder="Tag filtern..."
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full sm:w-40 focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <p className="p-6 text-gray-400 text-sm">Lade Aufgaben…</p>
        ) : aufgaben.length === 0 ? (
          <p className="p-6 text-gray-400 text-sm">Keine Aufgaben gefunden.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 w-8"></th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Aufgabe</th>
                  <th className="hidden sm:table-cell text-left px-4 py-3 font-medium text-gray-600">Typ</th>
                  <th className="hidden md:table-cell text-left px-4 py-3 font-medium text-gray-600">Priorität</th>
                  <th className="hidden md:table-cell text-left px-4 py-3 font-medium text-gray-600">Fällig</th>
                  <th className="hidden lg:table-cell text-left px-4 py-3 font-medium text-gray-600">Kunde</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {aufgaben.map((a) => {
                  const ueberfaellig = isUeberfaellig(a.faelligAm, a.erledigt);
                  let tags: string[] = [];
                  try { tags = JSON.parse(a.tags); } catch { /* empty */ }
                  return (
                    <tr
                      key={a.id}
                      className={`hover:bg-gray-50 transition-colors ${a.erledigt ? "opacity-60" : ""}`}
                    >
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleErledigt(a)}
                          disabled={toggling === a.id}
                          title={a.erledigt ? "Als offen markieren" : "Als erledigt markieren"}
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors disabled:opacity-50 ${
                            a.erledigt
                              ? "bg-green-500 border-green-500 text-white"
                              : "border-gray-400 hover:border-green-500"
                          }`}
                        >
                          {a.erledigt && (
                            <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M2 6l3 3 5-5" />
                            </svg>
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-medium ${a.erledigt ? "line-through text-gray-400" : ""}`}>
                          {a.betreff}
                        </span>
                        {a.beschreibung && (
                          <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{a.beschreibung}</div>
                        )}
                        {tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {tags.map((t) => (
                              <span key={t} className="px-1.5 py-0.5 bg-green-100 text-green-800 rounded-full text-xs">{t}</span>
                            ))}
                          </div>
                        )}
                        {/* Mobile info */}
                        <div className="sm:hidden text-xs text-gray-500 mt-0.5">
                          {a.kunde?.name && <span>{a.kunde.name} · </span>}
                          {a.faelligAm && (
                            <span className={ueberfaellig ? "text-red-600 font-medium" : ""}>
                              Fällig: {formatDate(a.faelligAm)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="hidden sm:table-cell px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${TYP_BADGE[a.typ] ?? "bg-gray-100 text-gray-600"}`}>
                          {a.typ}
                        </span>
                      </td>
                      <td className="hidden md:table-cell px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${PRIORITAET_BADGE[a.prioritaet] ?? "bg-gray-100 text-gray-600"}`}>
                          {a.prioritaet}
                        </span>
                      </td>
                      <td className={`hidden md:table-cell px-4 py-3 text-sm ${ueberfaellig ? "text-red-600 font-medium" : "text-gray-600"}`}>
                        {ueberfaellig && <span className="mr-1">⚠</span>}
                        {formatDate(a.faelligAm)}
                      </td>
                      <td className="hidden lg:table-cell px-4 py-3 text-gray-600">
                        {a.kunde ? (
                          <Link href={`/kunden/${a.kunde.id}`} className="hover:underline text-green-700">
                            {a.kunde.name}
                            {a.kunde.firma && <span className="text-gray-500"> ({a.kunde.firma})</span>}
                          </Link>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Link href={`/aufgaben/${a.id}`} className="text-green-700 hover:underline text-xs font-medium">
                            Bearbeiten
                          </Link>
                          <button
                            onClick={() => deleteAufgabe(a.id, a.betreff)}
                            disabled={deleting === a.id}
                            className="text-red-500 hover:text-red-700 text-xs disabled:opacity-40"
                            title="Löschen"
                          >
                            {deleting === a.id ? "…" : "✕"}
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
    </div>
  );
}
