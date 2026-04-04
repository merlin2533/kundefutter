"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

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
  kontoBezeichnung: string | null;
  importDatei: string | null;
}

interface ApiResponse {
  umsaetze: Kontoumsatz[];
  gesamt: number;
  offen: number;
}

interface Vorschlag {
  typ: "lieferung" | "sammelrechnung";
  id: number;
  rechnungNr: string | null;
  kundeName: string;
  betrag: number;
  konfidenz: "hoch" | "mittel" | "niedrig";
}

function formatEuro(n: number) {
  return n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

function formatDatum(d: string) {
  return new Date(d).toLocaleDateString("de-DE");
}

function KonfidenzBadge({ k }: { k: "hoch" | "mittel" | "niedrig" }) {
  const cls =
    k === "hoch"
      ? "bg-green-100 text-green-800"
      : k === "mittel"
      ? "bg-yellow-100 text-yellow-800"
      : "bg-gray-100 text-gray-600";
  return (
    <span className={`text-xs px-2 py-0.5 rounded font-medium ${cls}`}>
      {k === "hoch" ? "Hohe Übereinstimmung" : k === "mittel" ? "Mittel" : "Niedrig"}
    </span>
  );
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
  const [zugeordnetFilter, setZugeordnetFilter] = useState<"alle" | "offen" | "zugeordnet">("alle");
  const [kontoFilter, setKontoFilter] = useState("");

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

  // Alle verfügbaren Konten
  const [konten, setKonten] = useState<string[]>([]);

  async function laden() {
    setLoading(true);
    const params = new URLSearchParams();
    if (von) params.set("von", von);
    if (bis) params.set("bis", bis);
    if (zugeordnetFilter === "offen") params.set("zugeordnet", "false");
    else if (zugeordnetFilter === "zugeordnet") params.set("zugeordnet", "true");
    if (kontoFilter) params.set("kontoBezeichnung", kontoFilter);

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
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    laden();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [von, bis, zugeordnetFilter, kontoFilter]);

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

  async function zuordnen(umsatzId: number, vorschlag: Vorschlag) {
    setZuordnungsFehler(null);
    const body: Record<string, number> = {};
    if (vorschlag.typ === "lieferung") body.lieferungId = vorschlag.id;
    else body.sammelrechnungId = vorschlag.id;

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
    if (!confirm("Zuordnung wirklich aufheben?")) return;
    await fetch(`/api/bankabgleich/${umsatzId}`, { method: "DELETE" });
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
    <div className="p-6 max-w-7xl mx-auto">
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
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Status</label>
          <select
            value={zugeordnetFilter}
            onChange={(e) => setZugeordnetFilter(e.target.value as "alle" | "offen" | "zugeordnet")}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
          >
            <option value="alle">Alle</option>
            <option value="offen">Offen</option>
            <option value="zugeordnet">Zugeordnet</option>
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
      </div>

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
                      {u.zugeordnet ? (
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
                        </span>
                      ) : (
                        <span className="inline-flex items-center bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded font-medium">
                          Offen
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex gap-2 justify-end items-center">
                        {!u.zugeordnet ? (
                          <button
                            onClick={() => oeffneVorschlaege(u.id)}
                            className="text-xs px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium"
                          >
                            {offenePanelId === u.id ? "Schließen" : "Zuordnen"}
                          </button>
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
                                <button
                                  key={idx}
                                  onClick={() => zuordnen(u.id, v)}
                                  className="text-left bg-white border border-gray-200 rounded-lg p-3 hover:border-green-500 hover:shadow-sm transition-all group"
                                >
                                  <div className="flex items-start justify-between gap-2 mb-1">
                                    <span className="text-xs text-gray-500 uppercase tracking-wide">
                                      {v.typ === "lieferung" ? "Lieferung" : "Sammelrechnung"}
                                    </span>
                                    <KonfidenzBadge k={v.konfidenz} />
                                  </div>
                                  <div className="font-semibold text-sm text-gray-900 group-hover:text-green-700">
                                    {v.kundeName}
                                  </div>
                                  {v.rechnungNr && (
                                    <div className="text-xs text-gray-500 mt-0.5">{v.rechnungNr}</div>
                                  )}
                                  <div className="text-sm font-bold text-gray-800 mt-1">
                                    {formatEuro(v.betrag)}
                                  </div>
                                </button>
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
