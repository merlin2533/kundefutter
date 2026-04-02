"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useEffect, useCallback } from "react";

interface NavGroup {
  label: string;
  href?: string;
  children?: { href: string; label: string }[];
}

const groups: NavGroup[] = [
  { label: "Dashboard", href: "/" },
  {
    label: "Kunden",
    children: [
      { href: "/kunden", label: "Kundenliste" },
      { href: "/kunden/karte", label: "Karte" },
      { href: "/kundenimport", label: "Import" },
      { href: "/crm", label: "CRM / Aktivitäten" },
      { href: "/gebietsanalyse", label: "Gebietsanalyse" },
      { href: "/agrarantraege", label: "Agraranträge (AFIG)" },
      { href: "/mailverteiler", label: "Mailverteiler" },
      { href: "/kunden/bewertung", label: "Kundenbewertung" },
      { href: "/telefonmaske", label: "Telefonmaske" },
      { href: "/preisauskunft", label: "Preisauskunft" },
      { href: "/tagesansicht", label: "Tagesansicht" },
    ],
  },
  {
    label: "Artikel",
    children: [
      { href: "/artikel", label: "Artikelstamm" },
      { href: "/lieferanten", label: "Lieferanten" },
      { href: "/lager", label: "Lager" },
      { href: "/lager/umbuchungen", label: "Umbuchungen" },
      { href: "/inventur", label: "Inventur" },
      { href: "/kalkulation", label: "Preiskalkulation" },
    ],
  },
  {
    label: "Lieferungen",
    children: [
      { href: "/angebote", label: "Angebote" },
      { href: "/aufgaben", label: "Aufgaben / TODO" },
      { href: "/lieferungen", label: "Lieferungen" },
      { href: "/tourenplanung", label: "Tourenplanung" },
    ],
  },
  {
    label: "Finanzen",
    children: [
      { href: "/rechnungen", label: "Rechnungen" },
      { href: "/sammelrechnungen", label: "Sammelrechnungen" },
      { href: "/gutschriften", label: "Gutschriften" },
      { href: "/mahnwesen", label: "Mahnwesen" },
      { href: "/mengenrabatte", label: "Mengenrabatte" },
      { href: "/exporte", label: "Export" },
    ],
  },
  {
    label: "Analyse",
    children: [
      { href: "/statistik", label: "Statistik" },
      { href: "/prognose", label: "Prognose" },
      { href: "/marktpreise", label: "Marktpreise" },
      { href: "/analyse/abc", label: "ABC-Analyse" },
      { href: "/analyse/saisonal", label: "Saisonal" },
      { href: "/analyse/deckungsbeitrag", label: "Deckungsbeitrag" },
      { href: "/audit", label: "Änderungshistorie" },
    ],
  },
  { label: "Einstellungen", href: "/einstellungen" },
];

// ---- PAGE TITLE MAP (for history) ----
const PAGE_TITLE_MAP: Record<string, string> = {
  "/kunden": "Kunden",
  "/crm": "CRM",
  "/artikel": "Artikel",
  "/lieferungen": "Lieferungen",
  "/angebote": "Angebote",
  "/aufgaben": "Aufgaben",
  "/lager": "Lager",
  "/einstellungen": "Einstellungen",
  "/tourenplanung": "Tourenplanung",
  "/marktpreise": "Marktpreise",
  "/agrarantraege": "Agraranträge",
  "/gebietsanalyse": "Gebietsanalyse",
  "/prognose": "Prognose",
  "/exporte": "Exporte",
  "/mengenrabatte": "Mengenrabatte",
  "/telefonmaske": "Telefonmaske",
  "/tagesansicht": "Tagesansicht",
  "/preisauskunft": "Preisauskunft",
  "/inventur": "Inventur",
  "/statistik": "Statistik",
  "/rechnungen": "Rechnungen",
  "/sammelrechnungen": "Sammelrechnungen",
  "/gutschriften": "Gutschriften",
  "/mahnwesen": "Mahnwesen",
};

