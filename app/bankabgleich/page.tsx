"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { formatEuro, formatDatum } from "@/lib/utils";
import ZuordnungsVorschlagCard from "@/components/bankabgleich/ZuordnungsVorschlagCard";
import AutomatischerAbgleich from "@/components/bankabgleich/AutomatischerAbgleich";
import * as Sentry from "@sentry/nextjs";

interface Kontoumsatz {
  id: number;
  buchungsdatum: string;
  wertstellung: string | null;
  betrag: number;
  waehrung: string;
  verwendungszweck: string;
  gegenkonto: string | null;
  gegenkontoName: string | null;
  saldo: number | null;
  zugeordnet: boolean;
  lieferungId: number | null;
  sammelrechnungId: number | null;
  ausgabeId: number | null;
  eingangsRechnungId: number | null;
  kontoBezeichnung: string | null;
  importDatei: string | null;
  ignoriert: boolean;
}

interface ApiResponse {
  umsaetze: Kontoumsatz[];
  gesamt: number;
  offen: number;
}

const FILTER_STORAGE_KEY = "bankabgleich-filter";

// Merkt sich die Statusfilter-Wahl über localStorage (nicht sessionStorage), da der Bankabgleich
// typischerweise über mehrere Wochen hinweg wiederholt aufgerufen wird — bereits abgeglichene
// Buchungen sollen dabei nicht jedes Mal neu ausgeblendet werden müssen.
function loadBankabgleichFilter(): { zugeordnetFilter?: "alle" | "offen" | "zugeordnet" | "ausgeblendet" } {
  try {
    return JSON.parse(localStorage.getItem(FILTER_STORAGE_KEY) ?? "{}");
  } catch (err) {
    Sentry.captureException(err);
    return {};
  }
}

type VorschlagTyp = "lieferung" | "sammelrechnung" | "ausgabe" | "eingangsrechnung";

const ZIEL_FELD: Record<VorschlagTyp, string> = {
  lieferung: "lieferungId",
  sammelrechnung: "sammelrechnungId",
  ausgabe: "ausgabeId",
  eingangsrechnung: "eingangsRechnungId",
};

interface Vorschlag {
  typ: VorschlagTyp;
  id: number;
  bezeichnung: string;
  gegenpartei: string;
  betrag: number;
  konfidenz: "hoch" | "mittel" | "niedrig";
  amountDiff: number;
  dayDiff: number;
  wirdBezahltAm: string;
}

