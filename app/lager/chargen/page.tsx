"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import SearchableSelect from "@/components/SearchableSelect";

type Modus = "charge" | "artikel";

interface ChargeWareneingang {
  id: number;
  wareneingangId: number;
  datum: string;
  menge: number;
  chargeNr: string | null;
  mhd: string | null;
  lieferant: { id: number; name: string } | null;
  artikel: { id: number; name: string; einheit: string };
}

interface ChargeLieferung {
  lieferpositionId: number;
  chargeNr: string | null;
  datum: string;
  lieferungId: number;
  status: string;
  rechnungNr: string | null;
  kunde: { id: number; name: string; firma?: string | null };
  artikel?: { id: number; name: string; einheit: string };
  menge: number;
}

interface KundenAggregation {
  id: number;
  name: string;
  firma: string | null;
  anzahlLieferungen: number;
  summeMenge: number;
  letzteLieferung: string;
  chargen: string[];
}

interface BestandJeCharge {
  chargeNr: string;
  bestand: number;
  artikelId?: number;
  artikelName?: string;
  einheit?: string;
}

interface ArtikelResult {
  modus: "artikel";
  artikel: { id: number; name: string; einheit: string; kategorie: string };
  kunden: KundenAggregation[];
  lieferungen: ChargeLieferung[];
  wareneingaenge: ChargeWareneingang[];
  bestandJeCharge: BestandJeCharge[];
}

interface ChargeResult {
  modus: "charge";
  wareneingaenge: ChargeWareneingang[];
  lieferungen: ChargeLieferung[];
  bestandJeCharge: BestandJeCharge[];
}

type Result = ArtikelResult | ChargeResult;

