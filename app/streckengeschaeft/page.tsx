"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/Badge";
import { formatEuro, formatDatum } from "@/lib/utils";

interface StreckenLieferung {
  id: number;
  datum: string;
  lieferdatum?: string | null;
  status: string;
  rechnungNr?: string | null;
  istStreckengeschaeft: boolean;
  kunde: { id: number; name: string; firma?: string | null };
  streckenLieferant?: { id: number; name: string } | null;
  positionen: {
    id: number;
    menge: number;
    verkaufspreis: number;
    artikel: { name: string; einheit: string };
  }[];
}

function KpiCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: "gray" | "yellow" | "red" | "green" | "orange" }) {
  const colors = {
    gray: "bg-gray-50 border-gray-200 text-gray-700",
    yellow: "bg-yellow-50 border-yellow-200 text-yellow-700",
    red: "bg-red-50 border-red-200 text-red-700",
    green: "bg-green-50 border-green-200 text-green-700",
    orange: "bg-orange-50 border-orange-200 text-orange-700",
  };
  return (
    <div className={`rounded-xl border px-4 py-3 ${colors[color]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs font-medium mt-0.5">{label}</div>
      {sub && <div className="text-xs opacity-70 mt-0.5">{sub}</div>}
    </div>
  );
}

function loadFilters() {
  try { return JSON.parse(sessionStorage.getItem("strecken-filters") ?? "{}"); } catch { return {}; }
}

export default function StreckengeschaeftPage() {
  const [lieferungen, setLieferungen] = useState<StreckenLieferung[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>(() => loadFilters().statusFilter ?? "");
  const [suchtext, setSuchtext] = useState<string>(() => loadFilters().suchtext ?? "");

  useEffect(() => {
    try { sessionStorage.setItem("strecken-filters", JSON.stringify({ statusFilter, suchtext })); } catch {}
  }, [statusFilter, suchtext]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch("/api/lieferungen?limit=1000")
      .then((r) => {
        if (!r.ok) throw new Error(`Serverfehler ${r.status}`);
        return r.json();
      })
      .then((data) => {
        const alle = Array.isArray(data) ? data : (data?.lieferungen ?? []);
        setLieferungen(alle.filter((l: StreckenLieferung) => l.istStreckengeschaeft));
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message ?? "Fehler beim Laden");
        setLoading(false);
      });
  }, []);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const gefiltert = useMemo(() => {
    return lieferungen.filter((l) => {
      if (statusFilter && l.status !== statusFilter) return false;
      if (suchtext.trim()) {
        const q = suchtext.toLowerCase();
        const name = (l.kunde.firma ?? l.kunde.name).toLowerCase();
        const lieferant = (l.streckenLieferant?.name ?? "").toLowerCase();
        const artikel = l.positionen.map((p) => p.artikel.name.toLowerCase()).join(" ");
        if (!name.includes(q) && !lieferant.includes(q) && !artikel.includes(q)) return false;
      }
      return true;
    });
  }, [lieferungen, statusFilter, suchtext]);

  // KPIs
  const geplant = lieferungen.filter((l) => l.status === "geplant");
  const geliefert = lieferungen.filter((l) => l.status === "geliefert");
  const ohneRechnung = geliefert.filter((l) => !l.rechnungNr);
  const ueberfaelligGeplant = geplant.filter((l) => {
    if (!l.lieferdatum) return false;
    return new Date(l.lieferdatum) < today;
  });
  const umsatzGesamt = lieferungen
    .filter((l) => l.status !== "storniert")
    .reduce((s, l) => s + l.positionen.reduce((ps, p) => ps + p.menge * p.verkaufspreis, 0), 0);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Streckengeschäfte</h1>
          <p className="text-sm text-gray-500 mt-0.5">Direktlieferungen Lieferant → Kunde – Überwachung & Status</p>
        </div>
        <Link
          href="/lieferungen/neu"
          className="inline-flex items-center gap-1.5 bg-green-800 hover:bg-green-700 text-white px-3 sm:px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          <span className="hidden sm:inline">Neue Lieferung</span>
        </Link>
      </div>

      {/* Info Banner */}
      <div className="mb-4 bg-purple-50 border border-purple-200 rounded-lg px-4 py-3 text-sm text-purple-800">
        Streckengeschäfte sind Lieferungen, bei denen der Lieferant direkt an den Kunden liefert. Es wird kein Lagerabgang gebucht – die Lieferbestätigung und Rechnungsstellung müssen aktiv überwacht werden.
      </div>

      {/* KPI Cards */}
      {!loading && !error && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
          <KpiCard label="Gesamt" value={lieferungen.length} color="gray" />
          <KpiCard label="Ausstehend (geplant)" value={geplant.length} color={geplant.length > 0 ? "yellow" : "gray"} />
          <KpiCard
            label="Überfällig (kein Lieferstatus)"
            value={ueberfaelligGeplant.length}
            color={ueberfaelligGeplant.length > 0 ? "red" : "gray"}
            sub="Lieferdatum überschritten"
          />
          <KpiCard
            label="Geliefert – ohne Rechnung"
            value={ohneRechnung.length}
            color={ohneRechnung.length > 0 ? "orange" : "green"}
            sub="Rechnung ausstehend"
          />
          <KpiCard label="Umsatz (aktiv)" value={formatEuro(umsatzGesamt)} color="green" sub="ohne Stornierte" />
        </div>
      )}

      {/* Handlungsbedarf Alerts */}
      {!loading && !error && (ueberfaelligGeplant.length > 0 || ohneRechnung.length > 0) && (
        <div className="space-y-3 mb-5">
          {ueberfaelligGeplant.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="font-semibold text-red-800 text-sm mb-2">
                Handlungsbedarf: {ueberfaelligGeplant.length} Streckengeschäft{ueberfaelligGeplant.length !== 1 ? "e" : ""} – Lieferdatum überschritten, noch nicht als geliefert markiert
              </div>
              <div className="space-y-1">
                {ueberfaelligGeplant.map((l) => {
                  const tage = l.lieferdatum
                    ? Math.ceil((today.getTime() - new Date(l.lieferdatum).getTime()) / 86400000)
                    : 0;
                  return (
                    <div key={l.id} className="flex items-center justify-between text-sm">
                      <span className="text-red-700">
                        {l.kunde.firma ?? l.kunde.name}
                        {l.streckenLieferant ? ` via ${l.streckenLieferant.name}` : ""}
                        {" – "}
                        <span className="font-medium">{tage} Tag{tage !== 1 ? "e" : ""} überfällig</span>
                      </span>
                      <Link href={`/lieferungen/${l.id}`} className="text-red-600 hover:text-red-800 underline font-medium ml-4">
                        Öffnen →
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {ohneRechnung.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="font-semibold text-orange-800 text-sm mb-2">
                Rechnung ausstehend: {ohneRechnung.length} gelieferte Streckengeschäft{ohneRechnung.length !== 1 ? "e" : ""} ohne Rechnungsnummer
              </div>
              <div className="space-y-1">
                {ohneRechnung.slice(0, 5).map((l) => (
                  <div key={l.id} className="flex items-center justify-between text-sm">
                    <span className="text-orange-700">
                      {l.kunde.firma ?? l.kunde.name} – {formatDatum(l.datum)}
                    </span>
                    <Link href={`/lieferungen/${l.id}`} className="text-orange-600 hover:text-orange-800 underline font-medium ml-4">
                      Rechnung erstellen →
                    </Link>
                  </div>
                ))}
                {ohneRechnung.length > 5 && (
                  <div className="text-xs text-orange-600">… und {ohneRechnung.length - 5} weitere</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filter */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          value={suchtext}
          onChange={(e) => setSuchtext(e.target.value)}
          placeholder="Kunde, Lieferant oder Artikel…"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 w-full sm:w-72"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
        >
          <option value="">Alle Status</option>
          <option value="geplant">Geplant (ausstehend)</option>
          <option value="geliefert">Geliefert</option>
          <option value="storniert">Storniert</option>
        </select>
        {(statusFilter || suchtext) && (
          <button
            onClick={() => { setStatusFilter(""); setSuchtext(""); }}
            className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2 border border-gray-200 rounded-lg"
          >
            Filter zurücksetzen
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto shadow-sm">
        {loading ? (
          <p className="p-6 text-gray-400 text-sm">Lade Streckengeschäfte…</p>
        ) : error ? (
          <p className="p-6 text-red-600 text-sm">⚠ {error}</p>
        ) : gefiltert.length === 0 ? (
          <p className="p-6 text-gray-400 text-sm">
            {lieferungen.length === 0
              ? <>Noch keine Streckengeschäfte erfasst.{" "}
                  <Link href="/lieferungen/neu" className="text-green-700 underline hover:text-green-900">
                    Neue Lieferung anlegen
                  </Link>{" "}
                  und &quot;Streckengeschäft&quot; aktivieren.</>
              : "Keine Einträge für diesen Filter."}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Datum</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Kunde</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap hidden sm:table-cell">Direktlieferant</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap hidden md:table-cell">Artikel / Menge</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap hidden lg:table-cell">Umsatz</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap hidden sm:table-cell">Rechnung</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {gefiltert.map((l) => {
                const umsatz = l.positionen.reduce((s, p) => s + p.menge * p.verkaufspreis, 0);
                const lieferantName = l.streckenLieferant?.name ?? "—";
                const kundeName = l.kunde.firma ? `${l.kunde.firma} (${l.kunde.name})` : l.kunde.name;
                const artikelZusammenfassung =
                  l.positionen
                    .slice(0, 2)
                    .map((p) => `${p.menge} ${p.artikel.einheit} ${p.artikel.name}`)
                    .join(", ") + (l.positionen.length > 2 ? ` +${l.positionen.length - 2}` : "");
                const istUeberfaellig =
                  l.status === "geplant" &&
                  l.lieferdatum != null &&
                  new Date(l.lieferdatum) < today;
                const fehlendRechnung = l.status === "geliefert" && !l.rechnungNr;

                return (
                  <tr
                    key={l.id}
                    className={`border-b last:border-0 transition-colors ${
                      istUeberfaellig
                        ? "bg-red-50 hover:bg-red-100"
                        : fehlendRechnung
                        ? "bg-orange-50 hover:bg-orange-100"
                        : "hover:bg-purple-50"
                    }`}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatDatum(l.datum)}
                      {istUeberfaellig && (
                        <div className="text-xs text-red-600 font-medium mt-0.5">Lieferdatum überschritten</div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/kunden/${l.kunde.id}`} className="hover:text-green-700 transition-colors">
                        {kundeName}
                      </Link>
                      <div className="sm:hidden text-xs text-gray-500 mt-0.5">{lieferantName}</div>
                    </td>
                    <td className="hidden sm:table-cell px-4 py-3 text-gray-700">{lieferantName}</td>
                    <td className="hidden md:table-cell px-4 py-3 text-gray-600 max-w-[220px] truncate" title={artikelZusammenfassung}>
                      {artikelZusammenfassung || "—"}
                    </td>
                    <td className="hidden lg:table-cell px-4 py-3 font-mono whitespace-nowrap">{formatEuro(umsatz)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={l.status} />
                    </td>
                    <td className="hidden sm:table-cell px-4 py-3 text-gray-600">
                      {l.rechnungNr ? (
                        <Link
                          href={`/lieferungen/${l.id}/rechnung`}
                          className="text-green-700 hover:text-green-900 font-mono text-xs underline"
                        >
                          {l.rechnungNr}
                        </Link>
                      ) : (
                        <span className={`text-xs ${fehlendRechnung ? "text-orange-600 font-medium" : "text-gray-400"}`}>
                          {fehlendRechnung ? "Ausstehend" : "Offen"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/lieferungen/${l.id}`}
                        className="p-1.5 text-green-700 hover:bg-green-50 hover:text-green-900 rounded transition-colors inline-flex items-center"
                        title="Details"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {!loading && !error && gefiltert.length > 0 && (
        <p className="text-xs text-gray-400 mt-3 text-right">
          {gefiltert.length} von {lieferungen.length} Streckengeschäft{lieferungen.length !== 1 ? "en" : ""}
        </p>
      )}
    </div>
  );
}
