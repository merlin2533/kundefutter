"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useEffect, useCallback } from "react";
import NotificationCenter from "./NotificationCenter";
import { DEFAULT_LOGO_DATA_URI } from "@/lib/default-logo";

interface NavChild {
  href: string;
  label: string;
  section?: string;
}

interface NavGroup {
  label: string;
  href?: string;
  children?: NavChild[];
}

const groups: NavGroup[] = [
  { label: "Dashboard", href: "/" },
  {
    label: "Kunden",
    children: [
      { href: "/kunden", label: "Kundenliste", section: "Kunden" },
      { href: "/kunden/karte", label: "Karte", section: "Kunden" },
      { href: "/kundenimport", label: "Import", section: "Kunden" },
      { href: "/telefonmaske", label: "Telefonmaske", section: "Kunden" },
      { href: "/preisauskunft", label: "Preisauskunft", section: "Kunden" },
      { href: "/tagesansicht", label: "Tagesansicht", section: "Kunden" },
      { href: "/mailverteiler", label: "Mailverteiler", section: "Kunden" },
      { href: "/kampagnen", label: "Kampagnen", section: "Kunden" },
      { href: "/ki/crm", label: "KI-CRM Notiz", section: "KI" },
      { href: "/ki/sprache", label: "Sprachmemo → CRM", section: "KI" },
    ],
  },
  {
    label: "Vertrieb",
    children: [
      { href: "/crm", label: "CRM / Aktivitäten", section: "CRM" },
      { href: "/besuchstermine", label: "Besuchstermine", section: "CRM" },
      { href: "/aufgaben", label: "Aufgaben / TODO", section: "CRM" },
      { href: "/angebote", label: "Angebote", section: "Aufträge" },
      { href: "/angebot-vorlagen", label: "Angebots-Vorlagen", section: "Aufträge" },
      { href: "/vorbestellungen", label: "Vorbestellungen (Frühbezug)", section: "Aufträge" },
      { href: "/einstellungen/fruehbezug", label: "Frühbezugs-Staffeln", section: "Aufträge" },
      { href: "/kontrakte", label: "Kontrakte", section: "Aufträge" },
    ],
  },
  {
    label: "Pflanze & Tier",
    children: [
      { href: "/bodenproben", label: "Bodenproben", section: "Pflanze" },
      { href: "/bodenanalyse", label: "Albrecht-Analyse", section: "Pflanze" },
      { href: "/duengebedarf", label: "Düngebedarfsermittlung", section: "Pflanze" },
      { href: "/duev", label: "DüV-Sperrfristen", section: "Pflanze" },
      { href: "/duev/bilanz", label: "Nährstoffbilanz (DüV §8)", section: "Pflanze" },
      { href: "/sortenversuche", label: "Sortenversuche", section: "Pflanze" },
      { href: "/anbauplanung", label: "Anbauplanung", section: "Pflanze" },
      { href: "/psm", label: "PSM-Ausbringung", section: "Pflanze" },
      { href: "/spritzfenster", label: "Spritzfenster-Prognose", section: "Pflanze" },
      { href: "/sachkundenachweise", label: "Sachkundenachweise", section: "Pflanze" },
      { href: "/zertifizierungen", label: "Zertifizierungen", section: "Pflanze" },
      { href: "/rationsberechnung", label: "Rationsberechnung", section: "Tier" },
    ],
  },
  {
    label: "Artikel & Lager",
    children: [
      { href: "/artikel", label: "Artikelstamm", section: "Artikel" },
      { href: "/lieferanten", label: "Lieferanten", section: "Artikel" },
      { href: "/kalkulation", label: "Preiskalkulation", section: "Artikel" },
      { href: "/kalkulation/naehrstoffe", label: "Nährstoffkalkulator", section: "Artikel" },
      { href: "/lager", label: "Lager", section: "Lager" },
      { href: "/lager/umbuchungen", label: "Umbuchungen", section: "Lager" },
      { href: "/lager/chargen/zertifikate", label: "Chargen-Zertifikate", section: "Lager" },
      { href: "/lager/mhd", label: "MHD-Übersicht", section: "Lager" },
      { href: "/inventur", label: "Inventur", section: "Lager" },
      { href: "/ki/wareneingang", label: "KI-Wareneingang", section: "KI" },
    ],
  },
  {
    label: "Lieferungen",
    children: [
      { href: "/lieferungen", label: "Lieferungen", section: "Lieferungen" },
      { href: "/ki/lieferung", label: "KI-Lieferung", section: "Lieferungen" },
      { href: "/fahrer", label: "Fahrer-Cockpit", section: "Lieferungen" },
      { href: "/tourenplanung", label: "Tourenplanung", section: "Lieferungen" },
      { href: "/anlieferungen", label: "Erzeugerabrechnung", section: "Lieferungen" },
      { href: "/bestellliste", label: "Bestellliste", section: "Einkauf" },
      { href: "/bestellungen", label: "Lieferantenbestellungen", section: "Einkauf" },
      { href: "/einkaufszettel", label: "Einkaufszettel", section: "Einkauf" },
    ],
  },
  {
    label: "Finanzen",
    children: [
      { href: "/rechnungen", label: "Rechnungen", section: "Ausgangsbelege" },
      { href: "/sammelrechnungen", label: "Sammelrechnungen", section: "Ausgangsbelege" },
      { href: "/gutschriften", label: "Gutschriften", section: "Ausgangsbelege" },
      { href: "/mahnwesen", label: "Mahnwesen", section: "Ausgangsbelege" },
      { href: "/offene-posten", label: "Offene Posten", section: "Ausgangsbelege" },
      { href: "/eingangsrechnungen", label: "Eingangsrechnungen", section: "Eingangsbelege" },
      { href: "/ausgaben", label: "Ausgabenbuch", section: "Eingangsbelege" },
      { href: "/bankabgleich", label: "Bankabgleich", section: "Bank" },
      { href: "/finanzen/cashflow", label: "Cashflow", section: "Bank" },
      { href: "/mengenrabatte", label: "Mengenrabatte", section: "Konditionen" },
      { href: "/exporte", label: "Export", section: "Konditionen" },
    ],
  },
  {
    label: "Analyse",
    children: [
      { href: "/kunden/bewertung", label: "Kundenbewertung", section: "Kunden-Analysen" },
      { href: "/gebietsanalyse", label: "Gebietsanalyse", section: "Kunden-Analysen" },
      { href: "/agrarantraege", label: "Agraranträge (AFIG)", section: "Kunden-Analysen" },
      { href: "/prognose", label: "Prognose", section: "Kunden-Analysen" },
      { href: "/statistik", label: "Statistik & Auswertungen", section: "Statistik" },
      { href: "/statistik/abc", label: "ABC-Analyse", section: "Statistik" },
      { href: "/statistik/saisonal", label: "Saisonale Auswertung", section: "Statistik" },
      { href: "/statistik/deckungsbeitrag", label: "Deckungsbeitrag", section: "Statistik" },
      { href: "/statistik/liquiditaet", label: "Liquiditätsanalyse", section: "Statistik" },
      { href: "/marktpreise", label: "Marktpreise", section: "Markt" },
      { href: "/ki/erkennung", label: "KI-Belegerkennung", section: "KI-Tools" },
    ],
  },
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
  "/fahrer": "Fahrer-Cockpit",
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
  "/statistik/uebersicht": "Statistik-Dashboard",
  "/statistik/kunden": "Kundenauswertung",
  "/statistik/artikel": "Artikelauswertung",
  "/statistik/abc": "ABC-Analyse",
  "/statistik/saisonal": "Saisonale Auswertung",
  "/statistik/deckungsbeitrag": "Deckungsbeitrag",
  "/statistik/budget": "Budgetplanung",
  "/statistik/angebote": "Angebots-Conversion",
  "/statistik/crm": "CRM-Aktivität",
  "/statistik/vorbestellungen": "Vorbestellungen",
  "/statistik/aging": "Offene-Posten-Aging",
  "/statistik/ausgaben": "Ausgaben-Auswertung",
  "/statistik/lieferanten": "Lieferanten / Einkauf",
  "/statistik/lager": "Lager-Auswertung",
  "/statistik/reklamationen": "Reklamationen",
  "/statistik/liquiditaet": "Liquiditätsanalyse",
  "/rechnungen": "Rechnungen",
  "/sammelrechnungen": "Sammelrechnungen",
  "/gutschriften": "Gutschriften",
  "/mahnwesen": "Mahnwesen",
  "/bankabgleich": "Bankabgleich",
  "/bankabgleich/import": "Kontoauszug importieren",
  "/einstellungen/ausgaben": "Ausgaben-Einstellungen",
  "/einstellungen/bankkonten": "Bankkonten",
  "/sachkundenachweise": "Sachkundenachweise",
  "/bodenproben": "Bodenproben",
  "/duengebedarf": "Düngebedarfsermittlung",
  "/sortenversuche": "Sortenversuche",
  "/vorbestellungen": "Vorbestellungen",
  "/einkaufszettel": "Einkaufszettel",
  "/einstellungen/fruehbezug": "Frühbezugs-Staffeln",
  "/rationsberechnung": "Rationsberechnung",
  "/einstellungen/futterwerte": "Futterwerte",
  "/kampagnen": "Kampagnen",
  "/reklamationen": "Reklamationen",
  "/kontrakte": "Kontrakte",
  "/bestellungen": "Lieferantenbestellungen",
  "/eingangsrechnungen": "Eingangsrechnungen",
  "/einkaufszettel": "Einkaufszettel",
  "/offene-posten": "Offene Posten",
  "/anbauplanung": "Anbauplanung",
  "/bodenanalyse": "Albrecht-Analyse",
  "/psm": "PSM-Ausbringung",
  "/spritzfenster": "Spritzfenster-Prognose",
  "/zertifizierungen": "Zertifizierungen",
  "/duev": "DüV-Sperrfristen",
  "/duev/bilanz": "Nährstoffbilanz (DüV §8)",
  "/angebot-vorlagen": "Angebots-Vorlagen",
  "/anlieferungen": "Erzeugerabrechnung",
  "/fahrer/standorte": "Fahrer-Standorte",
  "/finanzen/cashflow": "Cashflow",
  "/kalkulation/naehrstoffe": "Nährstoffkalkulator",
  "/lager/chargen/zertifikate": "Chargen-Zertifikate",
  "/lager/mhd": "MHD-Übersicht",
  "/einstellungen/portal": "Kunden-Portal",
  "/einstellungen/sicherheit": "Sicherheit",
  "/einstellungen/benachrichtigungen": "Benachrichtigungen",
  "/einstellungen/loeschzentrum": "Löschzentrum",
  "/einstellungen/gdpr": "DSGVO / Datenschutz",
  "/einstellungen/mqtt": "MQTT-Automatisierung",
  "/einstellungen/email-import": "E-Mail Import",
  "/einstellungen/cron": "Cron-Verwaltung",
  "/einstellungen/marktpreise": "Marktpreise-Einstellungen",
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
          className="bg-transparent outline-none text-white placeholder-white/60 text-sm px-2.5 py-1.5 w-28 lg:w-48 xl:w-52 focus:text-gray-900 focus:placeholder-gray-400 transition-colors"
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

interface CurrentUser {
  id: number;
  benutzername: string;
  name: string;
  email: string | null;
  rolle: string;
}

function UserMenu() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.user) setUser(d.user); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch { /* ignore */ }
    window.location.href = "/login";
  }

  if (!user) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded hover:bg-green-700 transition-colors"
        title={user.name}
      >
        <span className="w-7 h-7 rounded-full bg-green-600 flex items-center justify-center text-xs font-bold">
          {user.benutzername.slice(0, 2).toUpperCase()}
        </span>
        <span className="hidden lg:inline text-sm font-medium truncate max-w-[120px]">
          {user.benutzername}
        </span>
        <svg className={`w-3.5 h-3.5 transition-transform hidden lg:block ${open ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-2xl border border-gray-100 w-60 z-[90] py-1">
          <div className="px-3 py-2 border-b border-gray-100">
            <div className="text-sm font-semibold text-gray-800 truncate">{user.name}</div>
            <div className="text-xs text-gray-500 truncate">
              {user.benutzername}
              {user.rolle === "admin" && (
                <span className="ml-1.5 text-purple-700 font-medium">· Admin</span>
              )}
            </div>
            {user.email && (
              <div className="text-xs text-gray-400 truncate mt-0.5">{user.email}</div>
            )}
          </div>
          <Link
            href="/einstellungen/benutzer"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm text-gray-700 hover:bg-green-50 hover:text-green-800"
          >
            Benutzerverwaltung
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="block w-full text-left px-3 py-2 text-sm text-red-700 hover:bg-red-50"
          >
            Abmelden
          </button>
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

  const children = group.children ?? [];
  const hasSections = children.some((c) => c.section);

  // Build grouped sections for rendering
  const sections: { name: string; items: NavChild[] }[] = [];
  if (hasSections) {
    for (const c of children) {
      const sName = c.section ?? "";
      const existing = sections.find((s) => s.name === sName);
      if (existing) existing.items.push(c);
      else sections.push({ name: sName, items: [c] });
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-sm font-medium transition-colors ${
          isAnyChildActive ? "bg-white text-green-800" : "hover:bg-green-700 text-white"
        }`}
      >
        {group.label}
        <svg className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-50" style={{ minWidth: "180px" }}>
          {hasSections ? (
            sections.map((sec, si) => (
              <div key={sec.name}>
                {si > 0 && <div className="mx-3 my-1 border-t border-gray-100" />}
                <div className="px-3 pt-1.5 pb-0.5 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                  {sec.name}
                </div>
                {sec.items.map((c) => (
                  <Link
                    key={c.href}
                    href={c.href}
                    onClick={() => setOpen(false)}
                    className="block px-4 py-1.5 text-sm text-gray-700 hover:bg-green-50 hover:text-green-800 transition-colors"
                  >
                    {c.label}
                  </Link>
                ))}
              </div>
            ))
          ) : (
            children.map((c) => (
              <Link
                key={c.href}
                href={c.href}
                onClick={() => setOpen(false)}
                className="block px-4 py-2 text-sm text-gray-700 hover:bg-green-50 hover:text-green-800 transition-colors"
              >
                {c.label}
              </Link>
            ))
          )}
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
  const [appName, setAppName] = useState("AGRI-Office");
  const [firmenname, setFirmenname] = useState("");

  const hideNav = pathname === "/login" || pathname.startsWith("/login/");

  useEffect(() => {
    if (hideNav) return;
    fetch("/api/einstellungen?prefix=system.")
      .then((r) => r.json())
      .then((d) => {
        if (d["system.logo"]) setLogo(d["system.logo"]);
        if (d["system.appname"]) setAppName(d["system.appname"]);
        if (d["system.firmenname"]) setFirmenname(d["system.firmenname"]);
      })
      .catch(() => {});
  }, [hideNav]);

  if (hideNav) return null;

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
      <div className="max-w-screen-2xl mx-auto px-4 py-2.5 flex items-center gap-2">
        {/* Logo */}
        <div className="flex-shrink-0">
          {logo ? (
            <img src={logo} alt={appName} className="h-9 w-auto object-contain" />
          ) : (
            <span className="flex items-center gap-2 whitespace-nowrap leading-tight">
              <img src={DEFAULT_LOGO_DATA_URI} alt="" className="h-9 w-9 object-contain" />
              <span className="font-bold text-lg tracking-tight">
                <span className="text-white">{appName}</span>
                {firmenname && (
                  <span className="text-green-300 text-xs font-normal ml-1.5 hidden sm:inline">{firmenname}</span>
                )}
              </span>
            </span>
          )}
        </div>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-0.5 flex-1 min-w-0">
          {groups.map((g) =>
            g.href ? (
              <Link
                key={g.href}
                href={g.href}
                className={`px-2.5 py-1.5 rounded text-sm font-medium transition-colors whitespace-nowrap ${
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

        {/* Right side actions: search + notifications + history + settings + user */}
        <div className="hidden md:flex items-center gap-1 flex-shrink-0 ml-auto">
          <HeaderSearch />
          <NotificationCenter />
          <RecentPages />
          <Link
            href="/einstellungen"
            title="Einstellungen"
            aria-label="Einstellungen"
            className={`p-2 rounded transition-colors ${
              pathname === "/einstellungen" || pathname.startsWith("/einstellungen/")
                ? "bg-white text-green-800"
                : "hover:bg-green-700 text-white"
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </Link>
          <UserMenu />
        </div>

        {/* Mobile right side */}
        <div className="md:hidden flex items-center gap-1 ml-auto">
          <HeaderSearch />
          <NotificationCenter />
          <RecentPages />
          <UserMenu />
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
              href="/einstellungen"
              onClick={() => setOpen(false)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded text-sm font-medium transition-colors ${
                pathname === "/einstellungen" || pathname.startsWith("/einstellungen/")
                  ? "bg-white text-green-800"
                  : "hover:bg-green-700 text-white"
              }`}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Einstellungen
            </Link>
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

