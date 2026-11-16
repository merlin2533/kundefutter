"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";

interface VorbestellungZeile {
  vorbestellungId: number;
  nummer: string;
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
  vorbestelltMenge: number;
  bestelltMenge: number;
  restMenge: number;
  vorbestellungen: VorbestellungZeile[];
  bestellungen: BestellungZeile[];
}

type Filter = "offen" | "gedeckt" | "alle";

function menge(n: number): string {
  return n.toLocaleString("de-DE", { maximumFractionDigits: 2 });
}

const EPSILON = 0.01;

function loadFilter(): Filter {
  try {
    const f = sessionStorage.getItem("einkaufsabgleich-filter");
    if (f === "offen" || f === "gedeckt" || f === "alle") return f;
  } catch (err) {
    Sentry.captureException(err);
  }
  return "offen";
}

export default function EinkaufsabgleichPage() {
  const [zeilen, setZeilen] = useState<ArtikelZeile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("offen");
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
    setFilter(loadFilter());
    setFilterLoaded(true);
  }, []);

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!filterLoaded) return;
    try {
      sessionStorage.setItem("einkaufsabgleich-filter", filter);
    } catch (err) {
      Sentry.captureException(err);
    }
  }, [filterLoaded, filter]);

  function toggle(artikelId: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(artikelId)) next.delete(artikelId);
      else next.add(artikelId);
      return next;
    });
  }

  function zeileStatus(z: ArtikelZeile): { label: string; color: string } {
    if (z.vorbestelltMenge <= EPSILON && z.bestelltMenge > 0) {
      return { label: "Ohne Vorbestellung bestellt", color: "bg-gray-100 text-gray-700" };
    }
    if (z.restMenge > EPSILON) return { label: "Offen", color: "bg-yellow-100 text-yellow-800" };
    return { label: "Gedeckt", color: "bg-green-100 text-green-800" };
  }

  const sichtbareZeilen = zeilen.filter((z) => {
    if (filter === "offen") return z.restMenge > EPSILON;
    if (filter === "gedeckt") return z.restMenge <= EPSILON;
    return true;
  });

  const offeneAnzahl = zeilen.filter((z) => z.restMenge > EPSILON).length;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Einkaufsabgleich</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Vorbestellte Menge der Kunden (Frühbezug) je Artikel gegen die Menge, die dafür bereits bei
            Lieferanten bestellt wurde (laufende Bestellungen — ohne bereits abgeschlossene oder stornierte).
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
        <div className="flex gap-1 print-hidden">
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
            {filter === "offen"
              ? "Kein Artikel mit offenem Rest — alle Vorbestellungen sind bereits gedeckt."
              : filter === "gedeckt"
                ? "Noch kein Artikel vollständig gedeckt."
                : "Keine offenen Vorbestellungen und keine laufenden Lieferantenbestellungen."}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
          {sichtbareZeilen.map((z) => {
            const isOpen = expanded.has(z.artikelId);
            const st = zeileStatus(z);
            return (
              <div key={z.artikelId} className="px-5 py-3">
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
                        Vorbestellt {menge(z.vorbestelltMenge)} {z.einheit}
                      </span>
                      <span className="text-blue-700">
                        Bestellt {menge(z.bestelltMenge)} {z.einheit}
                      </span>
                      <span className={z.restMenge > EPSILON ? "text-yellow-700 font-medium" : "text-gray-500"}>
                        Rest {menge(z.restMenge)} {z.einheit}
                      </span>
                      <button onClick={() => toggle(z.artikelId)} className="text-gray-400 hover:text-gray-700">
                        {z.vorbestellungen.length} Vorbest. · {z.bestellungen.length} Bestell. {isOpen ? "▲" : "▼"}
                      </button>
                    </div>
                  </div>
                </div>

                {isOpen && (
                  <div className="mt-3 ml-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-semibold text-gray-500 mb-1">Vorbestellungen (Kunden)</p>
                      {z.vorbestellungen.length === 0 ? (
                        <p className="text-xs text-gray-400">Keine offene Vorbestellung.</p>
                      ) : (
                        <div className="space-y-1">
                          {z.vorbestellungen.map((p) => (
                            <div key={p.vorbestellungId + ":" + p.nummer} className="flex items-center gap-2 text-xs flex-wrap">
                              <Link href={`/vorbestellungen/${p.vorbestellungId}`} className="font-mono text-purple-700 hover:underline">
                                {p.nummer}
                              </Link>
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
            );
          })}
        </div>
      )}
    </div>
  );
}
