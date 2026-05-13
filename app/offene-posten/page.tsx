"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

interface OffenerPosten {
  lieferungId: number;
  kundeId: number;
  kundeName: string;
  rechnungNr: string | null;
  rechnungDatum: string | null;
  faelligAm: string | null;
  bruttoBetrag: number;
  gezahlt: number;
  offen: number;
  tageUeberfaellig: number; // negative = noch nicht fällig, 0 = heute, positive = überfällig
  mahnstufe: 0 | 1 | 2 | 3; // 0 = noch nicht überfällig
  zahlungsziel: number;
}

function datumsStr(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("de-DE");
}

function euroStr(n: number): string {
  return n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

type Filter = "alle" | "faellig" | "m1" | "m2" | "m3";

function OffenePostenInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialFilter = (searchParams.get("filter") ?? "alle") as Filter;
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [posten, setPosten] = useState<OffenerPosten[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      // Load all delivered, unpaid deliveries with invoice numbers
      const res = await fetch("/api/lieferungen?status=geliefert&limit=1000");
      if (!res.ok) throw new Error("Fehler beim Laden der Lieferungen");
      const lieferungen = await res.json();
      const liste = Array.isArray(lieferungen) ? lieferungen : (lieferungen.lieferungen ?? []);

      // Filter to only those with a rechnungNr and no bezahltAm
      const offene = liste.filter(
        (l: Record<string, unknown>) => l.rechnungNr && !l.bezahltAm
      );

      if (offene.length === 0) {
        setPosten([]);
        setLoading(false);
        return;
      }

      // Batch-load Teilzahlungen for all open deliveries
      const tzMap = new Map<number, number>();
      await Promise.all(
        offene.map(async (l: Record<string, unknown>) => {
          try {
            const tzRes = await fetch(`/api/teilzahlungen?lieferungId=${l.id}`);
            if (tzRes.ok) {
              const tzData = await tzRes.json();
              const summe = Array.isArray(tzData)
                ? tzData.reduce((s: number, t: Record<string, unknown>) => s + Number(t.betrag ?? 0), 0)
                : 0;
              tzMap.set(l.id as number, summe);
            }
          } catch { /* ignore */ }
        })
      );

      const heute = new Date();
      heute.setHours(0, 0, 0, 0);

      const result: OffenerPosten[] = offene.map((l: Record<string, unknown>) => {
        const positionen = Array.isArray(l.positionen) ? l.positionen : [];
        const netto = positionen.reduce(
          (s: number, p: Record<string, unknown>) =>
            s + Number(p.menge ?? 0) * Number(p.verkaufspreis ?? 0) * (1 - (Number(p.rabattProzent ?? 0) / 100)),
          0
        );
        // Approximate brutto (no per-article mwst breakdown here — use 19% as approximation)
        // If positionen have artikel.mwstSatz we can be more precise
        const mwstGruppen: Record<number, number> = {};
        for (const p of positionen as Record<string, unknown>[]) {
          const art = p.artikel as Record<string, unknown> | null;
          const satz = art ? Number(art.mwstSatz ?? 19) : 19;
          const lineNetto =
            Number(p.menge ?? 0) * Number(p.verkaufspreis ?? 0) * (1 - (Number(p.rabattProzent ?? 0) / 100));
          mwstGruppen[satz] = (mwstGruppen[satz] ?? 0) + lineNetto * (satz / 100);
        }
        const mwst = Object.values(mwstGruppen).reduce((s, v) => s + v, 0);
        const brutto = Math.round((netto + mwst) * 100) / 100;

        const gezahlt = tzMap.get(l.id as number) ?? 0;
        const offen = Math.max(0, brutto - gezahlt);

        const zahlungsziel = Number(l.zahlungsziel ?? 30);
        const basisDatum = l.rechnungDatum ?? l.datum;
        const faelligAm = new Date(new Date(basisDatum as string).getTime() + zahlungsziel * 24 * 60 * 60 * 1000);
        faelligAm.setHours(0, 0, 0, 0);

        const diffMs = heute.getTime() - faelligAm.getTime();
        const tageUeberfaellig = Math.floor(diffMs / (24 * 60 * 60 * 1000));

        let mahnstufe: 0 | 1 | 2 | 3 = 0;
        if (tageUeberfaellig >= 42) mahnstufe = 3;
        else if (tageUeberfaellig >= 28) mahnstufe = 2;
        else if (tageUeberfaellig >= 14) mahnstufe = 1;

        const kunde = l.kunde as Record<string, unknown> | null;

        return {
          lieferungId: l.id as number,
          kundeId: kunde ? (kunde.id as number) : 0,
          kundeName: kunde ? ((kunde.firma ?? kunde.name) as string) : "—",
          rechnungNr: (l.rechnungNr as string | null) ?? null,
          rechnungDatum: (l.rechnungDatum as string | null) ?? (l.datum as string | null) ?? null,
          faelligAm: faelligAm.toISOString(),
          bruttoBetrag: brutto,
          gezahlt: Math.round(gezahlt * 100) / 100,
          offen: Math.round(offen * 100) / 100,
          tageUeberfaellig,
          mahnstufe,
          zahlungsziel,
        };
      });

      // Sort: most overdue first, then by customer name
      result.sort((a, b) => b.tageUeberfaellig - a.tageUeberfaellig || a.kundeName.localeCompare(b.kundeName));

      setPosten(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function setFilterAndUrl(f: Filter) {
    setFilter(f);
    const url = new URL(window.location.href);
    if (f === "alle") url.searchParams.delete("filter");
    else url.searchParams.set("filter", f);
    router.replace(url.pathname + url.search, { scroll: false });
  }

  const gefiltert = posten.filter((p) => {
    if (filter === "alle") return true;
    if (filter === "faellig") return p.tageUeberfaellig > 0;
    if (filter === "m1") return p.mahnstufe === 1;
    if (filter === "m2") return p.mahnstufe === 2;
    if (filter === "m3") return p.mahnstufe === 3;
    return true;
  });

  const gesamtOffen = gefiltert.reduce((s, p) => s + p.offen, 0);
  const gesamtBrutto = gefiltert.reduce((s, p) => s + p.bruttoBetrag, 0);

  function exportCsv() {
    const header = ["Kunde", "Rechnungs-Nr", "Rechnungsdatum", "Fällig am", "Brutto", "Gezahlt", "Offen", "Tage überfällig", "Mahnstufe"];
    const rows = gefiltert.map((p) => [
      p.kundeName,
      p.rechnungNr ?? "",
      datumsStr(p.rechnungDatum),
      datumsStr(p.faelligAm),
      p.bruttoBetrag.toFixed(2).replace(".", ","),
      p.gezahlt.toFixed(2).replace(".", ","),
      p.offen.toFixed(2).replace(".", ","),
      String(p.tageUeberfaellig > 0 ? p.tageUeberfaellig : 0),
      p.mahnstufe > 0 ? `Stufe ${p.mahnstufe}` : "—",
    ]);
    const csv = [header, ...rows].map((r) => r.map((v) => `"${v}"`).join(";")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `offene-posten-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function statusColor(p: OffenerPosten): string {
    if (p.tageUeberfaellig > 0) return "bg-red-50";
    const daysUntilDue = -p.tageUeberfaellig;
    if (daysUntilDue <= 7) return "bg-amber-50";
    return "";
  }

  function faelligkeitsBadge(p: OffenerPosten) {
    if (p.tageUeberfaellig > 0) {
      return (
        <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700">
          {p.tageUeberfaellig} T. überfällig
        </span>
      );
    }
    const daysUntilDue = -p.tageUeberfaellig;
    if (daysUntilDue === 0) {
      return <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-700">Heute fällig</span>;
    }
    if (daysUntilDue <= 7) {
      return <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-700">in {daysUntilDue} T.</span>;
    }
    return <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">in {daysUntilDue} T.</span>;
  }

  function mahnstufeBadge(mahnstufe: 0 | 1 | 2 | 3) {
    if (mahnstufe === 0) return null;
    const colors = ["", "bg-yellow-100 text-yellow-700", "bg-orange-100 text-orange-700", "bg-red-100 text-red-800"];
    return (
      <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${colors[mahnstufe]}`}>
        M{mahnstufe}
      </span>
    );
  }

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "alle", label: "Alle" },
    { key: "faellig", label: "Überfällig" },
    { key: "m1", label: "Mahnstufe 1" },
    { key: "m2", label: "Mahnstufe 2" },
    { key: "m3", label: "Mahnstufe 3" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Offene Posten</h1>
        <button
          onClick={exportCsv}
          className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export CSV
        </button>
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap gap-2 mb-5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilterAndUrl(f.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === f.key
                ? "bg-green-700 text-white"
                : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* Summary cards */}
      {!loading && posten.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <div className="text-xs text-gray-500 mb-1">Positionen</div>
            <div className="text-xl font-bold text-gray-900">{gefiltert.length}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <div className="text-xs text-gray-500 mb-1">Gesamtvolumen</div>
            <div className="text-xl font-bold text-gray-900">{euroStr(gesamtBrutto)}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <div className="text-xs text-gray-500 mb-1">Offener Betrag</div>
            <div className="text-xl font-bold text-amber-600">{euroStr(gesamtOffen)}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <div className="text-xs text-gray-500 mb-1">Überfällige</div>
            <div className="text-xl font-bold text-red-600">{gefiltert.filter((p) => p.tageUeberfaellig > 0).length}</div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-gray-400 py-8 text-center">Lade offene Posten…</div>
      ) : gefiltert.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center text-gray-400">
          {posten.length === 0
            ? "Keine offenen Posten vorhanden."
            : "Keine Einträge für den gewählten Filter."}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Kunde</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap hidden sm:table-cell">Rechnungs-Nr</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap hidden md:table-cell">Rechnungsdatum</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Brutto</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap hidden sm:table-cell">Gezahlt</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Offen</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Fälligkeit</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap hidden md:table-cell">Mahnstufe</th>
              </tr>
            </thead>
            <tbody>
              {gefiltert.map((p) => (
                <tr key={p.lieferungId} className={`border-b last:border-0 hover:bg-gray-50 transition-colors ${statusColor(p)}`}>
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/kunden/${p.kundeId}`} className="hover:text-green-700 hover:underline">
                      {p.kundeName}
                    </Link>
                    <div className="sm:hidden text-xs text-gray-500 mt-0.5 font-mono">{p.rechnungNr ?? "—"}</div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <Link href={`/lieferungen/${p.lieferungId}`} className="font-mono text-green-700 hover:underline text-xs">
                      {p.rechnungNr ?? "—"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{datumsStr(p.rechnungDatum)}</td>
                  <td className="px-4 py-3 text-right font-mono">{euroStr(p.bruttoBetrag)}</td>
                  <td className="px-4 py-3 text-right font-mono text-green-700 hidden sm:table-cell">
                    {p.gezahlt > 0 ? euroStr(p.gezahlt) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold">
                    {p.offen > 0 ? (
                      <span className={p.tageUeberfaellig > 0 ? "text-red-600" : "text-gray-900"}>
                        {euroStr(p.offen)}
                      </span>
                    ) : (
                      <span className="text-green-700">beglichen</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs text-gray-500">{datumsStr(p.faelligAm)}</span>
                      {faelligkeitsBadge(p)}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="flex items-center gap-1">
                      {mahnstufeBadge(p.mahnstufe)}
                      {p.mahnstufe === 0 && <span className="text-xs text-gray-400">—</span>}
                      {p.mahnstufe > 0 && (
                        <Link href="/mahnwesen" className="text-xs text-green-700 hover:underline ml-1">
                          Mahnung
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 border-t-2 border-gray-200">
              <tr>
                <td colSpan={3} className="px-4 py-3 font-semibold text-gray-700 hidden md:table-cell">Gesamt ({gefiltert.length})</td>
                <td colSpan={1} className="px-4 py-3 font-semibold text-gray-700 md:hidden">Gesamt ({gefiltert.length})</td>
                <td className="px-4 py-3 text-right font-mono font-semibold">{euroStr(gesamtBrutto)}</td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-green-700 hidden sm:table-cell">
                  {euroStr(gefiltert.reduce((s, p) => s + p.gezahlt, 0))}
                </td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-amber-600">{euroStr(gesamtOffen)}</td>
                <td colSpan={2} className="px-4 py-3 hidden md:table-cell" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

export default function OffenePostenPage() {
  return (
    <Suspense fallback={<div className="text-sm text-gray-400 py-8 text-center">Lade…</div>}>
      <OffenePostenInner />
    </Suspense>
  );
}