interface ArtikelOption {
  id: number;
  name: string;
  artikelnummer: string;
  kategorie: string;
  einheit: string;
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    geplant: "bg-yellow-100 text-yellow-800",
    geliefert: "bg-green-100 text-green-800",
    storniert: "bg-red-100 text-red-700",
    offen: "bg-yellow-100 text-yellow-800",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[status.toLowerCase()] ?? "bg-gray-100 text-gray-700"}`}>
      {status}
    </span>
  );
}

function fmtMenge(n: number) {
  return n.toLocaleString("de-DE", { maximumFractionDigits: 2 });
}

export default function RueckverfolgungPage() {
  const [modus, setModus] = useState<Modus>("charge");

  // Charge-Modus
  const [charge, setCharge] = useState("");

  // Artikel-Modus
  const [artikelOptions, setArtikelOptions] = useState<ArtikelOption[]>([]);
  const [artikelId, setArtikelId] = useState("");
  const [loadingArtikel, setLoadingArtikel] = useState(false);

  // Gemeinsam
  const [von, setVon] = useState("");
  const [bis, setBis] = useState("");
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (modus === "artikel" && artikelOptions.length === 0) {
      setLoadingArtikel(true);
      fetch("/api/artikel?limit=2000")
        .then((r) => (r.ok ? r.json() : []))
        .then((d) => setArtikelOptions(Array.isArray(d) ? d : []))
        .finally(() => setLoadingArtikel(false));
    }
  }, [modus, artikelOptions.length]);

  function switchModus(m: Modus) {
    setModus(m);
    setResult(null);
    setError("");
    setSearched(false);
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (modus === "charge") {
      const q = charge.trim();
      if (!q) return;
      params.set("charge", q);
    } else {
      if (!artikelId) return;
      params.set("artikelId", artikelId);
      if (charge.trim()) params.set("charge", charge.trim());
    }
    if (von) params.set("von", von);
    if (bis) params.set("bis", bis);

    setSearching(true);
    setError("");
    setResult(null);
    setSearched(true);
    try {
      const res = await fetch(`/api/lager/chargen?${params}`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Fehler bei der Suche");
        return;
      }
      const data: Result = await res.json();
      setResult(data);
    } catch {
      setError("Netzwerkfehler");
    } finally {
      setSearching(false);
    }
  }

  const lieferungen = result?.lieferungen ?? [];
  const wareneingaenge = result?.wareneingaenge ?? [];
  const totalFound = lieferungen.length + wareneingaenge.length;
  const kunden = result?.modus === "artikel" ? result.kunden : [];

  function exportCsv() {
    if (!result) return;
    const rows: string[][] = [];
    rows.push(["Datum", "Kunde", "Firma", "Artikel", "Menge", "Einheit", "Charge", "Status", "Rechnung", "Lieferung-ID"]);
    const artikelName =
      result.modus === "artikel" ? result.artikel.name : "";
    const artikelEinheit =
      result.modus === "artikel" ? result.artikel.einheit : "";
    for (const l of lieferungen) {
      rows.push([
        new Date(l.datum).toLocaleDateString("de-DE"),
        l.kunde?.name ?? "",
        l.kunde?.firma ?? "",
        l.artikel?.name ?? artikelName,
        String(l.menge),
        l.artikel?.einheit ?? artikelEinheit,
        l.chargeNr ?? "",
        l.status,
        l.rechnungNr ?? "",
        String(l.lieferungId),
      ]);
    }
    const csv = rows
      .map((r) =>
        r
          .map((c) => {
            const s = String(c);
            return /[;"\n,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
          })
          .join(";")
      )
      .join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const stamp = new Date().toISOString().slice(0, 10);
    const fname =
      result.modus === "artikel"
        ? `rueckverfolgung_${result.artikel.name.replace(/[^a-z0-9]+/gi, "_")}_${stamp}.csv`
        : `rueckverfolgung_charge_${stamp}.csv`;
    a.download = fname;
    a.click();
    URL.revokeObjectURL(url);
  }

  const artikelSelectOptions = artikelOptions.map((a) => ({
    value: String(a.id),
    label: a.name,
    sub: `${a.artikelnummer ?? ""}${a.kategorie ? " · " + a.kategorie : ""}`,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Rückverfolgung</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Wer hat was bekommen? Suche nach Chargennummer oder Artikel — z.B. für Rückrufe bei Saatgut.
          </p>
        </div>
        <Link
          href="/lager"
          className="text-sm text-gray-500 hover:text-gray-700 border border-gray-300 px-3 py-2 rounded-lg bg-white hover:bg-gray-50 transition-colors"
        >
          ← Zurück zum Lager
        </Link>
      </div>

      {/* Mode toggle */}
      <div className="inline-flex bg-gray-100 rounded-lg p-1 text-sm">
        <button
          type="button"
          onClick={() => switchModus("charge")}
          className={`px-4 py-1.5 rounded-md font-medium transition-colors ${
            modus === "charge" ? "bg-white shadow text-gray-900" : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Nach Chargennummer
        </button>
        <button
          type="button"
          onClick={() => switchModus("artikel")}
          className={`px-4 py-1.5 rounded-md font-medium transition-colors ${
            modus === "artikel" ? "bg-white shadow text-gray-900" : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Nach Artikel
        </button>
      </div>

      {/* Search form */}
      <form onSubmit={handleSearch} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <div className="flex gap-3 items-end flex-wrap">
          {modus === "charge" ? (
            <div className="w-full sm:flex-1 sm:min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">Chargennummer</label>
              <input
                type="text"
                value={charge}
                onChange={(e) => setCharge(e.target.value)}
                placeholder="z.B. CH-2024-001…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
                autoFocus
              />
            </div>
          ) : (
            <>
              <div className="w-full sm:flex-1 sm:min-w-[280px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">Artikel</label>
                <SearchableSelect
                  options={artikelSelectOptions}
                  value={artikelId}
                  onChange={setArtikelId}
                  placeholder={loadingArtikel ? "Lade Artikel…" : "Artikel auswählen…"}
                />
              </div>
              <div className="w-full sm:w-44">
                <label className="block text-sm font-medium text-gray-700 mb-1">Charge (optional)</label>
                <input
                  type="text"
                  value={charge}
                  onChange={(e) => setCharge(e.target.value)}
                  placeholder="z.B. CH-2024-001"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
                />
              </div>
            </>
          )}
          <div className="w-full sm:w-40">
            <label className="block text-sm font-medium text-gray-700 mb-1">Von</label>
            <input
              type="date"
              value={von}
              onChange={(e) => setVon(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
            />
          </div>
          <div className="w-full sm:w-40">
            <label className="block text-sm font-medium text-gray-700 mb-1">Bis</label>
            <input
              type="date"
              value={bis}
              onChange={(e) => setBis(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
            />
          </div>
          <button
            type="submit"
            disabled={
              searching ||
              (modus === "charge" ? !charge.trim() : !artikelId)
            }
            className="w-full sm:w-auto px-5 py-2 text-sm bg-green-800 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            {searching ? "Suche…" : "Suchen"}
          </button>
        </div>
      </form>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>
      )}

      {searched && result && (
        <div className="space-y-6">
          {totalFound === 0 ? (
            <div className="text-center py-12 text-gray-400 border border-dashed border-gray-200 rounded-xl">
              <p className="text-3xl mb-3">🔍</p>
              <p className="text-sm">Keine Einträge gefunden.</p>
            </div>
          ) : (
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3 flex-wrap">
                <p className="text-sm text-gray-600 font-medium">{totalFound} Treffer</p>
                {result.modus === "artikel" && (
                  <span className="text-xs text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full">
                    Artikel: {result.artikel.name}
                  </span>
                )}
                {lieferungen.length >= 500 && (
                  <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                    Anzeige begrenzt — Suche präzisieren
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={exportCsv}
                className="text-sm text-gray-700 border border-gray-300 px-3 py-1.5 rounded-lg bg-white hover:bg-gray-50 transition-colors"
              >
                CSV exportieren
              </button>
            </div>
          )}

          {/* Aktueller Lagerbestand je Charge */}
          {result.bestandJeCharge && result.bestandJeCharge.length > 0 && (
            <div>
              <h2 className="text-base font-semibold text-gray-800 mb-3">
                Lagerbestand je Charge
              </h2>
              <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Chargennummer</th>
                      {result.modus === "charge" && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Artikel</th>}
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Bestand</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {result.bestandJeCharge.map((c, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-mono text-sm text-blue-700">{c.chargeNr}</td>
                        {result.modus === "charge" && <td className="px-4 py-2.5 text-gray-700 hidden md:table-cell">{c.artikelName ?? "—"}</td>}
                        <td className="px-4 py-2.5 text-right font-medium text-gray-900">
                          {c.bestand.toLocaleString("de-DE", { maximumFractionDigits: 3 })}
                          {(result.modus === "artikel" ? result.artikel.einheit : c.einheit) && (
                            <span className="text-gray-400 text-xs ml-1">{result.modus === "artikel" ? result.artikel.einheit : c.einheit}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Kunden-Aggregation (nur Artikel-Modus) */}
          {result.modus === "artikel" && kunden.length > 0 && (
            <div>
              <h2 className="text-base font-semibold text-gray-800 mb-3">
                Kunden ({kunden.length})
              </h2>
              <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Kunde</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Gesamtmenge</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Lieferungen</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Letzte Lieferung</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Chargen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {kunden.map((k) => (
                      <tr key={k.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5">
                          <Link href={`/kunden/${k.id}`} className="font-medium text-green-700 hover:underline">
                            {k.firma ? `${k.firma} (${k.name})` : k.name}
                          </Link>
                          <div className="md:hidden text-xs text-gray-500 mt-0.5">
                            {k.anzahlLieferungen} Lieferungen · zuletzt {new Date(k.letzteLieferung).toLocaleDateString("de-DE")}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-right whitespace-nowrap">
                          {fmtMenge(k.summeMenge)} {result.artikel.einheit}
                        </td>
                        <td className="px-4 py-2.5 text-right hidden sm:table-cell">{k.anzahlLieferungen}</td>
                        <td className="px-4 py-2.5 text-gray-600 hidden md:table-cell whitespace-nowrap">
                          {new Date(k.letzteLieferung).toLocaleDateString("de-DE")}
                        </td>
                        <td className="px-4 py-2.5 hidden lg:table-cell">
                          {k.chargen.length === 0 ? (
                            <span className="text-xs text-gray-400 italic">—</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {k.chargen.slice(0, 5).map((c) => (
                                <span key={c} className="text-xs bg-gray-100 px-2 py-0.5 rounded-full font-mono">
                                  {c}
                                </span>
                              ))}
                              {k.chargen.length > 5 && (
                                <span className="text-xs text-gray-500">+{k.chargen.length - 5}</span>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Wareneingänge */}
          {wareneingaenge.length > 0 && (
            <div>
              <h2 className="text-base font-semibold text-gray-800 mb-3">
                Wareneingänge
                <span className="ml-2 text-sm font-normal text-gray-400">({wareneingaenge.length})</span>
              </h2>
              <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Datum</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Artikel</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Menge</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Lieferant</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Charge</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {wareneingaenge.map((w) => (
                      <tr key={w.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 whitespace-nowrap">{new Date(w.datum).toLocaleDateString("de-DE")}</td>
                        <td className="px-4 py-2.5 font-medium">
                          {w.artikel.name}
                          <div className="sm:hidden text-xs text-gray-500 mt-0.5">
                            {fmtMenge(w.menge)} {w.artikel.einheit} · {w.lieferant?.name ?? "—"}
                            {w.chargeNr && <> · {w.chargeNr}</>}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 font-mono hidden sm:table-cell">{fmtMenge(w.menge)} {w.artikel.einheit}</td>
                        <td className="px-4 py-2.5 text-gray-600 hidden sm:table-cell">{w.lieferant?.name ?? "—"}</td>
                        <td className="px-4 py-2.5 font-mono text-xs hidden md:table-cell">{w.chargeNr ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Lieferungen */}
          {lieferungen.length > 0 && (
            <div>
              <h2 className="text-base font-semibold text-gray-800 mb-3">
                Lieferungen an Kunden
                <span className="ml-2 text-sm font-normal text-gray-400">({lieferungen.length})</span>
              </h2>
              <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Datum</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Kunde</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Artikel</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Menge</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Charge</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Beleg</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {lieferungen.map((l) => {
                      const artikelName =
                        l.artikel?.name ??
                        (result.modus === "artikel" ? result.artikel.name : "—");
                      const artikelEinheit =
                        l.artikel?.einheit ??
                        (result.modus === "artikel" ? result.artikel.einheit : "");
                      return (
                        <tr key={l.lieferpositionId} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5 whitespace-nowrap hidden sm:table-cell">{new Date(l.datum).toLocaleDateString("de-DE")}</td>
                          <td className="px-4 py-2.5">
                            <Link href={`/kunden/${l.kunde.id}`} className="font-medium text-green-700 hover:underline">
                              {l.kunde.firma ? `${l.kunde.firma} (${l.kunde.name})` : l.kunde.name}
                            </Link>
                            <div className="sm:hidden text-xs text-gray-500 mt-0.5">
                              {new Date(l.datum).toLocaleDateString("de-DE")} · {fmtMenge(l.menge)} {artikelEinheit}
                              {l.chargeNr && <> · Charge {l.chargeNr}</>}
                            </div>
                            <div className="md:hidden sm:hidden text-xs text-gray-400">{artikelName}</div>
                          </td>
                          <td className="px-4 py-2.5 font-medium hidden md:table-cell">{artikelName}</td>
                          <td className="px-4 py-2.5 font-mono whitespace-nowrap hidden sm:table-cell">{fmtMenge(l.menge)} {artikelEinheit}</td>
                          <td className="px-4 py-2.5 font-mono text-xs hidden md:table-cell">{l.chargeNr ?? "—"}</td>
                          <td className="px-4 py-2.5">{statusBadge(l.status)}</td>
                          <td className="px-4 py-2.5 hidden lg:table-cell">
                            <Link
                              href={`/lieferungen/${l.lieferungId}`}
                              className="text-xs text-green-700 hover:underline"
                            >
                              {l.rechnungNr ?? `LS #${l.lieferungId}`}
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
