"use client";
import { useEffect, useMemo, useState, Fragment } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";

interface KundenPosition {
  quelle: "vorbestellung" | "lieferung" | "angebot";
  belegId: number;
  belegNummer: string;
  belegTyp: string;
  kunde: { id: number; name: string; firma: string | null } | null;
  menge: number;
  einheit: string;
  status: string;
}

interface BestellungZeile {
  bestellungId: number;
  nummer: string;
  lieferantId: number;
  lieferantName: string;
  menge: number;
  mengeGeliefert: number;
  einheit: string;
  status: string;
}

interface ArtikelZeile {
  artikelId: number;
  artikelName: string;
  artikelnummer: string;
  einheit: string;
  gruppe: string;
  kundenbedarfMenge: number;
  bestelltMenge: number;
  restMenge: number;
  kundenPositionen: KundenPosition[];
  bestellungen: BestellungZeile[];
}

type Filter = "offen" | "gedeckt" | "alle";

const BELEG_FARBE: Record<string, string> = {
  vorbestellung: "bg-purple-100 text-purple-800",
  lieferung: "bg-blue-100 text-blue-800",
  angebot: "bg-teal-100 text-teal-800",
};

function menge(n: number): string {
  return n.toLocaleString("de-DE", { maximumFractionDigits: 2 });
}

const EPSILON = 0.01;

interface Filters {
  status: Filter;
  gruppe: string;
  suche: string;
}

function loadFilters(): Filters {
  try {
    const raw = sessionStorage.getItem("einkaufsabgleich-filters");
    if (raw) {
      const parsed = JSON.parse(raw);
      const status: Filter = parsed.status === "offen" || parsed.status === "gedeckt" || parsed.status === "alle" ? parsed.status : "offen";
      return {
        status,
        gruppe: typeof parsed.gruppe === "string" ? parsed.gruppe : "",
        suche: typeof parsed.suche === "string" ? parsed.suche : "",
      };
    }
  } catch (err) {
    Sentry.captureException(err);
  }
  return { status: "offen", gruppe: "", suche: "" };
}

