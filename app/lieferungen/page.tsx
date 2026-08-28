"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { MargeBadge } from "@/components/Badge";
import { formatEuro, formatDatum } from "@/lib/utils";
import { useScrollRestoration } from "@/lib/useScrollRestoration";
import Pagination from "@/components/Pagination";
import { ErrorState } from "@/components/ErrorState";
import * as Sentry from "@sentry/nextjs";

interface Lieferung {
  id: number;
  datum: string;
  createdAt: string;
  kunde: { id: number; name: string; firma?: string };
  status: string;
  notiz?: string;
  rechnungNr?: string | null;
  rechnungVersendetAm?: string | null;
  lieferscheinVersendetAm?: string | null;
  istStreckengeschaeft?: boolean;
  positionen: {
    id: number;
    menge: number;
    verkaufspreis: number;
    einkaufspreis: number;
    artikel: { name: string };
  }[];
}

interface WiederkehrendBedarf {
  bedarf: {
    id: number;
    kundeId: number;
    artikelId: number;
    menge: number;
    intervallTage: number;
    kunde: { name: string };
    artikel: { name: string; einheit: string };
  };
  letztesDatum?: string;
  naechstesDatum?: string;
  ueberfaellig: boolean;
}

function loadLieferungFilters() {
  try { return JSON.parse(sessionStorage.getItem("lieferung-filters") ?? "{}"); } catch (err) {
    Sentry.captureException(err);
    return {};
  }
}

