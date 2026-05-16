"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { albrechtBewertung, albrechtAmpel, ALBRECHT_DISCLAIMER, BewertungErgebnis } from "@/lib/albrecht";

interface SchlagInfo {
  id: number;
  name: string;
  kundeId: number;
  kunde: { name: string };
}

interface Analyse {
  id: number;
  datum: string;
  probenId: string | null;
  kultur: string | null;
  tiefe: string | null;
  bodenart: string | null;
  phH2O: number | null;
  phKCl: number | null;
  kak: number | null;
  humus: number | null;
  caSaettigung: number | null;
  mgSaettigung: number | null;
  kSaettigung: number | null;
  naSaettigung: number | null;
  hSaettigung: number | null;
  variabelSaett: number | null;
  caVorrat: number | null;
  mgVorrat: number | null;
  kVorrat: number | null;
  naVorrat: number | null;
  schwefel: number | null;
  p2o5Verfuegbar: number | null;
  p2o5Vorrat: number | null;
  bor: number | null;
  eisen: number | null;
  mangan: number | null;
  kupfer: number | null;
  zink: number | null;
  chlorid: number | null;
  silizium: number | null;
  kobalt: number | null;
  molybdaen: number | null;
  selen: number | null;
  nGesamt: number | null;
  cn: number | null;
  nNachlieferung: number | null;
  caCo3: number | null;
  leitfaehigkeit: number | null;
  empfehlungenJson: string | null;
  notiz: string | null;
  belegPfad: string | null;
  belegName: string | null;
  schlag: SchlagInfo;
}

const STATUS_FARBE: Record<string, string> = {
  ok: "bg-green-500",
  niedrig: "bg-amber-400",
  hoch: "bg-amber-400",
  kritisch: "bg-red-500",
};

