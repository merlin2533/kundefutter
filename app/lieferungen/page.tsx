"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { StatusBadge, MargeBadge } from "@/components/Badge";
import { formatEuro, formatDatum } from "@/lib/utils";
import { useScrollRestoration } from "@/lib/useScrollRestoration";

interface Lieferung {
  id: number;
  datum: string;
  kunde: { id: number; name: string; firma?: string };
  status: string;
  notiz?: string;
  rechnungNr?: string | null;
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

export default function LieferungenPage() {
  const [tab, setTab] = useState<"liste" | "wiederkehrend">("liste");

  // List state
  const [lieferungen, setLieferungen] = useState<Lieferung[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("alle");
  const [vonFilter, setVonFilter] = useState("");
  const [bisFilter, setBisFilter] = useState("");
  const [kundeSearch, setKundeSearch] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [statusChangingId, setStatusChangingId] = useState<number | null>(null);

  // Wiederkehrend state
  const [wiederkehrend, setWiederkehrend] = useState<WiederkehrendBedarf[]>([]);
  const [wLoading, setWLoading] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [wSaving, setWSaving] = useState(false);
  const [faelligeAnzahl, setFaelligeAnzahl] = useState(0);
  const [wErfolgMsg, setWErfolgMsg] = useState("");

  const fetchLieferungen = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter !== "alle") params.set("status", statusFilter);
    if (vonFilter) params.set("von", vonFilter);
    if (bisFilter) params.set("bis", bisFilter);
    if (kundeSearch) params.set("search", kundeSearch);
    const res = await fetch(`/api/lieferungen?${params}`);
    const data = await res.json();
    setLieferungen(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [statusFilter, vonFilter, bisFilter, kundeSearch]);

  useEffect(() => {
    const t = setTimeout(fetchLieferungen, 300);
    return () => clearTimeout(t);
  }, [fetchLieferungen]);

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
      await fetchLieferungen();
    } finally {
      setDeletingId(null);
    }
  }

  async function markiereGeliefert(id: number) {
    if (!confirm("Lieferung als geliefert markieren? Der Lagerbestand wird gebucht.")) return;
    setStatusChangingId(id);
    try {
      const res = await fetch(`/api/lieferungen/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "geliefert" }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error ?? "Status konnte nicht geändert werden");
        return;
      }
      await fetchLieferungen();
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
          <h1 className="text-2xl font-bold">Lieferungen</h1>
          <Link href="/hilfe#lieferungen" title="Hilfe: Lieferungen & Angebote" className="text-gray-400 hover:text-green-700 transition-colors" tabIndex={-1}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </Link>
        </span>
        <Link
          href="/lieferungen/neu"
          className="bg-green-800 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors w-full sm:w-auto text-center"
        >
          + Neue Lieferung
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
            {t === "liste" ? "Lieferungen" : "Wiederkehrend"}
          </button>
        ))}
      </div>

      {tab === "liste" && (
        <>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 mb-5">
            <div className="flex gap-1 flex-wrap">
              {["alle", "geplant", "geliefert", "storniert"].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors capitalize ${
                    statusFilter === s
                      ? "bg-green-800 text-white border-green-800"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {s}
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
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto shadow-sm">
            {loading ? (
              <p className="p-6 text-gray-400 text-sm">Lade Lieferungen…</p>
            ) : lieferungen.length === 0 ? (
              <p className="p-6 text-gray-400 text-sm">Keine Lieferungen gefunden.</p>
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
                      { label: "Status", cls: "" },
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
                        <td className="px-4 py-3 whitespace-nowrap">{formatDatum(l.datum)}</td>
                        <td className="px-4 py-3 font-medium">
                          {l.kunde.firma ? `${l.kunde.firma} (${l.kunde.name})` : l.kunde.name}
                          <div className="sm:hidden text-xs text-gray-500 font-mono mt-0.5">{formatEuro(umsatz)}</div>
                        </td>
                        <td className="hidden md:table-cell px-4 py-3 text-center">{l.positionen.length}</td>
                        <td className="hidden sm:table-cell px-4 py-3 font-mono whitespace-nowrap">{formatEuro(umsatz)}</td>
                        <td className="hidden lg:table-cell px-4 py-3">
                          <MargeBadge pct={margePct} />
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={l.status} />
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
                            {l.status !== "storniert" && (
                              <Link
                                href={`/lieferungen/${l.id}/lieferschein`}
                                className="p-1.5 text-gray-600 hover:bg-gray-100 hover:text-gray-900 rounded transition-colors"
                                title="Lieferschein"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                              </Link>
                            )}
                            {l.status === "geplant" && (
                              <button
                                onClick={() => markiereGeliefert(l.id)}
                                disabled={statusChangingId === l.id}
                                className="p-1.5 text-green-700 hover:bg-green-50 hover:text-green-900 rounded transition-colors disabled:opacity-50"
                                title="Als geliefert markieren"
                              >
                                {statusChangingId === l.id ? (
                                  <span className="w-4 h-4 flex items-center justify-center text-xs">…</span>
                                ) : (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                )}
                              </button>
                            )}
                            {l.rechnungNr && (
                              <Link
                                href={`/lieferungen/${l.id}/rechnung`}
                                className="p-1.5 text-green-800 hover:bg-green-50 hover:text-green-900 rounded transition-colors"
                                title="Rechnung öffnen"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                              </Link>
                            )}
                            {l.status !== "geliefert" && (
                              <button
                                onClick={() => handleDelete(l.id)}
                                disabled={deletingId === l.id}
                                className="p-1.5 text-red-600 hover:bg-red-50 hover:text-red-800 rounded transition-colors disabled:opacity-50"
                                title="Lieferung löschen"
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