export default function EinkaufsabgleichPage() {
  const [zeilen, setZeilen] = useState<ArtikelZeile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("offen");
  const [gruppe, setGruppe] = useState("");
  const [suche, setSuche] = useState("");
  const [filterLoaded, setFilterLoaded] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/einkaufsabgleich");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error || "Laden fehlgeschlagen");
      setZeilen([]);
      setLoading(false);
      return;
    }
    setZeilen(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => {
    const f = loadFilters();
    setFilter(f.status);
    setGruppe(f.gruppe);
    setSuche(f.suche);
    setFilterLoaded(true);
  }, []);

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!filterLoaded) return;
    try {
      sessionStorage.setItem("einkaufsabgleich-filters", JSON.stringify({ status: filter, gruppe, suche }));
    } catch (err) {
      Sentry.captureException(err);
    }
  }, [filterLoaded, filter, gruppe, suche]);

  function toggle(artikelId: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(artikelId)) next.delete(artikelId);
      else next.add(artikelId);
      return next;
    });
  }

  function zeileStatus(z: ArtikelZeile): { label: string; color: string } {
    if (z.kundenbedarfMenge <= EPSILON && z.bestelltMenge > 0) {
      return { label: "Ohne Kundenbedarf bestellt", color: "bg-gray-100 text-gray-700" };
    }
    if (z.restMenge > EPSILON) return { label: "Offen", color: "bg-yellow-100 text-yellow-800" };
    return { label: "Gedeckt", color: "bg-green-100 text-green-800" };
  }

  const gruppenOptionen = useMemo(
    () => Array.from(new Set(zeilen.map((z) => z.gruppe))).sort((a, b) => a.localeCompare(b, "de")),
    [zeilen]
  );

  const sucheNorm = suche.trim().toLowerCase();
  // Bewusst nach Gruppe sortiert (siehe lib/einkaufsabgleich.ts) geladen — die sichtbaren Zeilen
  // bleiben dadurch ohne weiteres Zutun nach Artikelgruppe gruppiert.
  const sichtbareZeilen = zeilen.filter((z) => {
    if (filter === "offen" && z.restMenge <= EPSILON) return false;
    if (filter === "gedeckt" && z.restMenge > EPSILON) return false;
    if (gruppe && z.gruppe !== gruppe) return false;
    if (sucheNorm && !z.artikelName.toLowerCase().includes(sucheNorm) && !z.artikelnummer.toLowerCase().includes(sucheNorm)) return false;
    return true;
  });

  const offeneAnzahl = zeilen.filter((z) => z.restMenge > EPSILON).length;

  function exportUrl(): string {
    const params = new URLSearchParams({ filter });
    if (gruppe) params.set("gruppe", gruppe);
    if (suche.trim()) params.set("q", suche.trim());
    return `/api/einkaufsabgleich/export?${params.toString()}`;
  }

  return (
    <div className="max-w-5xl mx-auto">
      <style>{`@media print { .print-hidden { display: none !important; } @page { margin: 1.5cm; size: A4; } }`}</style>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Einkaufsabgleich</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Kundenbedarf je Artikel (Vorbestellungen, als Auftrag erfasste Lieferungen &amp; angenommene
            Angebote) gegen die Menge, die dafür bereits bei Lieferanten bestellt wurde (laufende
            Bestellungen — ohne bereits abgeschlossene oder stornierte).
          </p>
          {!loading && (
            <p className="text-sm mt-1">
              {offeneAnzahl > 0 ? (
                <span className="text-yellow-700 font-medium">
                  {offeneAnzahl} Artikel mit offenem Rest — noch nicht vollständig beim Lieferanten bestellt
                </span>
              ) : (
                <span className="text-green-700 font-medium">Alles gedeckt ✓</span>
              )}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 print-hidden">
          <div className="flex gap-1">
            {(["offen", "gedeckt", "alle"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  filter === f ? "bg-green-700 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                }`}
              >
                {f === "offen" ? "Offen" : f === "gedeckt" ? "Gedeckt" : "Alle"}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <a href={exportUrl()} className="text-sm px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg">
              ⤓ Excel-Export
            </a>
            <button
              onClick={() => window.print()}
              className="text-sm px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg"
            >
              Drucken
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-4 print-hidden">
        <input
          type="text"
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
          placeholder="Artikel oder Artikelnummer suchen…"
          className="w-full sm:w-72 px-3 py-1.5 text-sm border border-gray-300 rounded-lg"
        />
        <select
          value={gruppe}
          onChange={(e) => setGruppe(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white"
        >
          <option value="">Alle Artikelgruppen</option>
          {gruppenOptionen.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        {(gruppe || suche) && (
          <button
            onClick={() => {
              setGruppe("");
              setSuche("");
            }}
            className="text-sm px-3 py-1.5 text-gray-500 hover:text-gray-700"
          >
            Filter zurücksetzen
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400 py-8 text-center">Lade…</p>
      ) : sichtbareZeilen.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-sm">
            {gruppe || suche
              ? "Kein Artikel passt zur gewählten Artikelgruppe/Suche."
              : filter === "offen"
                ? "Kein Artikel mit offenem Rest — aller Kundenbedarf ist bereits gedeckt."
                : filter === "gedeckt"
                  ? "Noch kein Artikel vollständig gedeckt."
                  : "Kein offener Kundenbedarf und keine laufenden Lieferantenbestellungen."}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
          {sichtbareZeilen.map((z, i) => {
            const isOpen = expanded.has(z.artikelId);
            const st = zeileStatus(z);
            const zeigeGruppenkopf = i === 0 || sichtbareZeilen[i - 1].gruppe !== z.gruppe;
            return (
              <Fragment key={z.artikelId}>
                {zeigeGruppenkopf && (
                  <div className="px-5 py-1.5 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {z.gruppe}
                  </div>
                )}
                <div className="px-5 py-3">
                <div className="flex gap-3 items-start">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>{st.label}</span>
                      <Link href={`/artikel/${z.artikelId}`} className="font-medium text-gray-900 hover:text-green-700 text-sm">
                        {z.artikelName}
                      </Link>
                      <span className="text-xs text-gray-400 font-mono">{z.artikelnummer}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500">
                      <span className="font-medium text-gray-700">
                        Kundenbedarf {menge(z.kundenbedarfMenge)} {z.einheit}
                      </span>
                      <span className="text-blue-700">
                        Bestellt {menge(z.bestelltMenge)} {z.einheit}
                      </span>
                      <span className={z.restMenge > EPSILON ? "text-yellow-700 font-medium" : "text-gray-500"}>
                        Rest {menge(z.restMenge)} {z.einheit}
                      </span>
                      <button onClick={() => toggle(z.artikelId)} className="text-gray-400 hover:text-gray-700">
                        {z.kundenPositionen.length} Auftr./Vorbest. · {z.bestellungen.length} Bestell. {isOpen ? "▲" : "▼"}
                      </button>
                    </div>
                  </div>
                </div>

                {isOpen && (
                  <div className="mt-3 ml-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-semibold text-gray-500 mb-1">Kundenbedarf (Vorbestellung/Auftrag/Angebot)</p>
                      {z.kundenPositionen.length === 0 ? (
                        <p className="text-xs text-gray-400">Kein offener Kundenbedarf.</p>
                      ) : (
                        <div className="space-y-1">
                          {z.kundenPositionen.map((p, i) => (
                            <div key={`${p.quelle}:${p.belegId}:${i}`} className="flex items-center gap-2 text-xs flex-wrap">
                              <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${BELEG_FARBE[p.quelle]}`}>
                                {p.belegTyp}
                              </span>
                              {p.quelle === "lieferung" ? (
                                <Link href={`/lieferungen/${p.belegId}`} className="font-mono text-blue-700 hover:underline">
                                  {p.belegNummer}
                                </Link>
                              ) : p.quelle === "vorbestellung" ? (
                                <Link href={`/vorbestellungen/${p.belegId}`} className="font-mono text-purple-700 hover:underline">
                                  {p.belegNummer}
                                </Link>
                              ) : (
                                <Link href={`/angebote/${p.belegId}`} className="font-mono text-teal-700 hover:underline">
                                  {p.belegNummer}
                                </Link>
                              )}
                              {p.kunde && (
                                <Link href={`/kunden/${p.kunde.id}`} className="text-gray-600 hover:text-green-700">
                                  {p.kunde.firma || p.kunde.name}
                                </Link>
                              )}
                              <span className="font-medium text-gray-700">
                                {menge(p.menge)} {p.einheit}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-500 mb-1">Lieferantenbestellungen</p>
                      {z.bestellungen.length === 0 ? (
                        <p className="text-xs text-gray-400">Noch nicht bestellt.</p>
                      ) : (
                        <div className="space-y-1">
                          {z.bestellungen.map((p) => (
                            <div key={p.bestellungId + ":" + p.nummer} className="flex items-center gap-2 text-xs flex-wrap">
                              <Link href={`/bestellungen/${p.bestellungId}`} className="font-mono text-blue-700 hover:underline">
                                {p.nummer}
                              </Link>
                              <Link href={`/lieferanten/${p.lieferantId}`} className="text-gray-600 hover:text-green-700">
                                {p.lieferantName}
                              </Link>
                              <span className="font-medium text-gray-700">
                                {menge(p.menge)} {p.einheit}
                              </span>
                              <span className="text-gray-400">({p.status})</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                </div>
              </Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}