function StatusPunkt({ status }: { status: string }) {
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${STATUS_FARBE[status] ?? "bg-gray-300"}`} title={status} />;
}

function AmpelBadge({ analyse }: { analyse: Analyse }) {
  const amp = albrechtAmpel(analyse);
  const gesamt = amp.ok + amp.warn + amp.kritisch;
  if (gesamt === 0) return <span className="text-xs text-gray-400">—</span>;

  let cls = "bg-green-100 text-green-800";
  let label = "Gut";
  if (amp.kritisch > 0) { cls = "bg-red-100 text-red-800"; label = `${amp.kritisch} krit.`; }
  else if (amp.warn > 0) { cls = "bg-amber-100 text-amber-800"; label = `${amp.warn} Hinw.`; }

  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{label}</span>;
}

function BewertungTabelle({ bewertung }: { bewertung: BewertungErgebnis[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-separate border-spacing-0">
        <thead>
          <tr className="text-left text-gray-500">
            <th className="py-1 pr-3 font-medium">Parameter</th>
            <th className="py-1 pr-3 font-medium text-right">Ist</th>
            <th className="py-1 pr-3 font-medium text-right">Soll</th>
            <th className="py-1 pr-3 font-medium">Status</th>
            <th className="py-1 font-medium hidden sm:table-cell">Hinweis</th>
          </tr>
        </thead>
        <tbody>
          {bewertung.map((b) => (
            <tr key={b.parameter} className={b.status === "kritisch" ? "bg-red-50" : b.status !== "ok" ? "bg-amber-50" : ""}>
              <td className="py-1 pr-3 font-medium text-gray-700">{b.label}</td>
              <td className="py-1 pr-3 text-right tabular-nums">
                {b.ist !== null ? `${b.ist} ${b.einheit}` : <span className="text-gray-400">—</span>}
              </td>
              <td className="py-1 pr-3 text-right tabular-nums text-gray-500">
                {b.sollMin !== null && b.sollMax !== null
                  ? `${b.sollMin}–${b.sollMax} ${b.einheit}`
                  : b.sollMax !== null
                  ? `< ${b.sollMax} ${b.einheit}`
                  : b.sollMin !== null
                  ? `≥ ${b.sollMin} ${b.einheit}`
                  : "—"}
              </td>
              <td className="py-1 pr-3">
                <StatusPunkt status={b.status} />
              </td>
              <td className="py-1 text-gray-600 leading-snug hidden sm:table-cell">
                {b.ist !== null ? b.hinweis : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmpfehlungenListe({ json }: { json: string | null }) {
  if (!json) return null;
  let items: { mittel: string; menge: string; einheit: string; prioritaet: string }[] = [];
  try { items = JSON.parse(json); } catch { return null; }
  if (!Array.isArray(items) || items.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="text-xs font-semibold text-gray-600 mb-1">Empfehlungen aus Bericht</p>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-gray-500">
            <th className="pr-3 font-medium">Mittel</th>
            <th className="pr-3 font-medium">Menge</th>
            <th className="pr-3 font-medium">Einheit</th>
            <th className="font-medium">Priorität</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} className="border-t border-gray-100">
              <td className="py-1 pr-3 font-medium text-gray-800">{item.mittel}</td>
              <td className="py-1 pr-3 tabular-nums">{item.menge}</td>
              <td className="py-1 pr-3">{item.einheit}</td>
              <td className="py-1">
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                  item.prioritaet === "hoch" ? "bg-red-100 text-red-700"
                  : item.prioritaet === "mittel" ? "bg-amber-100 text-amber-700"
                  : "bg-gray-100 text-gray-600"
                }`}>{item.prioritaet || "—"}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AlbrechtTab({ kundeId }: { kundeId: number }) {
  const [analysen, setAnalysen] = useState<Analyse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);

  useEffect(() => {
    fetch(`/api/bodenanalyse?kundeId=${kundeId}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d) => setAnalysen(Array.isArray(d) ? d : []))
      .catch(() => setError("Laden fehlgeschlagen"))
      .finally(() => setLoading(false));
  }, [kundeId]);

  const toggleExpanded = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Analyse wirklich löschen?")) return;
    const res = await fetch(`/api/bodenanalyse?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      setAnalysen((prev) => prev.filter((a) => a.id !== id));
    } else {
      alert("Löschen fehlgeschlagen");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="font-semibold text-gray-800">Albrecht-Bodenanalysen</h3>
          <p className="text-xs text-gray-500 mt-0.5">Geobüro Christophel / ALBRECHT PLUS</p>
        </div>
        <Link
          href={`/bodenanalyse/neu?kundeId=${kundeId}`}
          className="px-3 py-1.5 text-xs bg-green-700 hover:bg-green-800 text-white font-medium rounded-lg transition-colors"
        >
          + Neue Albrecht-Analyse
        </Link>
      </div>

      {/* Disclaimer */}
      <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-3 py-2 text-left"
          onClick={() => setDisclaimerOpen((v) => !v)}
        >
          <span className="text-xs font-semibold text-amber-800">⚠ Albrecht-Methode — kein Ersatz für DüV</span>
          <span className="text-amber-600 text-xs">{disclaimerOpen ? "▲" : "▼"}</span>
        </button>
        {disclaimerOpen && (
          <p className="px-3 pb-3 text-xs text-amber-700 leading-relaxed">{ALBRECHT_DISCLAIMER}</p>
        )}
      </div>

      {loading && <p className="text-sm text-gray-400">Lade…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && analysen.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          <p className="text-3xl mb-2">🌱</p>
          <p className="text-sm">Noch keine Albrecht-Analysen für diesen Kunden.</p>
          <Link href={`/bodenanalyse/neu?kundeId=${kundeId}`} className="text-green-700 hover:underline text-sm mt-1 inline-block">
            Erste Analyse anlegen →
          </Link>
        </div>
      )}

      {analysen.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Datum</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Schlag</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600 hidden sm:table-cell">Ca% Mg% K% H%</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Bewertung</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {analysen.map((a) => {
                const bew = albrechtBewertung(a);
                const isOpen = expanded.has(a.id);
                return (
                  <>
                    <tr
                      key={a.id}
                      className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer"
                      onClick={() => toggleExpanded(a.id)}
                    >
                      <td className="px-4 py-3 text-gray-800 font-medium whitespace-nowrap">
                        {new Date(a.datum).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}
                        {a.kultur && <div className="text-xs text-gray-400">{a.kultur}</div>}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {a.schlag.name}
                        {a.probenId && <div className="text-xs text-gray-400">{a.probenId}</div>}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <div className="flex gap-1 justify-center flex-wrap">
                          {[
                            { k: "caSaettigung", v: a.caSaettigung },
                            { k: "mgSaettigung", v: a.mgSaettigung },
                            { k: "kSaettigung", v: a.kSaettigung },
                            { k: "hSaettigung", v: a.hSaettigung },
                          ].map(({ k, v }) => {
                            const b = bew.find((x) => x.parameter === k);
                            return (
                              <span key={k} className="flex items-center gap-0.5" title={`${k}: ${v ?? "—"}%`}>
                                <StatusPunkt status={b?.status ?? "ok"} />
                                <span className="text-xs tabular-nums text-gray-600">{v !== null ? `${v}` : "—"}</span>
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <AmpelBadge analyse={a} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-xs text-gray-400">{isOpen ? "▲" : "▼"}</span>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr key={`${a.id}-detail`} className="bg-gray-50 border-t border-gray-100">
                        <td colSpan={5} className="px-6 py-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Basisdaten</p>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-700">
                                {a.bodenart && <><span className="text-gray-500">Bodenart:</span><span>{a.bodenart}</span></>}
                                {a.tiefe && <><span className="text-gray-500">Tiefe:</span><span>{a.tiefe}</span></>}
                                {a.phH2O !== null && <><span className="text-gray-500">pH (H₂O):</span><span>{a.phH2O}</span></>}
                                {a.phKCl !== null && <><span className="text-gray-500">pH (KCl):</span><span>{a.phKCl}</span></>}
                                {a.kak !== null && <><span className="text-gray-500">KAK:</span><span>{a.kak} mmol/100g</span></>}
                                {a.humus !== null && <><span className="text-gray-500">Humus:</span><span>{a.humus} %</span></>}
                                {a.cn !== null && <><span className="text-gray-500">C/N:</span><span>{a.cn}</span></>}
                                {a.nNachlieferung !== null && <><span className="text-gray-500">N-Nachlieferung:</span><span>{a.nNachlieferung} kg/ha</span></>}
                              </div>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Kationen-Vorräte</p>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-700">
                                {a.caVorrat !== null && <><span className="text-gray-500">Ca:</span><span>{a.caVorrat} kg/ha</span></>}
                                {a.mgVorrat !== null && <><span className="text-gray-500">Mg:</span><span>{a.mgVorrat} kg/ha</span></>}
                                {a.kVorrat !== null && <><span className="text-gray-500">K:</span><span>{a.kVorrat} kg/ha</span></>}
                                {a.naVorrat !== null && <><span className="text-gray-500">Na:</span><span>{a.naVorrat} kg/ha</span></>}
                                {a.p2o5Verfuegbar !== null && <><span className="text-gray-500">P₂O₅ verf.:</span><span>{a.p2o5Verfuegbar} kg/ha</span></>}
                              </div>
                            </div>
                          </div>

                          <div className="mb-4">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Albrecht-Bewertung</p>
                            <BewertungTabelle bewertung={bew} />
                          </div>

                          <EmpfehlungenListe json={a.empfehlungenJson} />

                          {a.notiz && (
                            <p className="mt-3 text-xs text-gray-600 bg-white border border-gray-200 rounded p-2">{a.notiz}</p>
                          )}

                          {a.belegPfad && (
                            <div className="mt-2">
                              <a href={a.belegPfad} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">
                                📎 {a.belegName ?? "Beleg öffnen"}
                              </a>
                            </div>
                          )}

                          <div className="mt-3 flex gap-2">
                            <button
                              className="text-xs text-red-600 hover:underline"
                              onClick={(e) => { e.stopPropagation(); handleDelete(a.id); }}
                            >
                              Löschen
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
