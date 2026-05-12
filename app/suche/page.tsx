"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

interface KundeResult {
  id: number;
  name: string;
  firma: string | null;
  plz: string | null;
  ort: string | null;
}

interface ArtikelResult {
  id: number;
  name: string;
  artikelnummer: string | null;
  kategorie: string | null;
}

interface LieferungResult {
  id: number;
  datum: string;
  status: string;
  rechnungNr: string | null;
  kunde: { name: string; firma: string | null } | null;
}

interface SearchResults {
  kunden: KundeResult[];
  artikel: ArtikelResult[];
  lieferungen: LieferungResult[];
}

const SHOWN_PER_PAGE = 20;

function SearchResultsInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQ = searchParams.get("q") ?? "";

  const [query, setQuery] = useState(initialQ);
  const [inputVal, setInputVal] = useState(initialQ);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);

  // "Mehr laden" state per group
  const [kundenLimit, setKundenLimit] = useState(SHOWN_PER_PAGE);
  const [artikelLimit, setArtikelLimit] = useState(SHOWN_PER_PAGE);
  const [lieferungenLimit, setLieferungenLimit] = useState(SHOWN_PER_PAGE);

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/suche?q=${encodeURIComponent(q.trim())}`);
      if (!res.ok) throw new Error("Fehler");
      const data: SearchResults = await res.json();
      setResults(data);
      setKundenLimit(SHOWN_PER_PAGE);
      setArtikelLimit(SHOWN_PER_PAGE);
      setLieferungenLimit(SHOWN_PER_PAGE);
    } catch {
      setResults({ kunden: [], artikel: [], lieferungen: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialQ.length >= 2) {
      doSearch(initialQ);
    }
  }, []); // only on mount

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = inputVal.trim();
    setQuery(q);
    router.replace(`/suche?q=${encodeURIComponent(q)}`);
    doSearch(q);
  };

  const totalResults = results
    ? results.kunden.length + results.artikel.length + results.lieferungen.length
    : 0;

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-5">Volltext-Suche</h1>

      {/* Search form */}
      <form onSubmit={handleSubmit} className="flex gap-3 mb-6">
        <input
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          placeholder="Suche nach Kunden, Artikeln, Lieferungen…"
          className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          autoFocus
        />
        <button
          type="submit"
          className="px-5 py-2.5 bg-green-700 hover:bg-green-800 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Suchen
        </button>
      </form>

      {/* Status */}
      {loading && (
        <div className="flex items-center gap-3 py-8 justify-center text-gray-500">
          <div className="w-5 h-5 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Suche läuft…</span>
        </div>
      )}

      {!loading && query.length >= 2 && results !== null && totalResults === 0 && (
        <p className="text-center text-gray-500 py-10 text-sm">
          Keine Treffer für &ldquo;{query}&rdquo;
        </p>
      )}

      {!loading && results !== null && totalResults > 0 && (
        <div className="space-y-8">
          <p className="text-xs text-gray-400">
            {totalResults} Ergebnis{totalResults !== 1 ? "se" : ""} für &ldquo;{query}&rdquo;
          </p>

          {/* Kunden */}
          {results.kunden.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-green-600">
                  <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </span>
                <h2 className="font-semibold text-gray-800">Kunden</h2>
                <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">
                  {results.kunden.length}
                </span>
              </div>
              <div className="space-y-2">
                {results.kunden.slice(0, kundenLimit).map((k) => {
                  const loc = [k.plz, k.ort].filter(Boolean).join(" ");
                  return (
                    <Link
                      key={k.id}
                      href={`/kunden/${k.id}`}
                      className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-green-50 hover:border-green-200 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">
                          {k.firma ?? k.name}
                        </p>
                        {k.firma && (
                          <p className="text-xs text-gray-500 truncate">{k.name}</p>
                        )}
                      </div>
                      {loc && <span className="text-xs text-gray-400 shrink-0 ml-3">{loc}</span>}
                    </Link>
                  );
                })}
              </div>
              {results.kunden.length > kundenLimit && (
                <button
                  onClick={() => setKundenLimit((l) => l + SHOWN_PER_PAGE)}
                  className="mt-3 w-full py-2 text-sm text-green-700 hover:text-green-800 border border-green-200 rounded-lg hover:bg-green-50 transition-colors font-medium"
                >
                  Mehr anzeigen ({results.kunden.length - kundenLimit} weitere)
                </button>
              )}
            </section>
          )}

          {/* Artikel */}
          {results.artikel.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-blue-600">
                  <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
                  </svg>
                </span>
                <h2 className="font-semibold text-gray-800">Artikel</h2>
                <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">
                  {results.artikel.length}
                </span>
              </div>
              <div className="space-y-2">
                {results.artikel.slice(0, artikelLimit).map((a) => (
                  <Link
                    key={a.id}
                    href={`/artikel/${a.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-blue-50 hover:border-blue-200 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{a.name}</p>
                      {(a.artikelnummer || a.kategorie) && (
                        <p className="text-xs text-gray-500 truncate">
                          {[a.artikelnummer, a.kategorie].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
              {results.artikel.length > artikelLimit && (
                <button
                  onClick={() => setArtikelLimit((l) => l + SHOWN_PER_PAGE)}
                  className="mt-3 w-full py-2 text-sm text-blue-700 hover:text-blue-800 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors font-medium"
                >
                  Mehr anzeigen ({results.artikel.length - artikelLimit} weitere)
                </button>
              )}
            </section>
          )}

          {/* Lieferungen */}
          {results.lieferungen.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-orange-600">
                  <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </span>
                <h2 className="font-semibold text-gray-800">Lieferungen</h2>
                <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full font-medium">
                  {results.lieferungen.length}
                </span>
              </div>
              <div className="space-y-2">
                {results.lieferungen.slice(0, lieferungenLimit).map((l) => {
                  const kundenname = l.kunde?.firma ?? l.kunde?.name ?? "–";
                  return (
                    <Link
                      key={l.id}
                      href={`/lieferungen/${l.id}`}
                      className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-orange-50 hover:border-orange-200 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{kundenname}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {l.rechnungNr ? `${l.rechnungNr} · ` : ""}
                          {l.datum ? new Date(l.datum).toLocaleDateString("de-DE") : "–"} · {l.status}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
              {results.lieferungen.length > lieferungenLimit && (
                <button
                  onClick={() => setLieferungenLimit((l) => l + SHOWN_PER_PAGE)}
                  className="mt-3 w-full py-2 text-sm text-orange-700 hover:text-orange-800 border border-orange-200 rounded-lg hover:bg-orange-50 transition-colors font-medium"
                >
                  Mehr anzeigen ({results.lieferungen.length - lieferungenLimit} weitere)
                </button>
              )}
            </section>
          )}
        </div>
      )}

      {!loading && query.length < 2 && (
        <p className="text-center text-gray-400 py-10 text-sm">
          Mindestens 2 Zeichen eingeben, um die Suche zu starten.
        </p>
      )}
    </div>
  );
}

export default function SuchePage() {
  return (
    <Suspense fallback={
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-5">Volltext-Suche</h1>
        <div className="h-11 bg-gray-200 rounded-lg animate-pulse mb-6" />
      </div>
    }>
      <SearchResultsInner />
    </Suspense>
  );
}