function getPageTitle(pathname: string): string {
  if (PAGE_TITLE_MAP[pathname]) return PAGE_TITLE_MAP[pathname];
  if (pathname.startsWith("/kunden/") && pathname.endsWith("/mappe")) return "Kundenmappe";
  if (pathname.startsWith("/kunden/") && !pathname.includes("/neu")) return "Kundendetail";
  if (pathname.startsWith("/lieferungen/") && !pathname.includes("/neu")) return "Lieferung";
  if (pathname.startsWith("/angebote/") && !pathname.includes("/neu")) return "Angebot";
  if (pathname.startsWith("/aufgaben/") && !pathname.includes("/neu")) return "Aufgabe";
  if (pathname.endsWith("/neu")) return "Neu";
  return pathname.split("/").filter(Boolean).pop() ?? "Seite";
}

// ---- RECENT PAGES ----
const HISTORY_KEY = "nav_recent_pages";
const HISTORY_MAX = 8;

interface HistoryEntry { href: string; title: string; ts: number }

function loadHistory(): HistoryEntry[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]"); } catch { return []; }
}
function saveHistory(entries: HistoryEntry[]) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(entries)); } catch { /* ignore */ }
}
function addHistoryEntry(pathname: string) {
  if (pathname === "/" || pathname.startsWith("/api/")) return;
  const title = getPageTitle(pathname);
  const entries = loadHistory().filter((e) => e.href !== pathname);
  entries.unshift({ href: pathname, title, ts: Date.now() });
  saveHistory(entries.slice(0, HISTORY_MAX));
}

// ---- SEARCH TYPES ----
interface KundeResult { id: number; name: string; firma: string | null; plz: string | null; ort: string | null }
interface ArtikelResult { id: number; name: string; artikelnummer: string | null; kategorie: string | null }
interface LieferungResult { id: number; datum: string; status: string; rechnungNr: string | null; kunde: { name: string; firma: string | null } | null }
interface AngebotResult { id: number; nummer: string; status: string; kunde: { name: string; firma: string | null } | null }

interface SearchResults {
  kunden: KundeResult[];
  artikel: ArtikelResult[];
  lieferungen: LieferungResult[];
  angebote?: AngebotResult[];
}

type ResultItem =
  | { type: "kunde"; data: KundeResult }
  | { type: "artikel"; data: ArtikelResult }
  | { type: "lieferung"; data: LieferungResult }
  | { type: "angebot"; data: AngebotResult };

function getResultHref(item: ResultItem): string {
  if (item.type === "kunde") return `/kunden/${item.data.id}`;
  if (item.type === "artikel") return `/artikel/${item.data.id}`;
  if (item.type === "lieferung") return `/lieferungen/${item.data.id}`;
  return `/angebote/${item.data.id}`;
}

function getResultLabel(item: ResultItem): string {
  if (item.type === "kunde") return item.data.firma ?? item.data.name;
  if (item.type === "artikel") return item.data.name;
  if (item.type === "lieferung") {
    const k = item.data.kunde?.firma ?? item.data.kunde?.name ?? "–";
    return item.data.rechnungNr ? `${item.data.rechnungNr} · ${k}` : k;
  }
  const k = item.data.kunde?.firma ?? item.data.kunde?.name ?? "–";
  return `${item.data.nummer} · ${k}`;
}

function getResultSub(item: ResultItem): string {
  if (item.type === "kunde") {
    const loc = [item.data.plz, item.data.ort].filter(Boolean).join(" ");
    return loc || "Kunde";
  }
  if (item.type === "artikel") return item.data.kategorie ?? item.data.artikelnummer ?? "Artikel";
  if (item.type === "lieferung") return `${item.data.status} · ${new Date(item.data.datum).toLocaleDateString("de-DE")}`;
  return `Angebot · ${item.data.status}`;
}

// ---- NOTIFICATION TYPES ----
interface NotifAufgabe { id: number; betreff: string; faelligAm: string | null; kundeId: number | null; typ: string }
interface NotifRechnung { id: number; rechnungNr: string | null; kundeName: string; ueberfaelligTage: number }
interface NotifArtikel { id: number; name: string; aktuellerBestand: number; mindestbestand: number; einheit: string; status: "rot" | "gelb" }
interface Notifications { aufgaben: NotifAufgabe[]; rechnungen: NotifRechnung[]; lagerAlarm: NotifArtikel[] }

