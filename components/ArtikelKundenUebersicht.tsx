"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Quelle = "lieferung" | "vorbestellung" | "angebot";

interface Vorgang {
  quelle: Quelle;
  status: string;
  kundeId: number;
  kundeName: string;
  kundeOrt: string | null;
  menge: number;
  einheit: string | null;
  datum: string;
  referenzId: number;
  referenzNr: string | null;
  chargeNr: string | null;
}

interface KundeGruppe {
  kundeId: number;
  kundeName: string;
  kundeOrt: string | null;
  geliefertMenge: number;
  offenMenge: number;
  offenNachQuelle: Record<Quelle, number>;
  letzteDatum: string;
  vorgaenge: Vorgang[];
}

const QUELLE_LABEL: Record<Quelle, string> = {
  lieferung: "Lieferungen",
  vorbestellung: "Vorbestellungen",
  angebot: "Angebote (unverbindlich)",
};

const OFFEN_BADGE: Record<Quelle, string> = {
  lieferung: "bg-blue-100 text-blue-800",
  vorbestellung: "bg-purple-100 text-purple-800",
  angebot: "bg-gray-100 text-gray-600",
};

const OFFEN_BADGE_LABEL: Record<Quelle, string> = {
  lieferung: "Auftrag",
  vorbestellung: "Vorbestellung",
  angebot: "Angebot (unverbindl.)",
};

function vorgangLink(v: Vorgang): string {
  if (v.quelle === "lieferung") return `/lieferungen/${v.referenzId}`;
  if (v.quelle === "vorbestellung") return `/vorbestellungen/${v.referenzId}`;
  return `/angebote/${v.referenzId}`;
}

function vorgangLabel(v: Vorgang): string {
  if (v.quelle === "lieferung") return `Lieferung #${v.referenzId}`;
  return v.referenzNr ?? `#${v.referenzId}`;
}

function istOffen(v: Vorgang): boolean {
  if (v.quelle === "lieferung") return v.status === "geplant";
  return true; // Vorbestellung (OFFEN/BESTAETIGT) und Angebot (OFFEN) sind stets "offen"
}

