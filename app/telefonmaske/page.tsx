"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { formatEuro } from "@/lib/utils";

interface Kontakt {
  id: number;
  typ: string;
  wert: string;
  label: string | null;
}

interface Bedarf {
  id: number;
  menge: number;
  intervallTage: number;
  artikel: { id: number; name: string; einheit: string };
}

interface TelefonmaskeKunde {
  id: number;
  name: string;
  firma: string | null;
  strasse: string | null;
  plz: string | null;
  ort: string | null;
  kontakte: Kontakt[];
  letzteLiferung: { datum: string; artikel: string[] } | null;
  offeneRechnungen: { anzahl: number; summe: number };
  bedarfe: Bedarf[];
}

export default function TelefonmaskePage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TelefonmaskeKunde[]>([]);
  const [loading, setLoading] = useState(false);
  const [erfasst, setErfasst] = useState<Record<number, boolean>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/telefonmaske?q=${encodeURIComponent(q.trim())}`);
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 200);
    return () => clearTimeout(timer);
  }, [query, search]);

  async function erfasseAnruf(kundeId: number) {
    try {
      await fetch("/api/kunden/aktivitaeten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kundeId,
          typ: "anruf",
          betreff: "Anruf",
          datum: new Date().toISOString(),
          erledigt: true,
        }),
      });
      setErfasst((prev) => ({ ...prev, [kundeId]: true }));
      setTimeout(() => {
        setErfasst((prev) => { const n = { ...prev }; delete n[kundeId]; return n; });
      }, 2000);
    } catch {
      // ignore
    }
  }

  function formatDatum(d: string) {
    return new Date(d).toLocaleDateString("de-DE");
  }

  const telefonKontakte = (kontakte: Kontakt[]) =>
    kontakte.filter((k) => k.typ === "telefon" || k.typ === "mobil");

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-0">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold mb-1">Telefonmaske</h1>
        <p className="text-sm text-gray-500">Wer ruft an? Namen, Firma, Ort oder Telefonnummer eingeben.</p>
      </div>

      {/* Search input */}
      <div className="relative mb-6">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 0 5 11a6 6 0 0 0 12 0z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name, Firma, Ort, Telefon…"
          className="w-full pl-10 pr-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
          autoComplete="off"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {/* Empty state */}
      {query.trim().length < 2 && (
        <p className="text-center text-gray-400 text-sm mt-12">Mindestens 2 Zeichen eingeben…</p>
      )}

      {/* No results */}
      {query.trim().length >= 2 && !loading && results.length === 0 && (
        <p className="text-center text-gray-400 text-sm mt-12">Kein Kunde gefunden.</p>
      )}

      {/* Results */}
      <div className="space-y-4">
        {results.map((k) => {
          const tel = telefonKontakte(k.kontakte);
          return (
            <div key={k.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-5">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
                <div>
                  <div className="text-lg sm:text-xl font-bold text-gray-900">{k.name}</div>
                  {k.firma && <div className="text-sm text-gray-500">{k.firma}</div>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {erfasst[k.id] ? (
                    <span className="text-green-600 font-medium text-sm bg-green-50 px-3 py-2 sm:py-1.5 rounded-lg border border-green-200">
                      Erfasst
                    </span>
                  ) : (
                    <button
                      onClick={() => erfasseAnruf(k.id)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 sm:py-1.5 rounded-lg text-sm font-medium transition-colors flex-1 sm:flex-none"
                    >
                      Anruf erfassen
                    </button>
                  )}
                  <Link
                    href={`/kunden/${k.id}`}
                    className="text-green-700 hover:text-green-900 text-sm font-medium border border-green-200 hover:border-green-400 px-3 py-2 sm:py-1.5 rounded-lg transition-colors flex-1 sm:flex-none text-center"
                  >
                    Vollprofil &rarr;
                  </Link>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4 text-sm">
                {/* Left column */}
                <div className="space-y-2">
                  {/* Adresse */}
                  {(k.strasse || k.ort) && (
                    <div className="flex gap-2">
                      <svg className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <div className="text-gray-700">
                        {k.strasse && <div>{k.strasse}</div>}
                        {(k.plz || k.ort) && (
                          <div>{[k.plz, k.ort].filter(Boolean).join(" ")}</div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Telefon */}
                  {tel.length > 0 && (
                    <div className="flex gap-2">
                      <svg className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      <div className="space-y-1">
                        {tel.map((t) => (
                          <div key={t.id}>
                            <a href={`tel:${t.wert}`} className="text-green-700 hover:underline font-medium">
                              {t.wert}
                            </a>
                            {t.label && <span className="text-gray-400 text-xs ml-1">({t.label})</span>}
                            <span className="text-gray-400 text-xs ml-1 capitalize">{t.typ}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right column */}
                <div className="space-y-2">
                  {/* Offene Rechnungen */}
                  <div className="flex gap-2">
                    <svg className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <div>
                      {k.offeneRechnungen.anzahl > 0 ? (
                        <span className="text-red-600 font-medium">
                          {k.offeneRechnungen.anzahl} offene Rechnung{k.offeneRechnungen.anzahl !== 1 ? "en" : ""} &mdash; {formatEuro(k.offeneRechnungen.summe)}
                        </span>
                      ) : (
                        <span className="text-gray-400">Keine offenen Rechnungen</span>
                      )}
                    </div>
                  </div>

                  {/* Letzter Kauf */}
                  {k.letzteLiferung && (
                    <div className="flex gap-2">
                      <svg className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                      </svg>
                      <div className="text-gray-700">
                        <span className="text-gray-500">Letzter Kauf: </span>
                        {formatDatum(k.letzteLiferung.datum)}
                        {k.letzteLiferung.artikel.length > 0 && (
                          <div className="text-xs text-gray-500 mt-0.5">
                            {k.letzteLiferung.artikel.join(", ")}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Bedarf */}
                  {k.bedarfe.length > 0 && (
                    <div className="flex gap-2">
                      <svg className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <div className="text-gray-700">
                        <span className="text-gray-500">Bedarf: </span>
                        {k.bedarfe.map((b) => (
                          <span key={b.id} className="text-xs bg-green-50 text-green-800 border border-green-200 px-1.5 py-0.5 rounded mr-1">
                            {b.menge} {b.artikel.einheit} {b.artikel.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