export default function LieferungenPage() {
  const [tab, setTab] = useState<"liste" | "wiederkehrend">("liste");
  const [filtersLoaded, setFiltersLoaded] = useState(false);

  // List state
  const [lieferungen, setLieferungen] = useState<Lieferung[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("alle");
  const [versandFilter, setVersandFilter] = useState<"alle" | "lieferschein_offen" | "rechnung_offen">("alle");
  const [vonFilter, setVonFilter] = useState<string>("");
  const [bisFilter, setBisFilter] = useState<string>("");
  const [kundeSearch, setKundeSearch] = useState<string>("");
  const [kundeIdFilter, setKundeIdFilter] = useState<string>("");
  const [kundeFilterName, setKundeFilterName] = useState<string>("");
  const [sortFilter, setSortFilter] = useState<"createdAt" | "datum">("createdAt");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [statusChangingId, setStatusChangingId] = useState<number | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const PAGE_SIZE = 100;

  // Wiederkehrend state
  const [wiederkehrend, setWiederkehrend] = useState<WiederkehrendBedarf[]>([]);
  const [wLoading, setWLoading] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [wSaving, setWSaving] = useState(false);
  const [faelligeAnzahl, setFaelligeAnzahl] = useState(0);
  const [wErfolgMsg, setWErfolgMsg] = useState("");

  const fetchLieferungen = useCallback(async (pageNum = 1) => {
    setLoading(true);
    setFetchError(null);
    const params = new URLSearchParams();
    if (statusFilter !== "alle") params.set("status", statusFilter);
    if (vonFilter) params.set("von", vonFilter);
    if (bisFilter) params.set("bis", bisFilter);
    if (kundeSearch) params.set("search", kundeSearch);
    if (kundeIdFilter) params.set("kundeId", kundeIdFilter);
    if (versandFilter === "lieferschein_offen") params.set("lieferscheinOffen", "true");
    if (versandFilter === "rechnung_offen") params.set("rechnungOffen", "true");
    params.set("sort", sortFilter);
    params.set("limit", String(PAGE_SIZE));
    params.set("page", String(pageNum));
    try {
      const res = await fetch(`/api/lieferungen?${params}`);
      if (!res.ok) {
        const d = await res.json().catch((err) => {
          Sentry.captureException(err);
          return ({});
        }) as { error?: string };
        setFetchError(d.error ?? `Serverfehler ${res.status}`);
        setLieferungen([]);
      } else {
        const json = await res.json();
        setLieferungen(Array.isArray(json.data) ? json.data : []);
        setTotal(typeof json.total === "number" ? json.total : 0);
        setTotalPages(typeof json.totalPages === "number" ? json.totalPages : 1);
      }
    } catch (err) {
      Sentry.captureException(err);
      setFetchError("Netzwerkfehler – Seite neu laden");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, versandFilter, vonFilter, bisFilter, kundeSearch, kundeIdFilter, sortFilter]);

  // Filter geändert → zurück auf Seite 1
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); fetchLieferungen(1); }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchLieferungen]);

  const firstPageLoadRef = useRef(true);
  useEffect(() => {
    if (firstPageLoadRef.current) { firstPageLoadRef.current = false; return; }
    fetchLieferungen(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // Kunden-Filter aus URL übernehmen (Absprung aus der Kundenakte: ?kundeId=…&offen=1)
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const kid = sp.get("kundeId");
    if (!kid) return;
    setKundeIdFilter(kid);
    if (sp.get("offen") === "1") setStatusFilter("geplant");
    fetch(`/api/kunden/${kid}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((k) => { if (k) setKundeFilterName(k.firma ? `${k.firma} (${k.name})` : k.name); })
      .catch((err) => {
        Sentry.captureException(err);
      });
  }, []);

  // Gespeicherte Filter erst nach dem Mount wiederherstellen (verhindert SSR/Client-Hydration-Mismatch, React #418)
  useEffect(() => {
    const f = loadLieferungFilters();
    if (f.tab) setTab(f.tab);
    if (f.statusFilter) setStatusFilter(f.statusFilter);
    if (f.versandFilter === "lieferschein_offen" || f.versandFilter === "rechnung_offen") setVersandFilter(f.versandFilter);
    if (f.vonFilter) setVonFilter(f.vonFilter);
    if (f.bisFilter) setBisFilter(f.bisFilter);
    if (f.kundeSearch) setKundeSearch(f.kundeSearch);
    if (f.sortFilter === "datum" || f.sortFilter === "createdAt") setSortFilter(f.sortFilter);
    setFiltersLoaded(true);
  }, []);

  useEffect(() => {
    if (!filtersLoaded) return;
    try { sessionStorage.setItem("lieferung-filters", JSON.stringify({ tab, statusFilter, versandFilter, vonFilter, bisFilter, kundeSearch, sortFilter })); } catch (err) {
      Sentry.captureException(err);
    }
  }, [filtersLoaded, tab, statusFilter, versandFilter, vonFilter, bisFilter, kundeSearch, sortFilter]);

  useScrollRestoration(tab === "liste" && !loading && lieferungen.length > 0);

  async function fetchWiederkehrend() {
    setWLoading(true);
    const res = await fetch("/api/lieferungen/wiederkehrend?tage=30");
    const data = await res.json();
    const liste = Array.isArray(data) ? data : [];
    setWiederkehrend(liste);
    setFaelligeAnzahl(liste.filter((w: WiederkehrendBedarf) => w.ueberfaellig).length);
    setWLoading(false);
  }

  useEffect(() => {
    if (tab === "wiederkehrend") fetchWiederkehrend();
  }, [tab]);

  async function handleAlleAusloesen() {
    setWSaving(true);
    setWErfolgMsg("");
    try {
      const res = await fetch("/api/lieferungen/wiederkehrend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alleAusloesen: true }),
      });
      const result = await res.json();
      setWErfolgMsg(`${result.ausgeloest} Lieferung(en) erfolgreich angelegt.`);
      setSelected(new Set());
      await fetchWiederkehrend();
    } finally {
      setWSaving(false);
    }
  }

  async function handleEinzelnAusloesen(bedarfId: number) {
    setWSaving(true);
    setWErfolgMsg("");
    try {
      const res = await fetch("/api/lieferungen/wiederkehrend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bedarfIds: [bedarfId] }),
      });
      const result = await res.json();
      setWErfolgMsg(`${result.ausgeloest} Lieferung erfolgreich angelegt.`);
      await fetchWiederkehrend();
    } finally {
      setWSaving(false);
    }
  }

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === wiederkehrend.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(wiederkehrend.map((w) => w.bedarf.id)));
    }
  }

  async function handleWiederkehrendAnlegen() {
    if (selected.size === 0) return;
    setWSaving(true);
    setWErfolgMsg("");
    try {
      const res = await fetch("/api/lieferungen/wiederkehrend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bedarfIds: Array.from(selected) }),
      });
      const result = await res.json();
      setWErfolgMsg(`${result.ausgeloest} Lieferung(en) erfolgreich angelegt.`);
      setSelected(new Set());
      await fetchWiederkehrend();
    } finally {
      setWSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Lieferung wirklich löschen?")) return;
    setDeletingId(id);
    try {
      await fetch(`/api/lieferungen/${id}`, { method: "DELETE" });
      await fetchLieferungen(page);
    } finally {
      setDeletingId(null);
    }
  }

  async function markiereGeliefert(id: number) {
    if (!confirm("Auftrag als geliefert bestätigen und Lieferschein erstellen? Der Lagerbestand wird gebucht.")) return;
    setStatusChangingId(id);
    try {
      const res = await fetch(`/api/lieferungen/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "geliefert" }),
      });
      if (!res.ok) {
        const d = await res.json().catch((err) => {
          Sentry.captureException(err);
          return ({});
        });
        alert(d.error ?? "Status konnte nicht geändert werden");
        return;
      }
      await fetchLieferungen(page);
    } finally {
      setStatusChangingId(null);
    }
  }

  function calcUmsatz(l: Lieferung) {
    return l.positionen.reduce((sum, p) => sum + p.menge * p.verkaufspreis, 0);
  }
  function calcMarge(l: Lieferung) {
    return l.positionen.reduce((sum, p) => sum + p.menge * (p.verkaufspreis - p.einkaufspreis), 0);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <span className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">Aufträge & Lieferscheine</h1>
          <Link href="/hilfe#lieferungen" title="Hilfe: Lieferungen & Angebote" className="text-gray-400 hover:text-green-700 transition-colors" tabIndex={-1}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </Link>
        </span>
        <Link
          href="/lieferungen/neu"
          title="Neuer Auftrag"
          className="inline-flex items-center gap-1.5 bg-green-800 hover:bg-green-700 text-white px-2.5 sm:px-4 py-2.5 rounded-lg text-sm font-medium transition-colors w-auto text-center"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          <span className="hidden sm:inline">Neuer Auftrag</span>
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {(["liste", "wiederkehrend"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t
                ? "border-green-800 text-green-800"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "liste" ? "Aufträge & Lieferscheine" : "Wiederkehrend"}
          </button>
        ))}
      </div>

      {tab === "liste" && (
        <>
          {kundeIdFilter && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 bg-green-50 border border-green-200 text-green-800 rounded-lg px-4 py-3 text-sm">
              <span>
                Gefiltert nach Kunde:{" "}
                <strong>{kundeFilterName || `#${kundeIdFilter}`}</strong>
                {" "}— offene Aufträge &amp; Lieferscheine
              </span>
              <button
                onClick={() => { setKundeIdFilter(""); setKundeFilterName(""); setStatusFilter("alle"); window.history.replaceState(null, "", "/lieferungen"); }}
                className="px-3 py-1.5 bg-white border border-green-300 text-green-700 rounded-lg hover:bg-green-100 transition-colors whitespace-nowrap"
              >
                Filter aufheben
              </button>
            </div>
          )}
          {/* Filters */}
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 mb-5">
            <div className="flex gap-1 flex-wrap">
              {([
                { value: "alle", label: "Alle" },
                { value: "geplant", label: "Aufträge" },
                { value: "geliefert", label: "Lieferscheine" },
                { value: "storniert", label: "Storniert" },
              ] as const).map((s) => (
                <button
                  key={s.value}
                  onClick={() => setStatusFilter(s.value)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    statusFilter === s.value
                      ? "bg-green-800 text-white border-green-800"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2 items-center flex-wrap">
              <input
                type="date"
                value={vonFilter}
                onChange={(e) => setVonFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
              />
              <span className="text-gray-500 text-sm">bis</span>
              <input
                type="date"
                value={bisFilter}
                onChange={(e) => setBisFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
              />
            </div>
            <input
              type="text"
              placeholder="Kunde suchen…"
              value={kundeSearch}
              onChange={(e) => setKundeSearch(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full sm:w-52 focus:outline-none focus:ring-2 focus:ring-green-700"
            />
            <select
              value={versandFilter}
              onChange={(e) => setVersandFilter(e.target.value as "alle" | "lieferschein_offen" | "rechnung_offen")}
              title="Versand-Status"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700 bg-white"
            >
              <option value="alle">Versand: Alle</option>
              <option value="lieferschein_offen">Lieferschein noch nicht versendet</option>
              <option value="rechnung_offen">Rechnung noch nicht versendet</option>
            </select>
            <select
              value={sortFilter}
              onChange={(e) => setSortFilter(e.target.value as "createdAt" | "datum")}
              title="Sortierung"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700 bg-white"
            >
              <option value="createdAt">Neueste Erstellung zuerst</option>
              <option value="datum">Neuestes Lieferdatum zuerst</option>
            </select>
          </div>

          {fetchError ? (
            <ErrorState message={fetchError} onRetry={() => fetchLieferungen(page)} />
          ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto shadow-sm">
            {loading ? (
              <p className="p-6 text-gray-400 text-sm">Lade…</p>
            ) : lieferungen.length === 0 ? (
              <p className="p-6 text-gray-400 text-sm">Keine Aufträge / Lieferscheine gefunden.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {[
                      { label: "Datum", cls: "" },
                      { label: "Kunde", cls: "" },
                      { label: "Positionen", cls: "hidden md:table-cell" },
                      { label: "Gesamtumsatz", cls: "hidden sm:table-cell" },
                      { label: "Gesamtmarge", cls: "hidden lg:table-cell" },
                      { label: "Vorgangskette", cls: "" },
                      { label: "Aktionen", cls: "" },
                    ].map((h) => (
                      <th key={h.label} className={`px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap ${h.cls}`}>
                        {h.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lieferungen.map((l) => {
                    const umsatz = calcUmsatz(l);
                    const marge = calcMarge(l);
                    const margePct = umsatz > 0 ? (marge / umsatz) * 100 : 0;
                    return (
                      <tr key={l.id} className="border-b last:border-0 hover:bg-green-50 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          {formatDatum(l.datum)}
                          {l.createdAt && l.createdAt.slice(0, 10) !== l.datum.slice(0, 10) && (
                            <div className="text-xs text-gray-400">Erstellt: {formatDatum(l.createdAt)}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium">
                          {l.kunde.firma ? `${l.kunde.firma} (${l.kunde.name})` : l.kunde.name}
                          <div className="sm:hidden text-xs text-gray-500 font-mono mt-0.5">
                            {formatEuro(umsatz)}
                            {l.istStreckengeschaeft && (
                              <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700 border border-purple-200">
                                🔀 Strecke
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="hidden md:table-cell px-4 py-3 max-w-[220px]">
                          <div
                            className="text-xs text-gray-700 truncate"
                            title={l.positionen.map((p) => p.artikel.name).join(", ")}
                          >
                            {l.positionen.map((p) => p.artikel.name).join(", ")}
                          </div>
                        </td>
                        <td className="hidden sm:table-cell px-4 py-3 font-mono whitespace-nowrap">{formatEuro(umsatz)}</td>
                        <td className="hidden lg:table-cell px-4 py-3">
                          <MargeBadge pct={margePct} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 flex-wrap text-xs">
                            {/* Schritt 1: Auftrag — immer vorhanden */}
                            <Link
                              href={`/lieferungen/${l.id}`}
                              title="Auftrag anzeigen"
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded font-medium bg-green-100 text-green-800 border border-green-200 hover:bg-green-200 transition-colors whitespace-nowrap"
                            >
                              ✓ Auftrag
                            </Link>
                            <span className="text-gray-300">›</span>
                            {/* Schritt 2: Lieferschein */}
                            {l.status === "storniert" ? (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded font-medium bg-red-100 text-red-700 border border-red-200 whitespace-nowrap">
                                ✕ Storniert
                              </span>
                            ) : l.status === "geliefert" ? (
                              <Link
                                href={`/lieferungen/${l.id}/lieferschein`}
                                title="Lieferschein anzeigen"
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded font-medium bg-green-100 text-green-800 border border-green-200 hover:bg-green-200 transition-colors whitespace-nowrap"
                              >
                                ✓ Lieferschein
                                {!l.lieferscheinVersendetAm && (
                                  <span title="Noch nicht per E-Mail versendet" className="text-amber-600">✉</span>
                                )}
                              </Link>
                            ) : (
                              <button
                                onClick={() => markiereGeliefert(l.id)}
                                disabled={statusChangingId === l.id}
                                title="Als geliefert bestätigen"
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded font-medium bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100 transition-colors whitespace-nowrap disabled:opacity-50"
                              >
                                {statusChangingId === l.id ? "…" : "○"} Lieferschein
                              </button>
                            )}
                            {l.status !== "storniert" && (
                              <>
                                <span className="text-gray-300">›</span>
                                {/* Schritt 3: Rechnung */}
                                {l.rechnungNr ? (
                                  <Link
                                    href={`/lieferungen/${l.id}/rechnung`}
                                    title={`Rechnung ${l.rechnungNr} anzeigen`}
                                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded font-medium bg-green-100 text-green-800 border border-green-200 hover:bg-green-200 transition-colors whitespace-nowrap"
                                  >
                                    ✓ Rechnung
                                    {!l.rechnungVersendetAm && (
                                      <span title="Noch nicht versendet (E-Mail oder Post)" className="text-amber-600">✉</span>
                                    )}
                                  </Link>
                                ) : (
                                  <Link
                                    href={`/lieferungen/${l.id}`}
                                    title="Rechnung erstellen"
                                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded font-medium bg-gray-50 text-gray-500 border border-gray-300 hover:bg-gray-100 transition-colors whitespace-nowrap"
                                  >
                                    ○ Rechnung
                                  </Link>
                                )}
                              </>
                            )}
                          </div>
                          {l.istStreckengeschaeft && (
                            <span className="mt-0.5 hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700 border border-purple-200">
                              🔀 Strecke
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-0.5">
                            <Link
                              href={`/lieferungen/${l.id}`}
                              className="p-1.5 text-green-700 hover:bg-green-50 hover:text-green-900 rounded transition-colors"
                              title="Details"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                            </Link>
                            {l.status !== "geliefert" && (
                              <button
                                onClick={() => handleDelete(l.id)}
                                disabled={deletingId === l.id}
                                className="p-1.5 text-red-600 hover:bg-red-50 hover:text-red-800 rounded transition-colors disabled:opacity-50"
                                title="Auftrag löschen"
                              >
                                {deletingId === l.id ? <span className="w-4 h-4 flex items-center justify-center text-xs">…</span> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          )}

          {!fetchError && !loading && total > PAGE_SIZE && (
            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              info={`${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} von ${total}`}
            />
          )}
        </>
      )}

      {tab === "wiederkehrend" && (
        <div>
          {faelligeAnzahl > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
              <span className="text-orange-800 font-medium">
                {faelligeAnzahl} wiederkehrende Lieferung(en) fällig
              </span>
              <button
                onClick={handleAlleAusloesen}
                disabled={wSaving}
                className="px-3 py-2.5 sm:py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded text-sm font-medium transition-colors disabled:opacity-50 w-full sm:w-auto"
              >
                {wSaving ? "Auslösen…" : "Alle jetzt auslösen"}
              </button>
            </div>
          )}

          {wErfolgMsg && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 text-green-800 text-sm font-medium">
              {wErfolgMsg}
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
            <p className="text-sm text-gray-500">Regelmäßige Bedarfe der nächsten 30 Tage</p>
            <button
              onClick={handleWiederkehrendAnlegen}
              disabled={selected.size === 0 || wSaving}
              className="bg-green-800 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 w-full sm:w-auto"
            >
              {wSaving ? "Anlegen…" : `Lieferungen anlegen (${selected.size})`}
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto shadow-sm">
            {wLoading ? (
              <p className="p-6 text-gray-400 text-sm">Lade wiederkehrende Bedarfe…</p>
            ) : wiederkehrend.length === 0 ? (
              <p className="p-6 text-gray-400 text-sm">Keine wiederkehrenden Bedarfe gefunden.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.size === wiederkehrend.length}
                        onChange={toggleAll}
                        className="rounded border-gray-300 text-green-700 focus:ring-green-700"
                      />
                    </th>
                    {[
                      { label: "Kunde", cls: "" },
                      { label: "Artikel", cls: "hidden sm:table-cell" },
                      { label: "Menge", cls: "hidden sm:table-cell" },
                      { label: "Letztes Datum", cls: "hidden md:table-cell" },
                      { label: "Nächstes Datum", cls: "hidden md:table-cell" },
                      { label: "Status", cls: "" },
                      { label: "Aktion", cls: "" },
                    ].map((h) => (
                      <th key={h.label} className={`px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap ${h.cls}`}>
                        {h.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {wiederkehrend.map((w) => (
                    <tr key={w.bedarf.id} className="border-b last:border-0 hover:bg-green-50 transition-colors">
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={selected.has(w.bedarf.id)}
                          onChange={() => toggleSelect(w.bedarf.id)}
                          className="rounded border-gray-300 text-green-700 focus:ring-green-700"
                        />
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {w.bedarf.kunde.name}
                        <div className="sm:hidden text-xs text-gray-500 mt-0.5">
                          {w.bedarf.artikel.name} · {w.bedarf.menge} {w.bedarf.artikel.einheit}
                        </div>
                      </td>
                      <td className="hidden sm:table-cell px-4 py-3">{w.bedarf.artikel.name}</td>
                      <td className="hidden sm:table-cell px-4 py-3 whitespace-nowrap">{w.bedarf.menge} {w.bedarf.artikel.einheit}</td>
                      <td className="hidden md:table-cell px-4 py-3 text-gray-600 whitespace-nowrap">
                        {w.letztesDatum ? formatDatum(w.letztesDatum) : "—"}
                      </td>
                      <td className="hidden md:table-cell px-4 py-3 text-gray-600 whitespace-nowrap">
                        {w.naechstesDatum ? formatDatum(w.naechstesDatum) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {w.ueberfaellig ? (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700 border border-red-200">
                            Überfällig
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700 border border-green-200">
                            Geplant
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleEinzelnAusloesen(w.bedarf.id)}
                          disabled={wSaving}
                          className="px-2 py-2 text-xs font-medium bg-orange-100 hover:bg-orange-200 text-orange-800 border border-orange-200 rounded transition-colors disabled:opacity-50 whitespace-nowrap"
                        >
                          Auslösen
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