export default function ArtikelKundenUebersicht({ artikelId }: { artikelId: number }) {
  const [vorgaenge, setVorgaenge] = useState<Vorgang[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [aktiveQuellen, setAktiveQuellen] = useState<Set<Quelle>>(
    new Set<Quelle>(["lieferung", "vorbestellung", "angebot"])
  );
  const [chargeFilter, setChargeFilter] = useState("");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetch(`/api/artikel/${artikelId}/kunden`)
      .then((res) => {
        if (!res.ok) throw new Error("Fehler beim Laden");
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setVorgaenge(Array.isArray(data?.vorgaenge) ? data.vorgaenge : []);
      })
      .catch(() => {
        if (!cancelled) setError("Konnte Kundendaten nicht laden.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [artikelId]);

  function toggleQuelle(q: Quelle) {
    setAktiveQuellen((prev) => {
      const next = new Set(prev);
      if (next.has(q)) next.delete(q);
      else next.add(q);
      return next;
    });
  }

  function toggleExpand(kundeId: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(kundeId)) next.delete(kundeId);
      else next.add(kundeId);
      return next;
    });
  }

  const chargenOptionen = useMemo(
    () =>
      Array.from(new Set(vorgaenge.map((v) => v.chargeNr).filter((c): c is string => !!c))).sort(),
    [vorgaenge]
  );

  const gefiltert = useMemo(() => {
    const suche = chargeFilter.trim().toLowerCase();
    return vorgaenge.filter((v) => {
      if (!aktiveQuellen.has(v.quelle)) return false;
      if (suche && !(v.chargeNr && v.chargeNr.toLowerCase().includes(suche))) return false;
      return true;
    });
  }, [vorgaenge, aktiveQuellen, chargeFilter]);

  const gruppen = useMemo(() => {
    const map = new Map<number, KundeGruppe>();
    for (const v of gefiltert) {
      let g = map.get(v.kundeId);
      if (!g) {
        g = {
          kundeId: v.kundeId,
          kundeName: v.kundeName,
          kundeOrt: v.kundeOrt,
          geliefertMenge: 0,
          offenMenge: 0,
          offenNachQuelle: { lieferung: 0, vorbestellung: 0, angebot: 0 },
          letzteDatum: v.datum,
          vorgaenge: [],
        };
        map.set(v.kundeId, g);
      }
      if (v.quelle === "lieferung" && v.status === "geliefert") {
        g.geliefertMenge += v.menge;
      } else if (istOffen(v)) {
        g.offenMenge += v.menge;
        g.offenNachQuelle[v.quelle] += v.menge;
      }
      if (v.datum > g.letzteDatum) g.letzteDatum = v.datum;
      g.vorgaenge.push(v);
    }
    return Array.from(map.values()).sort((a, b) => (a.letzteDatum < b.letzteDatum ? 1 : -1));
  }, [gefiltert]);

  if (loading) return <p className="text-sm text-gray-500 py-6 text-center">Lädt…</p>;
  if (error) return <p className="text-sm text-red-600 py-6 text-center">{error}</p>;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex flex-wrap gap-2">
          {(["lieferung", "vorbestellung", "angebot"] as const).map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => toggleQuelle(q)}
              className={`text-xs px-2.5 py-1 rounded-full border font-medium ${
                aktiveQuellen.has(q)
                  ? "bg-green-700 text-white border-green-700"
                  : "bg-white text-gray-500 border-gray-300 hover:border-gray-400"
              }`}
            >
              {QUELLE_LABEL[q]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <input
            list="artikel-kunden-chargen"
            value={chargeFilter}
            onChange={(e) => setChargeFilter(e.target.value)}
            placeholder="Charge filtern…"
            className="text-xs border border-gray-300 rounded-lg px-2.5 py-1 w-40 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <datalist id="artikel-kunden-chargen">
            {chargenOptionen.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          {chargeFilter && (
            <button
              type="button"
              onClick={() => setChargeFilter("")}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {gruppen.length === 0 ? (
        <p className="text-sm text-gray-500 py-6 text-center">
          Noch keine Lieferungen/Aufträge für diesen Artikel{chargeFilter ? " mit dieser Charge" : ""}.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                <th className="py-2 pr-3">Kunde</th>
                <th className="py-2 pr-3">Bereits geliefert</th>
                <th className="py-2 pr-3">Noch offen</th>
                <th className="py-2 pr-3 hidden sm:table-cell">Letzte Aktivität</th>
                <th className="py-2 pr-3 w-8" />
              </tr>
            </thead>
            <tbody>
              {gruppen.map((g) => (
                <Fragment key={g.kundeId}>
                  <tr className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 pr-3">
                      <Link href={`/kunden/${g.kundeId}`} className="font-medium text-gray-900 hover:text-green-700">
                        {g.kundeName}
                      </Link>
                      {g.kundeOrt && <span className="text-xs text-gray-400 ml-1">({g.kundeOrt})</span>}
                    </td>
                    <td className="py-2 pr-3 text-green-700 font-medium">
                      {g.geliefertMenge > 0 ? g.geliefertMenge : "—"}
                    </td>
                    <td className="py-2 pr-3">
                      {g.offenMenge > 0 ? (
                        <span className="inline-flex flex-wrap items-center gap-1">
                          <span className="text-amber-700 font-medium">{g.offenMenge}</span>
                          {(["lieferung", "vorbestellung", "angebot"] as const)
                            .filter((q) => g.offenNachQuelle[q] > 0)
                            .map((q) => (
                              <span key={q} className={`text-xs px-1.5 py-0.5 rounded-full ${OFFEN_BADGE[q]}`}>
                                {OFFEN_BADGE_LABEL[q]}
                              </span>
                            ))}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2 pr-3 hidden sm:table-cell text-gray-500 text-xs">
                      {new Date(g.letzteDatum).toLocaleDateString("de-DE")}
                    </td>
                    <td className="py-2 pr-3">
                      <button
                        type="button"
                        onClick={() => toggleExpand(g.kundeId)}
                        className="text-gray-400 hover:text-gray-700"
                        title="Einzelvorgänge anzeigen"
                      >
                        {expanded.has(g.kundeId) ? "▲" : "▼"}
                      </button>
                    </td>
                  </tr>
                  {expanded.has(g.kundeId) && (
                    <tr className="bg-gray-50">
                      <td colSpan={5} className="px-3 py-2">
                        <ul className="space-y-1">
                          {g.vorgaenge
                            .slice()
                            .sort((a, b) => (a.datum < b.datum ? 1 : -1))
                            .map((v, i) => (
                              <li
                                key={`${v.quelle}-${v.referenzId}-${i}`}
                                className="flex flex-wrap items-center gap-2 text-xs"
                              >
                                <Link href={vorgangLink(v)} className="text-green-700 hover:underline">
                                  {vorgangLabel(v)}
                                </Link>
                                <span className={`px-1.5 py-0.5 rounded-full ${OFFEN_BADGE[v.quelle]}`}>
                                  {v.quelle === "lieferung" ? v.status : OFFEN_BADGE_LABEL[v.quelle]}
                                </span>
                                <span className="text-gray-600">
                                  {v.menge} {v.einheit ?? ""}
                                </span>
                                {v.chargeNr && (
                                  <span className="font-mono text-blue-700">Charge: {v.chargeNr}</span>
                                )}
                                <span className="text-gray-400">{new Date(v.datum).toLocaleDateString("de-DE")}</span>
                              </li>
                            ))}
                        </ul>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