function BankabgleichContent() {
  const searchParams = useSearchParams();
  const erfolgMsg = searchParams.get("erfolg");

  const today = new Date();
  const firstOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    .toISOString()
    .slice(0, 10);
  const todayStr = today.toISOString().slice(0, 10);

  const [von, setVon] = useState(firstOfLastMonth);
  const [bis, setBis] = useState(todayStr);
  // Server-sicherer Default; die gemerkte Wahl wird erst nach dem Mount übernommen (siehe Effekt
  // unten) — sonst SSR/Client-Mismatch, da localStorage serverseitig nicht existiert.
  const [zugeordnetFilter, setZugeordnetFilter] = useState<"alle" | "offen" | "zugeordnet" | "ausgeblendet">("offen");
  const [kontoFilter, setKontoFilter] = useState("");
  const [rundeFilter, setRundeFilter] = useState("");
  const [filtersLoaded, setFiltersLoaded] = useState(false);

  const [umsaetze, setUmsaetze] = useState<Kontoumsatz[]>([]);
  const [gesamt, setGesamt] = useState(0);
  const [offen, setOffen] = useState(0);
  const [loading, setLoading] = useState(true);

  const [offeneUmsatzSumme, setOffeneUmsatzSumme] = useState(0);

  // Vorschläge
  const [offenePanelId, setOffenePanelId] = useState<number | null>(null);
  const [vorschlaege, setVorschlaege] = useState<Vorschlag[]>([]);
  const [vorschlaegeLoading, setVorschlaegeLoading] = useState(false);
  const [zuordnungsFehler, setZuordnungsFehler] = useState<string | null>(null);

  // Alle verfügbaren Konten / Import-Runden
  const [konten, setKonten] = useState<string[]>([]);
  const [runden, setRunden] = useState<string[]>([]);

  async function laden() {
    setLoading(true);
    const params = new URLSearchParams();
    if (von) params.set("von", von);
    if (bis) params.set("bis", bis);
    if (zugeordnetFilter === "ausgeblendet") {
      params.set("ignoriert", "true");
    } else {
      if (zugeordnetFilter === "offen") params.set("zugeordnet", "false");
      else if (zugeordnetFilter === "zugeordnet") params.set("zugeordnet", "true");
    }
    if (kontoFilter) params.set("kontoBezeichnung", kontoFilter);
    if (rundeFilter) params.set("importDatei", rundeFilter);

    try {
      const res = await fetch(`/api/bankabgleich?${params}`);
      if (res.ok) {
        const data: ApiResponse = await res.json();
        setUmsaetze(data.umsaetze);
        setGesamt(data.gesamt);
        setOffen(data.offen);

        // Summe offener Umsätze (positiv = Eingang)
        const summeOffen = data.umsaetze
          .filter((u) => !u.zugeordnet && u.betrag > 0)
          .reduce((s, u) => s + u.betrag, 0);
        setOffeneUmsatzSumme(summeOffen);

        // Extrahiere eindeutige Konto-Bezeichnungen
        const allKonten = Array.from(
          new Set(data.umsaetze.map((u) => u.kontoBezeichnung).filter(Boolean) as string[])
        );
        if (allKonten.length > 0) setKonten(allKonten);

        // Extrahiere eindeutige Import-Runden (Dateiname), neueste zuerst
        const allRunden = Array.from(
          new Set(data.umsaetze.map((u) => u.importDatei).filter(Boolean) as string[])
        );
        if (allRunden.length > 0) setRunden(allRunden);
      }
    } finally {
      setLoading(false);
    }
  }

  // Gemerkten Statusfilter erst nach dem Mount übernehmen (clientseitig) — hält den ersten
  // Client-Render identisch zum Server-Render. Ein "runde"-Query-Parameter (Sprung direkt nach
  // einem Import) hat Vorrang: dann soll man die gerade importierte Runde sofort sehen.
  useEffect(() => {
    const runde = searchParams.get("runde");
    if (runde) setRundeFilter(runde);
    else {
      const gespeichert = loadBankabgleichFilter();
      if (gespeichert.zugeordnetFilter) setZugeordnetFilter(gespeichert.zugeordnetFilter);
    }
    setFiltersLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Statusfilter-Wahl merken (erst nach dem Wiederherstellen, sonst überschreiben wir sie sofort wieder)
  useEffect(() => {
    if (!filtersLoaded) return;
    try {
      localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify({ zugeordnetFilter }));
    } catch (err) {
      Sentry.captureException(err);
      /* ignore */
    }
  }, [filtersLoaded, zugeordnetFilter]);

  useEffect(() => {
    if (!filtersLoaded) return;
    laden();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersLoaded, von, bis, zugeordnetFilter, kontoFilter, rundeFilter]);

  async function oeffneVorschlaege(umsatzId: number) {
    if (offenePanelId === umsatzId) {
      setOffenePanelId(null);
      return;
    }
    setOffenePanelId(umsatzId);
    setVorschlaege([]);
    setZuordnungsFehler(null);
    setVorschlaegeLoading(true);
    try {
      const res = await fetch(`/api/bankabgleich/vorschlaege?umsatzId=${umsatzId}`);
      if (res.ok) {
        setVorschlaege(await res.json());
      }
    } finally {
      setVorschlaegeLoading(false);
    }
  }

  async function zuordnen(umsatzId: number, vorschlag: Vorschlag, alsBezahltMarkieren: boolean) {
    setZuordnungsFehler(null);
    const body: Record<string, unknown> = {
      [ZIEL_FELD[vorschlag.typ]]: vorschlag.id,
      alsBezahltMarkieren,
      zuordnungsArt: "manuell",
    };

    const res = await fetch(`/api/bankabgleich/${umsatzId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setOffenePanelId(null);
      laden();
    } else {
      const d = await res.json();
      setZuordnungsFehler(d.error ?? "Fehler beim Zuordnen");
    }
  }

  async function zuordnungAufheben(umsatzId: number) {
    if (!confirm("Zuordnung wirklich aufheben? Falls dadurch als bezahlt markiert, wird die Rechnung wieder als offen geführt.")) return;
    await fetch(`/api/bankabgleich/${umsatzId}`, { method: "DELETE" });
    laden();
  }

  // Buchung manuell ausblenden (z.B. interne Umbuchung) — bleibt unzugeordnet, taucht aber in
  // Offen/Zugeordnet/Alle nicht mehr auf; über den "Ausgeblendet"-Filter jederzeit einblendbar.
  async function ausblenden(umsatzId: number) {
    setOffenePanelId(null);
    await fetch(`/api/bankabgleich/${umsatzId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ignoriert: true }),
    });
    laden();
  }

  async function einblenden(umsatzId: number) {
    await fetch(`/api/bankabgleich/${umsatzId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ignoriert: false }),
    });
    laden();
  }

  // KPI diese Woche
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay() + 1);
  const zugeordnetDieseWoche = umsaetze.filter(
    (u) => u.zugeordnet && new Date(u.buchungsdatum) >= startOfWeek
  ).length;

  const offenAnzahl = umsaetze.filter((u) => !u.zugeordnet).length;

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bankabgleich</h1>
          <p className="text-sm text-gray-500 mt-0.5">Kontoauszüge mit Rechnungen abgleichen</p>
        </div>
        <Link
          href="/bankabgleich/import"
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium"
        >
          Kontoauszug importieren
        </Link>
      </div>

      {/* Erfolgsmeldung */}
      {erfolgMsg && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-sm">
          {decodeURIComponent(erfolgMsg)}
        </div>
      )}

      {/* KPI-Zeile */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
          <div className="text-xs text-gray-500 mb-1">Offene Umsätze</div>
          <div className="text-2xl font-bold text-amber-600">{offenAnzahl}</div>
          <div className="text-xs text-gray-400 mt-1">{formatEuro(offeneUmsatzSumme)} Eingänge offen</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
          <div className="text-xs text-gray-500 mb-1">Gesamt (gefiltert)</div>
          <div className="text-2xl font-bold text-gray-800">{gesamt}</div>
          <div className="text-xs text-gray-400 mt-1">{offen} noch offen</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
          <div className="text-xs text-gray-500 mb-1">Zugeordnet diese Woche</div>
          <div className="text-2xl font-bold text-green-600">{zugeordnetDieseWoche}</div>
          <div className="text-xs text-gray-400 mt-1">Buchungen verknüpft</div>
        </div>
      </div>

      {/* Filter-Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Von</label>
          <input
            type="date"
            value={von}
            onChange={(e) => setVon(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Bis</label>
          <input
            type="date"
            value={bis}
            onChange={(e) => setBis(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
          />
          <p className="mt-1 text-xs text-gray-400 max-w-[16rem]">
            Bezieht sich auf den Buchungstag bei der Bank — unabhängig davon, wann eine zugehörige
            Rechnung gestellt wurde.
          </p>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Status</label>
          <select
            value={zugeordnetFilter}
            onChange={(e) => setZugeordnetFilter(e.target.value as "alle" | "offen" | "zugeordnet" | "ausgeblendet")}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
          >
            <option value="alle">Alle</option>
            <option value="offen">Offen</option>
            <option value="zugeordnet">Zugeordnet</option>
            <option value="ausgeblendet">Ausgeblendet</option>
          </select>
        </div>
        {konten.length > 1 && (
          <div>
            <label className="block text-xs text-gray-500 mb-1">Konto</label>
            <select
              value={kontoFilter}
              onChange={(e) => setKontoFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
            >
              <option value="">Alle Konten</option>
              {konten.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>
        )}
        {(runden.length > 1 || rundeFilter) && (
          <div>
            <label className="block text-xs text-gray-500 mb-1">Import-Runde</label>
            <select
              value={rundeFilter}
              onChange={(e) => setRundeFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 max-w-[14rem]"
            >
              <option value="">Alle Runden</option>
              {rundeFilter && !runden.includes(rundeFilter) && (
                <option value={rundeFilter}>{rundeFilter}</option>
              )}
              {runden.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <AutomatischerAbgleich von={von} bis={bis} onUebernommen={laden} />

      {/* Fehler Zuordnung */}
      {zuordnungsFehler && (
        <div className="mb-3 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
          {zuordnungsFehler}
        </div>
      )}

      {/* Tabelle */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Lade…</div>
        ) : umsaetze.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            Keine Kontoauszüge im gewählten Zeitraum.{" "}
            <Link href="/bankabgleich/import" className="text-green-600 hover:underline">
              Jetzt importieren
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-3 py-2">Datum</th>
                <th className="text-right px-3 py-2">Betrag</th>
                <th className="text-left px-3 py-2">Verwendungszweck</th>
                <th className="text-left px-3 py-2 hidden md:table-cell">Gegenpartei</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {umsaetze.map((u) => (
                <React.Fragment key={u.id}>
                  <tr className={`hover:bg-gray-50 ${offenePanelId === u.id ? "bg-gray-50" : ""}`}>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-700">
                      {formatDatum(u.buchungsdatum)}
                      {u.kontoBezeichnung && (
                        <div className="text-xs text-gray-400 mt-0.5">{u.kontoBezeichnung}</div>
                      )}
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-semibold whitespace-nowrap ${
                        u.betrag >= 0 ? "text-green-700" : "text-red-600"
                      }`}
                    >
                      {u.betrag >= 0 ? "+" : ""}
                      {formatEuro(u.betrag)}
                    </td>
                    <td className="px-3 py-2 max-w-xs">
                      <span className="block truncate" title={u.verwendungszweck}>
                        {u.verwendungszweck.length > 60
                          ? u.verwendungszweck.slice(0, 60) + "…"
                          : u.verwendungszweck}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-600 hidden md:table-cell">
                      {u.gegenkontoName || u.gegenkonto || "—"}
                    </td>
                    <td className="px-3 py-2">
                      {u.ignoriert ? (
                        <span className="inline-flex items-center bg-gray-200 text-gray-600 text-xs px-2 py-0.5 rounded font-medium">
                          Ausgeblendet
                        </span>
                      ) : u.zugeordnet ? (
                        <span className="inline-flex items-center gap-1 bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded font-medium">
                          Zugeordnet ✓
                          {u.lieferungId && (
                            <Link
                              href={`/lieferungen/${u.lieferungId}`}
                              className="underline ml-1"
                            >
                              Lieferung
                            </Link>
                          )}
                          {u.sammelrechnungId && (
                            <Link
                              href={`/lieferungen?sammelrechnungId=${u.sammelrechnungId}`}
                              className="underline ml-1"
                            >
                              Rechnung
                            </Link>
                          )}
                          {u.ausgabeId && (
                            <Link href={`/ausgaben/${u.ausgabeId}`} className="underline ml-1">
                              Ausgabe
                            </Link>
                          )}
                          {u.eingangsRechnungId && (
                            <Link href={`/eingangsrechnungen/${u.eingangsRechnungId}`} className="underline ml-1">
                              Lieferantenrechnung
                            </Link>
                          )}
                        </span>
                      ) : (
                        <span className="inline-flex items-center bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded font-medium">
                          Offen
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex gap-2 justify-end items-center">
                        {u.ignoriert ? (
                          <button
                            onClick={() => einblenden(u.id)}
                            className="text-xs text-gray-500 hover:text-green-700 hover:underline"
                          >
                            Einblenden
                          </button>
                        ) : !u.zugeordnet ? (
                          <>
                            <button
                              onClick={() => oeffneVorschlaege(u.id)}
                              className="text-xs px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium"
                            >
                              {offenePanelId === u.id ? "Schließen" : "Zuordnen"}
                            </button>
                            <button
                              onClick={() => ausblenden(u.id)}
                              title="Buchung ausblenden (z.B. interne Umbuchung) — kein offener Posten"
                              className="text-xs text-gray-400 hover:text-gray-700 hover:underline"
                            >
                              Ausblenden
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => zuordnungAufheben(u.id)}
                            className="text-xs text-gray-500 hover:text-red-600 hover:underline"
                          >
                            Aufheben
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Inline Vorschlags-Panel */}
                  {offenePanelId === u.id && (
                    <tr>
                      <td colSpan={6} className="px-4 pb-4 bg-gray-50 border-b">
                        <div className="pt-3">
                          <h3 className="text-sm font-semibold text-gray-700 mb-3">
                            Zuordnungsvorschläge für {formatEuro(u.betrag)} vom{" "}
                            {formatDatum(u.buchungsdatum)}
                          </h3>
                          {vorschlaegeLoading ? (
                            <div className="text-sm text-gray-400">Suche Vorschläge…</div>
                          ) : vorschlaege.length === 0 ? (
                            <div className="text-sm text-gray-500">
                              Keine automatischen Vorschläge gefunden.
                              <br />
                              <span className="text-xs text-gray-400">
                                Manuelle Zuordnung über die Rechnungsansicht möglich.
                              </span>
                            </div>
                          ) : (
                            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                              {vorschlaege.map((v, idx) => (
                                <ZuordnungsVorschlagCard
                                  key={idx}
                                  typ={v.typ}
                                  bezeichnung={v.bezeichnung}
                                  gegenpartei={v.gegenpartei}
                                  betrag={v.betrag}
                                  konfidenz={v.konfidenz}
                                  wirdBezahltAm={v.wirdBezahltAm}
                                  amountDiff={v.amountDiff}
                                  dayDiff={v.dayDiff}
                                  onUebernehmen={(alsBezahlt) => zuordnen(u.id, v, alsBezahlt)}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// React needs to be imported for React.Fragment
import React from "react";

export default function BankabgleichPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-400">Lade…</div>}>
      <BankabgleichContent />
    </Suspense>
  );
}
