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

interface AngebotResult {
  id: number;
  nummer: string;
  status: string;
  gueltigBis: string | null;
  kunde: { name: string; firma: string | null } | null;
}

interface AufgabeResult {
  id: number;
  betreff: string;
  faelligAm: string | null;
  erledigt: boolean;
  kundeId: number | null;
}

interface SearchResults {
  kunden: KundeResult[];
  artikel: ArtikelResult[];
  lieferungen: LieferungResult[];
  angebote: AngebotResult[];
  aufgaben: AufgabeResult[];
}

const SHOWN_PER_PAGE = 20;

type EntityTyp = "alle" | "kunden" | "artikel" | "lieferungen" | "angebote" | "aufgaben";

const TABS: { key: EntityTyp; label: string; color: string; activeCls: string }[] = [
  { key: "alle",        label: "Alle",        color: "text-gray-600", activeCls: "border-gray-700 text-gray-800" },
  { key: "kunden",      label: "Kunden",      color: "text-green-600", activeCls: "border-green-600 text-green-700" },
  { key: "artikel",     label: "Artikel",     color: "text-blue-600",  activeCls: "border-blue-600 text-blue-700" },
  { key: "lieferungen", label: "Lieferungen", color: "text-orange-600", activeCls: "border-orange-600 text-orange-700" },
  { key: "angebote",    label: "Angebote",    color: "text-purple-600", activeCls: "border-purple-600 text-purple-700" },
  { key: "aufgaben",    label: "Aufgaben",    color: "text-indigo-600", activeCls: "border-indigo-600 text-indigo-700" },
];

const ANGEBOT_STATUS_LABEL: Record<string, string> = {
  OFFEN: "Offen", ANGENOMMEN: "Angenommen", ABGELEHNT: "Abgelehnt", ABGELAUFEN: "Abgelaufen",
};

function SearchResultsInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQ = searchParams.get("q") ?? "";
  const initialTyp = (searchParams.get("typ") ?? "alle") as EntityTyp;

  const [query, setQuery] = useState(initialQ);
  const [inputVal, setInputVal] = useState(initialQ);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [aktiveTab, setAktiveTab] = useState<EntityTyp>(initialTyp);

  const [kundenLimit, setKundenLimit] = useState(SHOWN_PER_PAGE);
  const [artikelLimit, setArtikelLimit] = useState(SHOWN_PER_PAGE);
  const [lieferungenLimit, setLieferungenLimit] = useState(SHOWN_PER_PAGE);
  const [angeboteLimit, setAngeboteLimit] = useState(SHOWN_PER_PAGE);
  const [aufgabenLimit, setAufgabenLimit] = useState(SHOWN_PER_PAGE);

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/suche?q=${encodeURIComponent(q.trim())}&take=50`);
      if (!res.ok) throw new Error("Fehler");
      const data: SearchResults = await res.json();
      setResults(data);
      setKundenLimit(SHOWN_PER_PAGE);
      setArtikelLimit(SHOWN_PER_PAGE);
      setLieferungenLimit(SHOWN_PER_PAGE);
      setAngeboteLimit(SHOWN_PER_PAGE);
      setAufgabenLimit(SHOWN_PER_PAGE);
    } catch {
      setResults({ kunden: [], artikel: [], lieferungen: [], angebote: [], aufgaben: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialQ.length >= 2) doSearch(initialQ);
  }, []); // only on mount

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = inputVal.trim();
    setQuery(q);
    setAktiveTab("alle");
    router.replace(`/suche?q=${encodeURIComponent(q)}`);
    doSearch(q);
  };

  const switchTab = (tab: EntityTyp) => {
    setAktiveTab(tab);
    const params = new URLSearchParams();
    params.set("q", query);
    if (tab !== "alle") params.set("typ", tab);
    router.replace(`/suche?${params.toString()}`);
  };

  const r = results;
  const counts = {
    kunden: r?.kunden.length ?? 0,
    artikel: r?.artikel.length ?? 0,
    lieferungen: r?.lieferungen.length ?? 0,
    angebote: r?.angebote.length ?? 0,
    aufgaben: r?.aufgaben.length ?? 0,
  };
  const totalResults = counts.kunden + counts.artikel + counts.lieferungen + counts.angebote + counts.aufgaben;

  const show = (key: EntityTyp) => aktiveTab === "alle" || aktiveTab === key;

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-5">Volltext-Suche</h1>

      {/* Search form */}
      <form onSubmit={handleSubmit} className="flex gap-3 mb-5">
        <input
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          placeholder="Suche nach Kunden, Artikeln, Lieferungen, Angeboten, Aufgaben…"
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

      {/* Filter-Tabs */}
      {results !== null && totalResults > 0 && (
        <div className="flex gap-1 mb-5 border-b border-gray-200 overflow-x-auto">
          {TABS.map(({ key, label, activeCls }) => {
            const count = key === "alle" ? totalResults : counts[key as keyof typeof counts];
            if (key !== "alle" && count === 0) return null;
            const isActive = aktiveTab === key;
            return (
              <button
                key={key}
                onClick={() => switchTab(key)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap -mb-px ${
                  isActive ? activeCls + " border-current" : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {label}
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${isActive ? "bg-current/10" : "bg-gray-100 text-gray-500"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

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

          {/* Kunden */}
          {show("kunden") && results.kunden.length > 0 && (
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
                        <p className="text-sm font-medium text-gray-800 truncate">{k.firma ?? k.name}</p>
                        {k.firma && <p className="text-xs text-gray-500 truncate">{k.name}</p>}
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
          {show("artikel") && results.artikel.length > 0 && (
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
          {show("lieferungen") && results.lieferungen.length > 0 && (
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

          {/* Angebote */}
          {show("angebote") && results.angebote.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-purple-600">
                  <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </span>
                <h2 className="font-semibold text-gray-800">Angebote</h2>
                <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-medium">
                  {results.angebote.length}
                </span>
              </div>
              <div className="space-y-2">
                {results.angebote.slice(0, angeboteLimit).map((a) => {
                  const kundenname = a.kunde?.firma ?? a.kunde?.name ?? "–";
                  return (
                    <Link
                      key={a.id}
                      href={`/angebote/${a.id}`}
                      className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-purple-50 hover:border-purple-200 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{a.nummer}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {kundenname} · {ANGEBOT_STATUS_LABEL[a.status] ?? a.status}
                          {a.gueltigBis ? ` · bis ${new Date(a.gueltigBis).toLocaleDateString("de-DE")}` : ""}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
              {results.angebote.length > angeboteLimit && (
                <button
                  onClick={() => setAngeboteLimit((l) => l + SHOWN_PER_PAGE)}
                  className="mt-3 w-full py-2 text-sm text-purple-700 hover:text-purple-800 border border-purple-200 rounded-lg hover:bg-purple-50 transition-colors font-medium"
                >
                  Mehr anzeigen ({results.angebote.length - angeboteLimit} weitere)
                </button>
              )}
            </section>
          )}

          {/* Aufgaben */}
          {show("aufgaben") && results.aufgaben.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-indigo-600">
                  <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </span>
                <h2 className="font-semibold text-gray-800">Aufgaben</h2>
                <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-medium">
                  {results.aufgaben.length}
                </span>
              </div>
              <div className="space-y-2">
                {results.aufgaben.slice(0, aufgabenLimit).map((t) => (
                  <Link
                    key={t.id}
                    href={`/aufgaben/${t.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-indigo-50 hover:border-indigo-200 transition-colors"
                  >
                    <div className="min-w-0 flex items-start gap-2">
                      {t.erledigt && (
                        <svg className="w-4 h-4 text-green-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      <div className="min-w-0">
                        <p className={`text-sm font-medium truncate ${t.erledigt ? "line-through text-gray-400" : "text-gray-800"}`}>
                          {t.betreff}
                        </p>
                        {t.faelligAm && (
                          <p className="text-xs text-gray-500">
                            Fällig: {new Date(t.faelligAm).toLocaleDateString("de-DE")}
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
              {results.aufgaben.length > aufgabenLimit && (
                <button
                  onClick={() => setAufgabenLimit((l) => l + SHOWN_PER_PAGE)}
                  className="mt-3 w-full py-2 text-sm text-indigo-700 hover:text-indigo-800 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors font-medium"
                >
                  Mehr anzeigen ({results.aufgaben.length - aufgabenLimit} weitere)
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