// ---- HEADER SEARCH COMPONENT ----
function HeaderSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setMobileExpanded(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const doSearch = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) { setResults(null); setOpen(false); setLoading(false); return; }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const [suche, angeboteRes] = await Promise.all([
          fetch(`/api/suche?q=${encodeURIComponent(q)}`).then((r) => r.json()),
          fetch(`/api/angebote?search=${encodeURIComponent(q)}`).then((r) => r.json()).catch(() => []),
        ]);
        const angebote: AngebotResult[] = Array.isArray(angeboteRes)
          ? angeboteRes.slice(0, 5)
          : (angeboteRes.angebote ?? []).slice(0, 5);
        setResults({ ...suche, angebote });
        setActiveIdx(0);
        setOpen(true);
      } catch {
        setResults({ kunden: [], artikel: [], lieferungen: [], angebote: [] });
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 150);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    doSearch(val);
  };

  const flatItems: ResultItem[] = results
    ? [
        ...results.kunden.map((d) => ({ type: "kunde" as const, data: d })),
        ...results.artikel.map((d) => ({ type: "artikel" as const, data: d })),
        ...results.lieferungen.map((d) => ({ type: "lieferung" as const, data: d })),
        ...(results.angebote ?? []).map((d) => ({ type: "angebot" as const, data: d })),
      ]
    : [];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { setOpen(false); setMobileExpanded(false); inputRef.current?.blur(); return; }
    if (!open || flatItems.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => (i + 1) % flatItems.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => (i - 1 + flatItems.length) % flatItems.length); }
    else if (e.key === "Enter") {
      e.preventDefault();
      const item = flatItems[activeIdx];
      if (item) { router.push(getResultHref(item)); setOpen(false); setQuery(""); setMobileExpanded(false); }
    }
  };

  const TYPE_LABEL: Record<ResultItem["type"], string> = { kunde: "Kunden", artikel: "Artikel", lieferung: "Lieferungen", angebot: "Angebote" };
  const TYPE_COLOR: Record<ResultItem["type"], string> = { kunde: "text-green-700", artikel: "text-blue-700", lieferung: "text-orange-700", angebot: "text-purple-700" };

  const sections = (["kunde", "artikel", "lieferung", "angebot"] as ResultItem["type"][])
    .map((t) => ({ type: t, items: flatItems.filter((i) => i.type === t) }))
    .filter((s) => s.items.length > 0);

  const hasResults = flatItems.length > 0;
  const showEmpty = query.length >= 2 && !loading && results !== null && !hasResults;

  return (
    <div ref={containerRef} className="relative flex items-center">
      {/* Mobile toggle */}
      <button
        className={`md:hidden p-2 rounded hover:bg-green-700 transition-colors text-white ${mobileExpanded ? "hidden" : "block"}`}
        onClick={() => { setMobileExpanded(true); setTimeout(() => inputRef.current?.focus(), 50); }}
        aria-label="Suche öffnen"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </button>

      {/* Input wrapper */}
      <div className={`${mobileExpanded ? "flex" : "hidden"} md:flex items-center bg-white/15 hover:bg-white/20 focus-within:bg-white rounded-lg transition-all duration-150 focus-within:shadow-md`}>
        <svg className="w-4 h-4 ml-2.5 text-white/60 focus-within:text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length >= 2 && setOpen(true)}
          placeholder="Suchen…"
          className="bg-transparent outline-none text-white placeholder-white/60 text-sm px-2.5 py-1.5 w-36 lg:w-52 focus:text-gray-900 focus:placeholder-gray-400 transition-colors"
        />
        {loading && (
          <svg className="w-4 h-4 mr-2 text-white/60 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        )}
        {query && !loading && (
          <button
            onClick={() => { setQuery(""); setResults(null); setOpen(false); inputRef.current?.focus(); }}
            className="mr-2 text-white/60 hover:text-white/90 flex-shrink-0"
            aria-label="Suche leeren"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        {mobileExpanded && (
          <button
            onClick={() => { setMobileExpanded(false); setOpen(false); setQuery(""); }}
            className="mr-2 text-white/60 hover:text-white/90 flex-shrink-0 md:hidden"
            aria-label="Suche schließen"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && (hasResults || showEmpty) && (
        <div className="absolute right-0 top-full mt-1.5 bg-white rounded-xl shadow-2xl border border-gray-100 w-80 md:w-96 max-h-[26rem] overflow-y-auto z-[90]">
          {showEmpty && (
            <p className="text-center text-gray-500 text-sm py-8">Keine Treffer für &ldquo;{query}&rdquo;</p>
          )}
          {sections.map((section) => {
            let runningBefore = 0;
            for (const s of sections) {
              if (s.type === section.type) break;
              runningBefore += s.items.length;
            }
            return (
              <div key={section.type}>
                <div className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wide bg-gray-50 border-b border-gray-100 ${TYPE_COLOR[section.type]}`}>
                  {TYPE_LABEL[section.type]}
                </div>
                {section.items.map((item, i) => {
                  const idx = runningBefore + i;
                  const isActive = idx === activeIdx;
                  return (
                    <Link
                      key={`${item.type}-${item.data.id}`}
                      href={getResultHref(item)}
                      onClick={() => { setOpen(false); setQuery(""); setMobileExpanded(false); }}
                      onMouseEnter={() => setActiveIdx(idx)}
                      className={`flex flex-col px-3 py-2.5 transition-colors border-b border-gray-50 last:border-0 ${isActive ? "bg-green-50" : "hover:bg-gray-50"}`}
                    >
                      <span className="font-medium text-gray-900 text-sm leading-tight">{getResultLabel(item)}</span>
                      <span className="text-xs text-gray-500 mt-0.5">{getResultSub(item)}</span>
                    </Link>
                  );
                })}
              </div>
            );
          })}
          <div className="px-3 py-2 border-t border-gray-100 text-center">
            <span className="text-xs text-gray-400">↑↓ Navigieren · Enter Öffnen · Esc Schließen</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- NOTIFICATION BELL ----
function NotificationBell() {
  const [notifs, setNotifs] = useState<Notifications | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const loadNotifs = useCallback(async () => {
    try {
      const heute = new Date();
      heute.setHours(23, 59, 59, 999);
      const [aufgabenRes, dashboardRes] = await Promise.all([
        fetch(`/api/aufgaben?status=offen&faelligBis=${heute.toISOString()}`).then((r) => r.json()),
        fetch("/api/dashboard").then((r) => r.json()),
      ]);
      const aufgaben: NotifAufgabe[] = (Array.isArray(aufgabenRes) ? aufgabenRes : []).slice(0, 5).map((a: Record<string, unknown>) => ({
        id: a.id as number,
        betreff: a.betreff as string,
        faelligAm: a.faelligAm as string | null,
        kundeId: a.kundeId as number | null,
        typ: a.typ as string,
      }));
      const rechnungen: NotifRechnung[] = (dashboardRes.faelligeRechnungen ?? []).slice(0, 5);
      const lagerAlarm: NotifArtikel[] = (dashboardRes.lagerKritisch ?? []).slice(0, 5);
      setNotifs({ aufgaben, rechnungen, lagerAlarm });
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadNotifs();
    const interval = setInterval(loadNotifs, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadNotifs]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const overdueRechnungen = notifs?.rechnungen.filter((r) => r.ueberfaelligTage > 0) ?? [];
  const criticalLager = notifs?.lagerAlarm.filter((a) => a.status === "rot") ?? [];
  const totalCount = (notifs?.aufgaben.length ?? 0) + overdueRechnungen.length + criticalLager.length;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded hover:bg-green-700 transition-colors text-white"
        aria-label="Benachrichtigungen"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {totalCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
            {totalCount > 99 ? "99+" : totalCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-2xl border border-gray-100 w-80 max-h-[30rem] overflow-y-auto z-[90]">
          <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">Benachrichtigungen</h3>
            {totalCount > 0 && (
              <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-medium">{totalCount}</span>
            )}
          </div>

          {!notifs && <p className="text-sm text-gray-500 text-center py-6">Wird geladen…</p>}
          {notifs && totalCount === 0 && (
            <p className="text-sm text-gray-500 text-center py-6">Keine Benachrichtigungen</p>
          )}

          {notifs && notifs.aufgaben.length > 0 && (
            <section>
              <div className="px-3 py-1.5 text-xs font-semibold text-orange-700 uppercase tracking-wide bg-orange-50 border-b border-orange-100">
                Fällige Aufgaben ({notifs.aufgaben.length})
              </div>
              {notifs.aufgaben.map((a) => {
                const isOverdue = a.faelligAm && new Date(a.faelligAm) < new Date();
                return (
                  <Link
                    key={a.id}
                    href={`/aufgaben/${a.id}`}
                    onClick={() => setOpen(false)}
                    className="flex flex-col px-3 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                  >
                    <span className="text-sm font-medium text-gray-800 leading-tight">{a.betreff}</span>
                    <span className={`text-xs mt-0.5 ${isOverdue ? "text-red-600" : "text-orange-600"}`}>
                      {isOverdue ? "Überfällig" : "Heute fällig"}
                      {a.faelligAm && ` · ${new Date(a.faelligAm).toLocaleDateString("de-DE")}`}
                    </span>
                  </Link>
                );
              })}
            </section>
          )}

          {notifs && overdueRechnungen.length > 0 && (
            <section>
              <div className="px-3 py-1.5 text-xs font-semibold text-red-700 uppercase tracking-wide bg-red-50 border-b border-red-100">
                Überfällige Rechnungen ({overdueRechnungen.length})
              </div>
              {overdueRechnungen.map((r) => (
                <Link
                  key={r.id}
                  href={`/lieferungen/${r.id}`}
                  onClick={() => setOpen(false)}
                  className="flex flex-col px-3 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                >
                  <span className="text-sm font-medium text-gray-800 leading-tight">{r.kundeName}</span>
                  <span className="text-xs text-red-600 mt-0.5">
                    {r.rechnungNr && `${r.rechnungNr} · `}{r.ueberfaelligTage} Tage überfällig
                  </span>
                </Link>
              ))}
            </section>
          )}

          {notifs && criticalLager.length > 0 && (
            <section>
              <div className="px-3 py-1.5 text-xs font-semibold text-red-700 uppercase tracking-wide bg-red-50 border-b border-red-100">
                Lagerbestand kritisch ({criticalLager.length})
              </div>
              {criticalLager.map((a) => (
                <Link
                  key={a.id}
                  href={`/artikel/${a.id}`}
                  onClick={() => setOpen(false)}
                  className="flex flex-col px-3 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                >
                  <span className="text-sm font-medium text-gray-800 leading-tight">{a.name}</span>
                  <span className="text-xs text-red-600 mt-0.5">
                    Bestand: {a.aktuellerBestand} {a.einheit} (Min: {a.mindestbestand})
                  </span>
                </Link>
              ))}
            </section>
          )}

          <div className="px-3 py-2 border-t border-gray-100">
            <Link href="/aufgaben" onClick={() => setOpen(false)} className="block text-center text-xs text-green-700 hover:text-green-800 hover:underline">
              Alle Aufgaben anzeigen →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- RECENT PAGES ----
function RecentPages() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    addHistoryEntry(pathname);
    setHistory(loadHistory());
  }, [pathname]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const shown = history.filter((e) => e.href !== pathname).slice(0, 7);
  if (shown.length === 0) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Zuletzt besucht"
        className="p-2 rounded hover:bg-green-700 transition-colors text-white/80 hover:text-white"
        aria-label="Verlauf"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-2xl border border-gray-100 w-56 z-[90] py-1">
          <p className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
            Zuletzt besucht
          </p>
          {shown.map((entry) => (
            <Link
              key={entry.href}
              href={entry.href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-green-50 hover:text-green-800 transition-colors"
            >
              <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="truncate">{entry.title}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function DropdownItem({ group, isAnyChildActive }: { group: NavGroup; isAnyChildActive: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
          isAnyChildActive ? "bg-white text-green-800" : "hover:bg-green-700 text-white"
        }`}
      >
        {group.label}
        <svg className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-100 py-1 min-w-[150px] z-50">
          {group.children!.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              onClick={() => setOpen(false)}
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-green-50 hover:text-green-800 transition-colors"
            >
              {c.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState<string | null>(null);
  const [logo, setLogo] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/einstellungen?prefix=system.")
      .then((r) => r.json())
      .then((d) => {
        if (d["system.logo"]) setLogo(d["system.logo"]);
      })
      .catch(() => {});
  }, []);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    if (href === "/kunden") return pathname === "/kunden" || (pathname.startsWith("/kunden/") && !pathname.startsWith("/kunden/karte") && !pathname.startsWith("/kunden/bewertung"));
    return pathname === href || pathname.startsWith(href + "/");
  }

  function isGroupActive(group: NavGroup) {
    if (group.href) return isActive(group.href);
    return group.children?.some((c) => isActive(c.href)) ?? false;
  }

  return (
    <header className="bg-green-800 text-white shadow-md">
      <div className="max-w-screen-xl mx-auto px-4 py-2.5 flex items-center gap-2">
        {/* Logo */}
        <div className="flex-shrink-0">
          {logo ? (
            <img src={logo} alt="Logo" className="h-9 w-auto object-contain" />
          ) : (
            <span className="font-bold text-lg tracking-tight whitespace-nowrap leading-tight">
              <span className="text-white">AgrarOffice</span>
              <span className="text-green-300 text-xs font-normal ml-1.5 hidden sm:inline">Röthemeier</span>
            </span>
          )}
        </div>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1 flex-1 min-w-0">
          {groups.map((g) =>
            g.href ? (
              <Link
                key={g.href}
                href={g.href}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors whitespace-nowrap ${
                  isGroupActive(g) ? "bg-white text-green-800" : "hover:bg-green-700 text-white"
                }`}
              >
                {g.label}
              </Link>
            ) : (
              <DropdownItem key={g.label} group={g} isAnyChildActive={isGroupActive(g)} />
            )
          )}
          <Link
            href="/hilfe"
            title="Hilfe & Features"
            className={`ml-1 w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold transition-colors border flex-shrink-0 ${
              pathname === "/hilfe"
                ? "bg-white text-green-800 border-white"
                : "border-green-600 text-green-200 hover:bg-green-700 hover:border-green-500 hover:text-white"
            }`}
            aria-label="Hilfe"
          >
            ?
          </Link>
        </nav>

        {/* Right side actions: search + bell + history */}
        <div className="hidden md:flex items-center gap-1 flex-shrink-0 ml-auto">
          <HeaderSearch />
          <NotificationBell />
          <RecentPages />
        </div>

        {/* Mobile right side */}
        <div className="md:hidden flex items-center gap-1 ml-auto">
          <HeaderSearch />
          <NotificationBell />
          <RecentPages />
          <button
            className="p-2 rounded hover:bg-green-700 transition-colors"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menü öffnen"
          >
            {open ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <nav className="md:hidden border-t border-green-700 px-4 py-2 flex flex-col gap-1">
          {groups.map((g) =>
            g.href ? (
              <Link
                key={g.href}
                href={g.href}
                onClick={() => setOpen(false)}
                className={`px-3 py-2.5 rounded text-sm font-medium transition-colors ${
                  isGroupActive(g) ? "bg-white text-green-800" : "hover:bg-green-700 text-white"
                }`}
              >
                {g.label}
              </Link>
            ) : (

              <div key={g.label}>
                <button
                  onClick={() => setMobileOpen(mobileOpen === g.label ? null : g.label)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded text-sm font-medium transition-colors ${
                    isGroupActive(g) ? "bg-white/20 text-white" : "hover:bg-green-700 text-white"
                  }`}
                >
                  <span>{g.label}</span>
                  <svg className={`w-4 h-4 transition-transform ${mobileOpen === g.label ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                  </svg>
                </button>
                {mobileOpen === g.label && (
                  <div className="ml-4 mt-1 flex flex-col gap-0.5">
                    {g.children!.map((c) => (
                      <Link
                        key={c.href}
                        href={c.href}
                        onClick={() => { setOpen(false); setMobileOpen(null); }}
                        className={`px-3 py-2 rounded text-sm transition-colors ${
                          isActive(c.href) ? "bg-white text-green-800 font-medium" : "hover:bg-green-700 text-green-100"
                        }`}
                      >
                        {c.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )
          )}
          <div className="border-t border-green-700 mt-1 pt-1">
            <Link
              href="/hilfe"
              onClick={() => setOpen(false)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded text-sm font-medium transition-colors ${
                pathname === "/hilfe" ? "bg-white text-green-800" : "hover:bg-green-700 text-white"
              }`}
            >
              <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-xs font-bold flex-shrink-0">?</span>
              Hilfe &amp; Features
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}

