"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { formatEuro, formatDatum } from "@/lib/utils";

interface FirmaEinstellungen {
  name: string;
  adresse: string;
  plz: string;
  ort: string;
  tel: string;
  email: string;
  iban: string;
  bic: string;
}

interface MahnwesenEintrag {
  lieferung: { id: number; datum: string; notiz: string | null };
  kunde: { id: number; name: string; firma: string | null };
  rechnungNr: string | null;
  rechnungDatum: string;
  betrag: number;
  tageUeberfaellig: number;
  mahnstufe: 1 | 2 | 3;
}

const STUFE_FARBEN: Record<number, string> = {
  1: "bg-yellow-50 border-yellow-200",
  2: "bg-orange-50 border-orange-200",
  3: "bg-red-50 border-red-200",
};

const STUFE_BADGE: Record<number, string> = {
  1: "bg-yellow-100 text-yellow-800",
  2: "bg-orange-100 text-orange-800",
  3: "bg-red-100 text-red-800",
};

const STUFE_LABEL: Record<number, string> = {
  1: "Stufe 1",
  2: "Stufe 2",
  3: "Stufe 3",
};

export default function MahnwesenPage() {
  const [eintraege, setEintraege] = useState<MahnwesenEintrag[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [stufeFilter, setStufeFilter] = useState<number | "alle">("alle");
  const [firma, setFirma] = useState<FirmaEinstellungen>({
    name: "", adresse: "", plz: "", ort: "", tel: "", email: "", iban: "", bic: "",
  });

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [mahnRes, firmaRes] = await Promise.all([
        fetch("/api/mahnwesen"),
        fetch("/api/einstellungen?prefix=firma."),
      ]);
      if (!mahnRes.ok) throw new Error("Fehler beim Laden");
      const data = await mahnRes.json();
      setEintraege(Array.isArray(data) ? data : []);
      if (firmaRes.ok) {
        const firmaData: Record<string, string> = await firmaRes.json();
        setFirma({
          name: firmaData["firma.name"] ?? firmaData["firma.firmenname"] ?? "",
          adresse: firmaData["firma.adresse"] ?? "",
          plz: firmaData["firma.plz"] ?? "",
          ort: firmaData["firma.ort"] ?? "",
          tel: firmaData["firma.tel"] ?? firmaData["firma.telefon"] ?? "",
          email: firmaData["firma.email"] ?? "",
          iban: firmaData["firma.iban"] ?? "",
          bic: firmaData["firma.bic"] ?? "",
        });
      }
    } catch {
      setError("Fehler beim Laden der überfälligen Rechnungen.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function markiereBezahlt(lieferungId: number) {
    setActionLoading(lieferungId);
    try {
      const res = await fetch(`/api/lieferungen/${lieferungId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bezahltAm: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error("Fehler");
      await load();
    } catch {
      setError("Fehler beim Markieren als bezahlt.");
    } finally {
      setActionLoading(null);
    }
  }

  const gefiltert =
    stufeFilter === "alle"
      ? eintraege
      : eintraege.filter((e) => e.mahnstufe === stufeFilter);

  const gesamtbetrag = gefiltert.reduce((s, e) => s + e.betrag, 0);

  const anzahlJeStufe: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
  for (const e of eintraege) anzahlJeStufe[e.mahnstufe] = (anzahlJeStufe[e.mahnstufe] ?? 0) + 1;

  function druckeZahlungserinnerung(eintrag: MahnwesenEintrag) {
    const win = window.open("", "_blank", "width=800,height=600");
    if (!win) return;
    const kundenname = eintrag.kunde.firma
      ? `${eintrag.kunde.firma}\nz. H. ${eintrag.kunde.name}`
      : eintrag.kunde.name;
    const heute = new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
    const rDatum = formatDatum(eintrag.rechnungDatum);
    const stufe = eintrag.mahnstufe;
    const betreff =
      stufe === 1 ? "Zahlungserinnerung" : stufe === 2 ? "1. Mahnung" : "2. Mahnung / Letzte Mahnung";
    const text =
      stufe === 1
        ? `wir erlauben uns, Sie freundlich daran zu erinnern, dass die nachstehende Rechnung noch offen ist. Bitte veranlassen Sie baldmöglichst die Begleichung des ausstehenden Betrages.`
        : stufe === 2
        ? `trotz unserer freundlichen Erinnerung haben wir bislang keinen Zahlungseingang feststellen können. Wir bitten Sie dringend, den offenen Betrag innerhalb von 7 Tagen zu begleichen.`
        : `leider haben wir auch nach unserer 1. Mahnung keinen Zahlungseingang festgestellt. Wir fordern Sie hiermit letztmalig auf, den Betrag innerhalb von 5 Tagen zu überweisen. Andernfalls behalten wir uns rechtliche Schritte vor.`;

    const absenderzeile = [firma.adresse, `${firma.plz} ${firma.ort}`.trim()]
      .filter(Boolean).join(", ");
    const ibanZeile = firma.iban
      ? `IBAN: ${firma.iban}${firma.bic ? ` · BIC: ${firma.bic}` : ""}`
      : "";
    const kontaktZeile = [firma.tel && `Tel: ${firma.tel}`, firma.email].filter(Boolean).join(" · ");
    const kontoInfo = firma.iban
      ? `Bitte überweisen Sie den Betrag von <strong>${formatEuro(eintrag.betrag)}</strong> auf folgendes Konto:<br><strong>${ibanZeile}</strong>`
      : `Bitte überweisen Sie den Betrag von <strong>${formatEuro(eintrag.betrag)}</strong> auf unser bekanntes Konto.`;

    win.document.write(`<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8" />
<title>${betreff}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 14px; color: #000; margin: 2cm; }
  .absender { font-size: 11px; color: #888; border-bottom: 1px solid #ccc; padding-bottom: 0.5em; margin-bottom: 1.5em; }
  h2 { font-size: 18px; margin-bottom: 0.5em; }
  table { width: 100%; border-collapse: collapse; margin: 1.5em 0; }
  th, td { border: 1px solid #ccc; padding: 8px 12px; text-align: left; }
  th { background: #f5f5f5; }
  .total { font-weight: bold; font-size: 15px; }
  .footer { margin-top: 3em; padding-top: 1em; border-top: 1px solid #eee; font-size: 11px; color: #777; text-align: center; }
  @media print { @page { margin: 1.5cm; size: A4; } }
</style>
</head>
<body>
${firma.name || absenderzeile ? `<div class="absender">${[firma.name, absenderzeile, kontaktZeile].filter(Boolean).join(" · ")}</div>` : ""}
<p style="margin-bottom:2em;white-space:pre-line;">${kundenname}</p>
<p style="text-align:right;">${heute}</p>
<h2>${betreff}</h2>
<p>Sehr geehrte Damen und Herren,</p>
<p>${text}</p>
<table>
  <thead><tr><th>Rechnungsnr.</th><th>Rechnungsdatum</th><th>Tage überfällig</th><th>Betrag</th></tr></thead>
  <tbody>
    <tr>
      <td>${eintrag.rechnungNr ?? `#${eintrag.lieferung.id}`}</td>
      <td>${rDatum}</td>
      <td>${eintrag.tageUeberfaellig} Tage</td>
      <td class="total">${formatEuro(eintrag.betrag)}</td>
    </tr>
  </tbody>
</table>
<p>${kontoInfo}</p>
<p style="margin-top:2em;">Mit freundlichen Grüßen</p>
<p><strong>${firma.name || "AgrarOffice"}</strong></p>
<div class="footer">${[firma.name, absenderzeile, ibanZeile, kontaktZeile].filter(Boolean).join(" · ")}</div>
<script>window.onload = function() { window.print(); }</script>
</body>
</html>`);
    win.document.close();
  }

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mahnwesen</h1>
          <p className="text-sm text-gray-500 mt-0.5">Überfällige Rechnungen mit automatischer Mahnstufen-Berechnung</p>
        </div>
        <button
          onClick={load}
          className="text-sm text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg px-3 py-1.5 transition-colors"
        >
          Aktualisieren
        </button>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-gray-400 text-sm">Lade überfällige Rechnungen…</p>
      ) : eintraege.length === 0 ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center text-green-700">
          Keine überfälligen Rechnungen – alles im grünen Bereich!
        </div>
      ) : (
        <>
          {/* Mahnstufen-Übersicht + Gesamtsumme */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div
              className={`rounded-xl border p-4 cursor-pointer transition-all ${
                stufeFilter === "alle"
                  ? "bg-gray-100 border-gray-400 ring-2 ring-gray-400"
                  : "bg-gray-50 border-gray-200 hover:border-gray-300"
              }`}
              onClick={() => setStufeFilter("alle")}
            >
              <div className="text-2xl font-bold text-gray-900">{eintraege.length}</div>
              <div className="text-xs text-gray-500 mt-0.5">Alle überfällig</div>
            </div>
            {([1, 2, 3] as const).map((stufe) => (
              <div
                key={stufe}
                className={`rounded-xl border p-4 cursor-pointer transition-all ${
                  stufeFilter === stufe
                    ? `${STUFE_FARBEN[stufe]} ring-2 ring-current`
                    : `${STUFE_FARBEN[stufe]} hover:shadow-sm`
                }`}
                onClick={() => setStufeFilter(stufeFilter === stufe ? "alle" : stufe)}
              >
                <div className={`text-2xl font-bold ${stufe === 1 ? "text-yellow-700" : stufe === 2 ? "text-orange-700" : "text-red-700"}`}>
                  {anzahlJeStufe[stufe] ?? 0}
                </div>
                <div className="text-xs text-gray-600 mt-0.5">
                  {stufe === 1 ? "Stufe 1 (14–27 Tage)" : stufe === 2 ? "Stufe 2 (28–41 Tage)" : "Stufe 3 (ab 42 Tage)"}
                </div>
              </div>
            ))}
          </div>

          {/* Gesamtsumme */}
          <div className="flex items-center justify-between mb-4 px-1">
            <span className="text-sm text-gray-600">
              {gefiltert.length} Einträge angezeigt
              {stufeFilter !== "alle" && (
                <button
                  onClick={() => setStufeFilter("alle")}
                  className="ml-2 text-xs text-green-700 hover:underline"
                >
                  Filter zurücksetzen
                </button>
              )}
            </span>
            <span className="text-sm font-semibold text-gray-900">
              Gesamtforderung:{" "}
              <span className="text-red-700 font-bold text-base">{formatEuro(gesamtbetrag)}</span>
            </span>
          </div>

          {/* Tabelle */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Mahnstufe</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Rechnungsdatum</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Kunde</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap hidden sm:table-cell">Rechnungsnr.</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Betrag</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap hidden md:table-cell">Tage überfällig</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Aktionen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {gefiltert.map((e) => (
                    <tr
                      key={e.lieferung.id}
                      className={`hover:brightness-95 transition-all ${
                        e.mahnstufe === 3
                          ? "bg-red-50"
                          : e.mahnstufe === 2
                          ? "bg-orange-50"
                          : "bg-yellow-50"
                      }`}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${STUFE_BADGE[e.mahnstufe]}`}>
                          {STUFE_LABEL[e.mahnstufe]}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-700">{formatDatum(e.rechnungDatum)}</td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/kunden/${e.kunde.id}`}
                          className="text-green-700 hover:underline font-medium"
                        >
                          {e.kunde.firma ? `${e.kunde.firma} (${e.kunde.name})` : e.kunde.name}
                        </Link>
                        {/* Mobile: rechnungNr */}
                        <div className="sm:hidden text-xs text-gray-400 mt-0.5">
                          {e.rechnungNr ?? `#${e.lieferung.id}`}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-gray-700 hidden sm:table-cell">
                        {e.rechnungNr ? (
                          <Link
                            href={`/lieferungen/${e.lieferung.id}`}
                            className="text-blue-600 hover:underline"
                          >
                            {e.rechnungNr}
                          </Link>
                        ) : (
                          <Link
                            href={`/lieferungen/${e.lieferung.id}`}
                            className="text-gray-400 hover:underline"
                          >
                            #{e.lieferung.id}
                          </Link>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900 whitespace-nowrap">
                        {formatEuro(e.betrag)}
                      </td>
                      <td className="px-4 py-3 text-right hidden md:table-cell">
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${STUFE_BADGE[e.mahnstufe]}`}>
                          {e.tageUeberfaellig} {e.tageUeberfaellig === 1 ? "Tag" : "Tage"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => druckeZahlungserinnerung(e)}
                            className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors border border-gray-200"
                            title="Zahlungserinnerung drucken"
                          >
                            Drucken
                          </button>
                          <button
                            onClick={() => markiereBezahlt(e.lieferung.id)}
                            disabled={actionLoading === e.lieferung.id}
                            className="px-2 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-60"
                          >
                            {actionLoading === e.lieferung.id ? "…" : "Bezahlt"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* Footer: Gesamtsumme der angezeigten Zeilen */}
                {gefiltert.length > 0 && (
                  <tfoot className="bg-gray-50 border-t border-gray-200">
                    <tr>
                      <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-gray-700 hidden sm:table-cell">
                        Gesamt ({gefiltert.length} Rechnungen)
                      </td>
                      <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-gray-700 sm:hidden">
                        Gesamt ({gefiltert.length})
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900 font-mono whitespace-nowrap">
                        {formatEuro(gesamtbetrag)}
                      </td>
                      <td colSpan={2} className="hidden md:table-cell" />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Legende */}
          <div className="mt-4 flex flex-wrap gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-full bg-yellow-100 border border-yellow-300" />
              Stufe 1: 14–27 Tage überfällig
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-full bg-orange-100 border border-orange-300" />
              Stufe 2: 28–41 Tage überfällig
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-full bg-red-100 border border-red-300" />
              Stufe 3: ab 42 Tage überfällig
            </span>
          </div>
        </>
      )}
    </div>
  );
}
