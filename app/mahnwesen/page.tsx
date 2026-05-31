"use client";
import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { formatEuro, formatDatum } from "@/lib/utils";
import { DEFAULT_MAHNWESEN_CONFIG, parseMahnwesenConfig, type MahnwesenConfig } from "@/lib/mahnwesen-config";

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
  kunde: { id: number; name: string; firma: string | null; kontakte?: { wert: string }[] };
  rechnungNr: string | null;
  rechnungDatum: string;
  betrag: number;
  tageUeberfaellig: number;
  mahnstufe: 1 | 2 | 3;
}

function berechneVerzugszinsen(betrag: number, tageUeberfaellig: number, satz: number): number {
  if (tageUeberfaellig <= 0) return 0;
  return (betrag * (satz / 100) / 365) * tageUeberfaellig;
}

function mahngebuehr(cfg: MahnwesenConfig, stufe: number): number {
  return stufe === 3 ? cfg.mahngebuehr3 : stufe === 2 ? cfg.mahngebuehr2 : cfg.mahngebuehr1;
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
  const [kiOpen, setKiOpen] = useState<{ kundeId: number; stufe: number; kundeName: string; rechnungen: { nr: string; datum: string; betrag: number; tageUeberfaellig: number }[] } | null>(null);
  const [kiLoading, setKiLoading] = useState(false);
  const [kiResult, setKiResult] = useState<{ betreff: string; anrede: string; text: string; gruss: string } | null>(null);
  const [kiError, setKiError] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [stufeFilter, setStufeFilter] = useState<number | "alle">("alle");
  const [sepaLoading, setSepaLoading] = useState(false);
  const [sepaFehler, setSepaFehler] = useState("");

  // E-Mail-Versand je Zeile: lieferungId → { offen, empfaenger, loading, erfolg, fehler }
  const [emailState, setEmailState] = useState<Record<number, { offen: boolean; empfaenger: string; loading: boolean; erfolg: string; fehler: string }>>({});
  const [firma, setFirma] = useState<FirmaEinstellungen>({
    name: "", adresse: "", plz: "", ort: "", tel: "", email: "", iban: "", bic: "",
  });
  const [cfg, setCfg] = useState<MahnwesenConfig>(DEFAULT_MAHNWESEN_CONFIG);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [mahnRes, firmaRes, cfgRes] = await Promise.all([
        fetch("/api/mahnwesen"),
        fetch("/api/einstellungen?prefix=firma."),
        fetch("/api/einstellungen?prefix=system.mahnwesen"),
      ]);
      if (!mahnRes.ok) throw new Error("Fehler beim Laden");
      if (cfgRes.ok) {
        const cfgData: Record<string, string> = await cfgRes.json();
        setCfg(parseMahnwesenConfig(cfgData["system.mahnwesen"]));
      }
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

  async function exportiereSepa() {
    setSepaLoading(true);
    setSepaFehler("");
    try {
      const ids = gefiltert.map((e) => e.lieferung.id);
      if (ids.length === 0) {
        setSepaFehler("Keine Einträge zum Exportieren.");
        return;
      }
      const res = await fetch("/api/exporte/sepa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lieferungIds: ids }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSepaFehler(data?.error ?? "SEPA-Export fehlgeschlagen.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const heute = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `sepa-export-${heute}.xml`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setSepaFehler("Netzwerkfehler beim SEPA-Export.");
    } finally {
      setSepaLoading(false);
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

    const gebuehr = mahngebuehr(cfg, stufe);
    const zinsen = berechneVerzugszinsen(eintrag.betrag, eintrag.tageUeberfaellig, cfg.verzugszinssatz);
    const gesamtForderung = eintrag.betrag + gebuehr + zinsen;

    const absenderzeile = [firma.adresse, `${firma.plz} ${firma.ort}`.trim()]
      .filter(Boolean).join(", ");
    const ibanZeile = firma.iban
      ? `IBAN: ${firma.iban}${firma.bic ? ` · BIC: ${firma.bic}` : ""}`
      : "";
    const kontaktZeile = [firma.tel && `Tel: ${firma.tel}`, firma.email].filter(Boolean).join(" · ");
    const kontoInfo = firma.iban
      ? `Bitte überweisen Sie den Gesamtbetrag von <strong>${formatEuro(gesamtForderung)}</strong> auf folgendes Konto:<br><strong>${ibanZeile}</strong>`
      : `Bitte überweisen Sie den Gesamtbetrag von <strong>${formatEuro(gesamtForderung)}</strong> auf unser bekanntes Konto.`;

    const zusatzZeilen = [
      gebuehr > 0
        ? `<tr><td colspan="3" style="text-align:right;">Mahngebühr</td><td>${formatEuro(gebuehr)}</td></tr>`
        : "",
      zinsen > 0
        ? `<tr><td colspan="3" style="text-align:right;">Verzugszinsen (${cfg.verzugszinssatz.toFixed(2)}% p.a.)</td><td>${formatEuro(zinsen)}</td></tr>`
        : "",
      gebuehr > 0 || zinsen > 0
        ? `<tr><td colspan="3" style="text-align:right;" class="total">Gesamtforderung</td><td class="total">${formatEuro(gesamtForderung)}</td></tr>`
        : "",
    ].join("");

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
      <td>${formatEuro(eintrag.betrag)}</td>
    </tr>
    ${zusatzZeilen}
  </tbody>
</table>
<p>${kontoInfo}</p>
<p style="margin-top:2em;">Mit freundlichen Grüßen</p>
<p><strong>${firma.name || ""}</strong></p>
<div class="footer">${[firma.name, absenderzeile, ibanZeile, kontaktZeile].filter(Boolean).join(" · ")}</div>
<script>window.onload = function() { window.print(); }</script>
</body>
</html>`);
    win.document.close();
  }

  return (
    <div className="max-w-screen-xl mx-auto">
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

      {/* Verzugszins-Info */}
      <div className="mb-4 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800 flex items-center justify-between gap-3 flex-wrap">
        <span>
          Verzugszinssatz: <strong>{cfg.verzugszinssatz.toFixed(2)}% p.a.</strong> (§ 288 BGB)
          {(cfg.mahngebuehr1 > 0 || cfg.mahngebuehr2 > 0 || cfg.mahngebuehr3 > 0) && (
            <> · Mahngebühren: {formatEuro(cfg.mahngebuehr1)} / {formatEuro(cfg.mahngebuehr2)} / {formatEuro(cfg.mahngebuehr3)}</>
          )}
        </span>
        <Link href="/einstellungen/mahnwesen" className="text-blue-700 hover:underline whitespace-nowrap">
          Einstellungen ›
        </Link>
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
                  {stufe === 1
                    ? `Stufe 1 (${cfg.stufe1Tage}–${cfg.stufe2Tage - 1} Tage)`
                    : stufe === 2
                    ? `Stufe 2 (${cfg.stufe2Tage}–${cfg.stufe3Tage - 1} Tage)`
                    : `Stufe 3 (ab ${cfg.stufe3Tage} Tage)`}
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
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap hidden lg:table-cell">Verzugszinsen (€)</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Aktionen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {gefiltert.map((e) => (
                    <Fragment key={e.lieferung.id}>
                    <tr
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
                      <td className="px-4 py-3 text-right font-mono text-sm hidden lg:table-cell">
                        {e.tageUeberfaellig > 0 ? (
                          <span className="text-orange-700 font-semibold">
                            {berechneVerzugszinsen(e.betrag, e.tageUeberfaellig, cfg.verzugszinssatz).toLocaleString("de-DE", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        ) : (
                          <span className="text-gray-400">0,00</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setKiOpen({
                                kundeId: e.kunde.id,
                                stufe: e.mahnstufe,
                                kundeName: e.kunde.firma || e.kunde.name,
                                rechnungen: [{
                                  nr: e.rechnungNr ?? "",
                                  datum: typeof e.rechnungDatum === "string" ? e.rechnungDatum.slice(0, 10) : "",
                                  betrag: e.betrag,
                                  tageUeberfaellig: e.tageUeberfaellig,
                                }],
                              });
                              setKiResult(null); setKiError(null);
                            }}
                            className="px-2 py-1 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-medium transition-colors border border-blue-200"
                            title="KI-Brief generieren"
                          >
                            🤖 Brief
                          </button>
                          <button
                            onClick={() => druckeZahlungserinnerung(e)}
                            className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors border border-gray-200"
                            title="Zahlungserinnerung drucken"
                          >
                            Drucken
                          </button>
                          <button
                            onClick={() => {
                              const lid = e.lieferung.id;
                              setEmailState((prev) => ({
                                ...prev,
                                [lid]: {
                                  offen: !prev[lid]?.offen,
                                  empfaenger: prev[lid]?.offen
                                    ? (prev[lid]?.empfaenger ?? "")
                                    : (prev[lid]?.empfaenger || e.kunde.kontakte?.[0]?.wert || ""),
                                  loading: false, erfolg: "", fehler: "",
                                },
                              }));
                            }}
                            className="px-2 py-1 text-xs bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium transition-colors"
                            title="Mahnung per E-Mail senden"
                          >
                            E-Mail
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
                    {emailState[e.lieferung.id]?.offen && (
                      <tr className="bg-teal-50 border-b border-teal-100">
                        <td colSpan={10} className="px-4 py-3">
                          <div className="flex flex-wrap gap-2 items-center">
                            <span className="text-xs font-medium text-teal-800">Mahnung per E-Mail senden:</span>
                            <input
                              type="email"
                              value={emailState[e.lieferung.id]?.empfaenger ?? ""}
                              onChange={(ev) => setEmailState((prev) => ({ ...prev, [e.lieferung.id]: { ...prev[e.lieferung.id], empfaenger: ev.target.value } }))}
                              placeholder="empfaenger@example.com"
                              className="border border-teal-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-teal-500 w-56"
                            />
                            <button
                              disabled={emailState[e.lieferung.id]?.loading || !emailState[e.lieferung.id]?.empfaenger}
                              onClick={async () => {
                                const lid = e.lieferung.id;
                                setEmailState((prev) => ({ ...prev, [lid]: { ...prev[lid], loading: true, fehler: "", erfolg: "" } }));
                                try {
                                  const res = await fetch("/api/exporte/mahnung/mail", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ lieferungId: lid, mahnstufe: e.mahnstufe, empfaenger: emailState[lid]?.empfaenger }),
                                  });
                                  const data = await res.json() as { ok?: boolean; error?: string };
                                  if (data.ok) setEmailState((prev) => ({ ...prev, [lid]: { ...prev[lid], loading: false, erfolg: `Versendet an ${prev[lid]?.empfaenger}`, offen: false } }));
                                  else setEmailState((prev) => ({ ...prev, [lid]: { ...prev[lid], loading: false, fehler: data.error ?? "Versand fehlgeschlagen" } }));
                                } catch { setEmailState((prev) => ({ ...prev, [lid]: { ...prev[lid], loading: false, fehler: "Versand fehlgeschlagen" } })); }
                              }}
                              className="px-2 py-1 text-xs bg-teal-600 hover:bg-teal-700 text-white rounded font-medium disabled:opacity-50"
                            >
                              {emailState[e.lieferung.id]?.loading ? "Sendet…" : "Senden"}
                            </button>
                            <button onClick={() => setEmailState((prev) => ({ ...prev, [e.lieferung.id]: { ...prev[e.lieferung.id], offen: false } }))} className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50">Abbrechen</button>
                            {emailState[e.lieferung.id]?.fehler && <span className="text-xs text-red-600">{emailState[e.lieferung.id].fehler}</span>}
                          </div>
                        </td>
                      </tr>
                    )}
                    {emailState[e.lieferung.id]?.erfolg && !emailState[e.lieferung.id]?.offen && (
                      <tr className="bg-teal-50 border-b border-teal-100">
                        <td colSpan={10} className="px-4 py-2 text-xs text-teal-700">{emailState[e.lieferung.id].erfolg}</td>
                      </tr>
                    )}
                    </Fragment>
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
                      <td className="hidden md:table-cell" />
                      <td className="px-4 py-3 text-right font-mono font-bold text-orange-700 whitespace-nowrap hidden lg:table-cell">
                        {gefiltert
                          .reduce(
                            (s, e) =>
                              s + berechneVerzugszinsen(e.betrag, e.tageUeberfaellig, cfg.verzugszinssatz),
                            0
                          )
                          .toLocaleString("de-DE", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                      </td>
                      <td className="hidden md:table-cell" />
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
              Stufe 1: {cfg.stufe1Tage}–{cfg.stufe2Tage - 1} Tage überfällig
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-full bg-orange-100 border border-orange-300" />
              Stufe 2: {cfg.stufe2Tage}–{cfg.stufe3Tage - 1} Tage überfällig
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-full bg-red-100 border border-red-300" />
              Stufe 3: ab {cfg.stufe3Tage} Tage überfällig
            </span>
          </div>

          {/* SEPA XML Export */}
          <div className="mt-6 flex items-center gap-3 flex-wrap">
            <button
              onClick={exportiereSepa}
              disabled={sepaLoading || gefiltert.length === 0}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
              title="SEPA Credit Transfer XML (pain.001) für angezeigte Einträge herunterladen"
            >
              {sepaLoading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Exportiere…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  SEPA XML exportieren ({gefiltert.length})
                </>
              )}
            </button>
            <span className="text-xs text-gray-400">
              Exportiert alle angezeigten Einträge als SEPA pain.001 XML
              {stufeFilter !== "alle" && ` (Stufe ${stufeFilter} gefiltert)`}.
              Nur Kunden mit hinterlegter IBAN werden berücksichtigt.
            </span>
          </div>
          {sepaFehler && (
            <div className="mt-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {sepaFehler}
            </div>
          )}
        </>
      )}

      {/* KI-Brief Modal */}
      {kiOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setKiOpen(null)}>
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold">🤖 KI-Mahntext für {kiOpen.kundeName}</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Stufe {kiOpen.stufe} · {kiOpen.rechnungen.length} Rechnung(en)
                </p>
              </div>
              <button onClick={() => setKiOpen(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>

            {!kiResult && !kiError && !kiLoading && (
              <button
                onClick={async () => {
                  setKiLoading(true); setKiError(null);
                  try {
                    const mahngebuehr = kiOpen.stufe === 3 ? cfg.mahngebuehr3 : kiOpen.stufe === 2 ? cfg.mahngebuehr2 : cfg.mahngebuehr1;
                    const frist = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
                    const res = await fetch("/api/ki/mahnungstext", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        kundeId: kiOpen.kundeId, mahnstufe: kiOpen.stufe,
                        rechnungen: kiOpen.rechnungen,
                        mahngebuehr: kiOpen.stufe > 1 ? mahngebuehr : undefined,
                        frist,
                      }),
                    });
                    if (!res.ok) {
                      const err = await res.json().catch(() => ({}));
                      setKiError(err.error ?? "Generierung fehlgeschlagen");
                    } else {
                      setKiResult(await res.json());
                    }
                  } catch {
                    setKiError("Netzwerkfehler");
                  } finally {
                    setKiLoading(false);
                  }
                }}
                className="w-full bg-green-700 hover:bg-green-800 text-white px-4 py-3 rounded font-medium"
              >
                Brief generieren
              </button>
            )}

            {kiLoading && <div className="text-center text-gray-500 py-8">KI verfasst den Brief…</div>}
            {kiError && <div className="bg-red-50 border border-red-200 rounded p-3 text-red-700 text-sm">{kiError}</div>}

            {kiResult && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Betreff</label>
                  <input value={kiResult.betreff} onChange={e => setKiResult(r => r ? { ...r, betreff: e.target.value } : r)} className="w-full border rounded px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Anrede</label>
                  <input value={kiResult.anrede} onChange={e => setKiResult(r => r ? { ...r, anrede: e.target.value } : r)} className="w-full border rounded px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Text</label>
                  <textarea value={kiResult.text} onChange={e => setKiResult(r => r ? { ...r, text: e.target.value } : r)} rows={12} className="w-full border rounded px-3 py-2 text-sm font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Schlussformel</label>
                  <input value={kiResult.gruss} onChange={e => setKiResult(r => r ? { ...r, gruss: e.target.value } : r)} className="w-full border rounded px-3 py-2 text-sm" />
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <button
                    onClick={async () => {
                      const fullText = `${kiResult.anrede}\n\n${kiResult.text}\n\n${kiResult.gruss}`;
                      await navigator.clipboard.writeText(fullText);
                      alert("Text in Zwischenablage kopiert");
                    }}
                    className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded font-medium"
                  >
                    📋 Kopieren
                  </button>
                  <button onClick={() => setKiOpen(null)} className="px-4 py-2 text-sm bg-green-700 hover:bg-green-800 text-white rounded font-medium">
                    Schließen
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
