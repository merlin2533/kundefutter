"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

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

type ResultItem =
  | { type: "kunde"; data: KundeResult }
  | { type: "artikel"; data: ArtikelResult }
  | { type: "lieferung"; data: LieferungResult };

function getHref(item: ResultItem): string {
  switch (item.type) {
    case "kunde":
      return `/kunden/${item.data.id}`;
    case "artikel":
      return `/artikel/${item.data.id}`;
    case "lieferung":
      return `/lieferungen/${item.data.id}`;
  }
}

function flattenResults(results: SearchResults): ResultItem[] {
  const items: ResultItem[] = [];
  for (const k of results.kunden) items.push({ type: "kunde", data: k });
  for (const a of results.artikel) items.push({ type: "artikel", data: a });
  for (const l of results.lieferungen) items.push({ type: "lieferung", data: l });
  return items;
}

// Icons as inline SVG
function KundeIcon() {
  return (
    <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

function ArtikelIcon() {
  return (
    <svg className="w-4 h-4 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
    </svg>
  );
}

function LieferungIcon() {
  return (
    <svg className="w-4 h-4 text-orange-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  );
}

function ResultIcon({ type }: { type: ResultItem["type"] }) {
  if (type === "kunde") return <KundeIcon />;
  if (type === "artikel") return <ArtikelIcon />;
  return <LieferungIcon />;
}

function ResultPrimary({ item }: { item: ResultItem }) {
  if (item.type === "kunde") {
    return <span className="font-medium text-gray-900">{item.data.name}</span>;
  }
  if (item.type === "artikel") {
    return <span className="font-medium text-gray-900">{item.data.name}</span>;
  }
  const l = item.data;
  const kundenname = l.kunde?.firma || l.kunde?.name || "–";
  return <span className="font-medium text-gray-900">{kundenname}</span>;
}

function ResultSecondary({ item }: { item: ResultItem }) {
  if (item.type === "kunde") {
    const d = item.data;
    const loc = [d.plz, d.ort].filter(Boolean).join(" ");
    return <span className="text-gray-500 text-sm">{d.firma ? `${d.firma} · ` : ""}{loc || "–"}</span>;
  }
  if (item.type === "artikel") {
    const d = item.data;
    const parts = [d.artikelnummer, d.kategorie].filter(Boolean).join(" · ");
    return <span className="text-gray-500 text-sm">{parts || "–"}</span>;
  }
  const l = item.data;
  const date = l.datum ? new Date(l.datum).toLocaleDateString("de-DE") : "–";
  return (
    <span className="text-gray-500 text-sm">
      {l.rechnungNr ? `${l.rechnungNr} · ` : ""}{date} · {l.status}
    </span>
  );
}

// ---- Inline CRM Form ----

const TYP_OPTIONS = [
  { value: "anruf", label: "Anruf" },
  { value: "besuch", label: "Besuch" },
  { value: "email", label: "E-Mail" },
  { value: "notiz", label: "Notiz" },
  { value: "aufgabe", label: "Aufgabe" },
];

interface CrmFormProps {
  initialKunde?: KundeResult | null;
  onBack: () => void;
  onClose: () => void;
}

function CrmInlineForm({ initialKunde, onBack, onClose }: CrmFormProps) {
  const [kundeQuery, setKundeQuery] = useState(
    initialKunde ? (initialKunde.firma ?? initialKunde.name) : ""
  );
  const [selectedKunde, setSelectedKunde] = useState<KundeResult | null>(initialKunde ?? null);
  const [kundeSuggestions, setKundeSuggestions] = useState<KundeResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [typ, setTyp] = useState("anruf");
  const [betreff, setBetreff] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const kundeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchKunden = useCallback((q: string) => {
    if (kundeDebounceRef.current) clearTimeout(kundeDebounceRef.current);
    if (q.length < 2) {
      setKundeSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    kundeDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/kunden?search=${encodeURIComponent(q)}&limit=5&page=1`);
        const data = await res.json();
        const kunden: KundeResult[] = Array.isArray(data) ? data : (data.kunden ?? []);
        setKundeSuggestions(kunden);
        setShowSuggestions(true);
      } catch {
        setKundeSuggestions([]);
      }
    }, 200);
  }, []);

  const handleKundeInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setKundeQuery(val);
    setSelectedKunde(null);
    searchKunden(val);
  };

  const selectKunde = (k: KundeResult) => {
    setSelectedKunde(k);
    setKundeQuery(k.firma ?? k.name);
    setShowSuggestions(false);
  };

  const handleSave = async () => {
    if (!betreff.trim()) {
      setError("Betreff ist erforderlich.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        typ,
        betreff: betreff.trim(),
        datum: new Date().toISOString(),
      };
      if (selectedKunde) body.kundeId = selectedKunde.id;
      const res = await fetch("/api/kunden/aktivitaeten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Fehler beim Speichern");
      setSaved(true);
      setTimeout(() => onClose(), 900);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 flex flex-col gap-3">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 self-start"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Zurück
      </button>

      <h3 className="font-semibold text-gray-800">CRM Aktivität erfassen</h3>

      {/* Kunde */}
      <div className="relative">
        <label className="text-xs font-medium text-gray-600 mb-1 block">Kunde</label>
        <input
          type="text"
          value={kundeQuery}
          onChange={handleKundeInput}
          onFocus={() => kundeQuery.length >= 2 && setShowSuggestions(true)}
          placeholder="Kunde suchen…"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-400"
        />
        {showSuggestions && kundeSuggestions.length > 0 && (
          <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-40 overflow-y-auto">
            {kundeSuggestions.map((k) => (
              <button
                key={k.id}
                onMouseDown={() => selectKunde(k)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-green-50 flex flex-col"
              >
                <span className="font-medium text-gray-800">{k.firma ?? k.name}</span>
                {k.firma && <span className="text-xs text-gray-500">{k.name}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Typ */}
      <div>
        <label className="text-xs font-medium text-gray-600 mb-1 block">Typ</label>
        <select
          value={typ}
          onChange={(e) => setTyp(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-400 bg-white"
        >
          {TYP_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Betreff */}
      <div>
        <label className="text-xs font-medium text-gray-600 mb-1 block">Betreff *</label>
        <input
          type="text"
          value={betreff}
          onChange={(e) => setBetreff(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          placeholder="Kurzbeschreibung…"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-400"
        />
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {saved ? (
        <p className="text-sm text-green-600 font-medium text-center py-1">Gespeichert!</p>
      ) : (
        <button
          onClick={handleSave}
          disabled={saving || !betreff.trim()}
          className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-sm transition-colors"
        >
          {saving ? "Speichern…" : "Speichern"}
        </button>
      )}
    </div>
  );
}

// ---- Main SearchPalette ----

export default function SearchPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  // "main" | "crm"
  const [view, setView] = useState<"main" | "crm">("main");
  const [crmPreselectedKunde, setCrmPreselectedKunde] = useState<KundeResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

  // Open on Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 10);
      setQuery("");
      setResults(null);
      setActiveIndex(0);
      setView("main");
      setCrmPreselectedKunde(null);
    }
  }, [open]);

  // Debounced search
  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/suche?q=${encodeURIComponent(q)}`);
        const data: SearchResults = await res.json();
        setResults(data);
        setActiveIndex(0);
      } catch {
        setResults({ kunden: [], artikel: [], lieferungen: [] });
      } finally {
        setLoading(false);
      }
    }, 150);
  }, []);

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    search(val);
  };

  const flatItems = results ? flattenResults(results) : [];
  const hasResults = flatItems.length > 0;
  const showEmpty = query.length >= 2 && !loading && results !== null && !hasResults;
  const showSchnellaktionen = query.length < 2;

  const navigate = useCallback(
    (item: ResultItem) => {
      router.push(getHref(item));
      setOpen(false);
    },
    [router]
  );

  const openCrmForKunde = useCallback((kunde: KundeResult) => {
    setCrmPreselectedKunde(kunde);
    setView("crm");
  }, []);

  // Keyboard navigation inside palette
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!hasResults) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % flatItems.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + flatItems.length) % flatItems.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = flatItems[activeIndex];
      if (item) navigate(item);
    }
  };

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const active = listRef.current.querySelector("[data-active='true']");
    if (active) (active as HTMLElement).scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (!open) return null;

  // Build grouped sections
  type Section = { label: string; type: ResultItem["type"]; items: ResultItem[] };
  const sections: Section[] = (
    [
      { label: "Kunden", type: "kunde" as const, items: flatItems.filter((i) => i.type === "kunde") },
      { label: "Artikel", type: "artikel" as const, items: flatItems.filter((i) => i.type === "artikel") },
      { label: "Lieferungen", type: "lieferung" as const, items: flatItems.filter((i) => i.type === "lieferung") },
    ] as Section[]
  ).filter((s) => s.items.length > 0);

  // Compute flat index offset per section for activeIndex tracking
  let runningIndex = 0;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[100] flex items-start justify-center pt-[10vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-xl w-full mx-4 overflow-hidden flex flex-col"
        style={{ maxHeight: "70vh" }}
        onKeyDown={view === "main" ? handleKeyDown : undefined}
      >
        {view === "crm" ? (
          <CrmInlineForm
            initialKunde={crmPreselectedKunde}
            onBack={() => { setView("main"); setCrmPreselectedKunde(null); }}
            onClose={() => setOpen(false)}
          />
        ) : (
          <>
            {/* Input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
              <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={handleQueryChange}
                placeholder="Suchen…"
                className="flex-1 outline-none text-gray-900 placeholder-gray-400 text-base bg-transparent"
              />
              <div className="flex items-center gap-1 flex-shrink-0">
                {loading && (
                  <svg className="w-4 h-4 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                )}
                <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-xs font-medium text-gray-500 bg-gray-100 border border-gray-200 rounded">
                  {isMac ? "⌘K" : "Ctrl+K"}
                </kbd>
              </div>
            </div>

            {/* Results */}
            <div ref={listRef} className="overflow-y-auto flex-1">
              {/* Schnellaktionen (shown when query < 2 chars) */}
              {showSchnellaktionen && (
                <div className="p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Schnellaktionen
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setView("crm")}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-orange-200 bg-orange-50 hover:bg-orange-100 text-sm font-medium text-orange-800 transition-colors"
                    >
                      <span className="text-base leading-none">💬</span>
                      <span>+ CRM Aktivität</span>
                    </button>
                    <button
                      onClick={() => { router.push("/lieferungen/neu"); setOpen(false); }}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-green-200 bg-green-50 hover:bg-green-100 text-sm font-medium text-green-800 transition-colors"
                    >
                      <span className="text-base leading-none">📦</span>
                      <span>+ Neue Lieferung</span>
                    </button>
                    <button
                      onClick={() => { router.push("/angebote/neu"); setOpen(false); }}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-sm font-medium text-blue-800 transition-colors"
                    >
                      <span className="text-base leading-none">📝</span>
                      <span>+ Neues Angebot</span>
                    </button>
                    <button
                      onClick={() => { router.push("/kunden/neu"); setOpen(false); }}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-purple-200 bg-purple-50 hover:bg-purple-100 text-sm font-medium text-purple-800 transition-colors"
                    >
                      <span className="text-base leading-none">👤</span>
                      <span>+ Neuer Kunde</span>
                    </button>
                  </div>
                </div>
              )}

              {!showSchnellaktionen && showEmpty && (
                <p className="text-center text-gray-500 text-sm py-8">
                  Keine Treffer für &ldquo;{query}&rdquo;
                </p>
              )}

              {sections.map((section) => {
                const sectionStart = runningIndex;
                runningIndex += section.items.length;
                return (
                  <div key={section.label}>
                    <div className="px-4 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                      <ResultIcon type={section.type} />
                      {section.label}
                    </div>
                    {section.items.map((item, i) => {
                      const idx = sectionStart + i;
                      const isActive = idx === activeIndex;
                      const isKunde = item.type === "kunde";
                      return (
                        <button
                          key={`${item.type}-${item.data.id}`}
                          data-active={isActive}
                          onMouseEnter={() => setActiveIndex(idx)}
                          onClick={() => navigate(item)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                            isActive ? "bg-green-50" : "hover:bg-gray-50"
                          }`}
                        >
                          <ResultIcon type={item.type} />
                          <div className="flex flex-col min-w-0 flex-1">
                            <ResultPrimary item={item} />
                            <ResultSecondary item={item} />
                          </div>
                          {isActive && (
                            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          )}
                          {/* Kunde quick-action buttons */}
                          {isKunde && (
                            <div className="flex items-center gap-1 flex-shrink-0 ml-1" onClick={(e) => e.stopPropagation()}>
                              <button
                                title="Neue Lieferung für diesen Kunden"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(`/lieferungen/neu?kundeId=${(item.data as KundeResult).id}`);
                                  setOpen(false);
                                }}
                                className="text-sm px-1.5 py-0.5 rounded hover:bg-green-100 transition-colors"
                              >
                                📦
                              </button>
                              <button
                                title="CRM Aktivität für diesen Kunden"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openCrmForKunde(item.data as KundeResult);
                                }}
                                className="text-sm px-1.5 py-0.5 rounded hover:bg-orange-100 transition-colors"
                              >
                                📝
                              </button>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Footer hint */}
            <div className="flex items-center gap-4 px-4 py-2 border-t border-gray-100 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-200 rounded text-xs">↑↓</kbd>
                Navigieren
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-200 rounded text-xs">↵</kbd>
                Öffnen
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-200 rounded text-xs">Esc</kbd>
                Schließen
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
