"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import DokumentFooter from "@/components/DokumentFooter";
import EmailVersandModal, { EmailKontakt } from "@/components/EmailVersandModal";
import { formatDatum, formatEuro } from "@/lib/utils";
import * as Sentry from "@sentry/nextjs";

interface Position {
  id: number;
  menge: number;
  verkaufspreis: number;
  rabattProzent: number;
  mwstSatz: number | null;
  notiz?: string | null;
  artikel: { id: number; name: string; einheit: string; mwstSatz: number | null };
}

interface Kontakt {
  typ: string;
  wert: string;
  label?: string | null;
  vorname?: string | null;
  nachname?: string | null;
}

interface Kunde {
  id: number;
  name: string;
  firma?: string | null;
  strasse?: string | null;
  plz?: string | null;
  ort?: string | null;
  kontakte: Kontakt[];
}

interface Lieferung {
  id: number;
  datum: string;
  status: string;
  notiz?: string | null;
  lieferscheinNr?: string | null;
  auftragsbestaetigungVersendetAm?: string | null;
  positionen: Position[];
  kunde: Kunde;
}

export default function AuftragsbestaetigungPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [lieferung, setLieferung] = useState<Lieferung | null>(null);
  const [firma, setFirma] = useState<Record<string, string>>({});
  const [footerData, setFooterData] = useState<Record<string, string>>({});
  const [logo, setLogo] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [canShare, setCanShare] = useState(false);
  const [shareMsg, setShareMsg] = useState("");
  const [mailSending, setMailSending] = useState(false);
  const [mailMsg, setMailMsg] = useState("");
  const [mailModalOffen, setMailModalOffen] = useState(false);
  const [mailFehler, setMailFehler] = useState("");

  useEffect(() => {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      setCanShare(true);
    }
  }, []);

  useEffect(() => {
    Promise.all([
      fetch(`/api/lieferungen/${id}`).then((r) => (r.ok ? r.json() : null)),
      fetch("/api/einstellungen?prefix=firma.").then((r) => (r.ok ? r.json() : {})),
      fetch("/api/einstellungen?prefix=system.logo").then((r) => (r.ok ? r.json() : {})),
      fetch("/api/einstellungen?prefix=dokument.footer").then((r) => (r.ok ? r.json() : {})),
    ])
      .then(([data, firmaData, logoData, ftrData]) => {
        setLieferung(data as Lieferung | null);
        setFirma((firmaData as Record<string, string>) ?? {});
        setFooterData((ftrData as Record<string, string>) ?? {});
        const ld = logoData as Record<string, string>;
        if (ld?.["system.logo"]) setLogo(ld["system.logo"]);
        setLoading(false);
      })
      .catch((err) => {
        Sentry.captureException(err);
        return setLoading(false);
      });
  }, [id]);

  async function handleMailSenden(empfaenger: string, cc: string) {
    setMailSending(true);
    setMailMsg("");
    setMailFehler("");
    try {
      const res = await fetch("/api/exporte/auftragsbestaetigung/mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lieferungId: Number(id), empfaenger, cc }),
      });
      const data = (await res.json()) as { ok?: boolean; empfaenger?: string; error?: string };
      if (data.ok) {
        setMailMsg(`Auftragsbestätigung an ${data.empfaenger ?? empfaenger} gesendet.`);
        setMailModalOffen(false);
        setLieferung((prev) =>
          prev ? { ...prev, auftragsbestaetigungVersendetAm: new Date().toISOString() } : prev,
        );
      } else {
        setMailFehler(data.error ?? "Fehler beim Versand.");
      }
    } catch (err) {
      Sentry.captureException(err);
      setMailFehler("Netzwerkfehler beim E-Mail-Versand.");
    } finally {
      setMailSending(false);
    }
  }

  async function handleTeilen() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const title = `Auftragsbestätigung ${lieferung?.lieferscheinNr?.trim() || lieferung?.id || ""}`;
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({ title, url });
        return;
      }
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setShareMsg("Link kopiert");
        setTimeout(() => setShareMsg(""), 2500);
      }
    } catch (err) {
      Sentry.captureException(err);
      // Benutzer hat Dialog abgebrochen
    }
  }

  if (loading) return <div className="p-8 text-gray-400">Lade…</div>;
  if (!lieferung) return <div className="p-8 text-red-500">Lieferung nicht gefunden.</div>;

  const auftragsNr = lieferung.lieferscheinNr?.trim() || String(lieferung.id);
  const hatRabatt = lieferung.positionen.some((p) => p.rabattProzent > 0);

  const mwstGruppen = new Map<number, number>();
  let nettoGesamt = 0;
  for (const p of lieferung.positionen) {
    const netto = p.menge * p.verkaufspreis * (1 - p.rabattProzent / 100);
    nettoGesamt += netto;
    const satz = p.mwstSatz ?? p.artikel.mwstSatz ?? 19;
    mwstGruppen.set(satz, (mwstGruppen.get(satz) ?? 0) + netto);
  }
  let mwstGesamt = 0;
  for (const [satz, basis] of mwstGruppen) mwstGesamt += basis * (satz / 100);
  const bruttoGesamt = nettoGesamt + mwstGesamt;

  const firmaName = firma["firma.firmenname"] ?? firma["firma.name"] ?? "";
  const firmaStrasse = firma["firma.strasse"] ?? "";
  const firmaPlz = firma["firma.plz"] ?? "";
  const firmaOrt = firma["firma.ort"] ?? "";
  const firmaTel = firma["firma.tel"] ?? firma["firma.telefon"] ?? "";
  const firmaEmail = firma["firma.email"] ?? "";
  const firmaAdresse = [firmaStrasse, [firmaPlz, firmaOrt].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");

  return (
    <>
      <style>{`
        @media print {
          @page { margin: 2cm; size: A4; }
          .print-hidden { display: none !important; }
          main { padding: 0 !important; max-width: 100% !important; }
          .auftragsbestaetigung-scroll-wrapper { overflow: visible !important; }
          [data-print-area] { min-height: 0 !important; padding: 0 !important; width: 100% !important; max-width: 100% !important; margin: 0 !important; }
        }
        body { font-family: Arial, sans-serif; }
      `}</style>

      {/* Sticky controls – hidden when printing */}
      <div className="print-hidden sticky top-0 z-20 flex items-center flex-wrap gap-1.5 p-2.5 bg-white/95 backdrop-blur border-b border-gray-200 shadow-sm">
        <button
          onClick={() => router.push(`/lieferungen/${id}`)}
          className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 rounded-lg transition-colors"
          title="Schließen – zur Lieferung"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        <button
          onClick={() => window.print()}
          className="p-2 bg-green-700 hover:bg-green-800 text-white rounded-lg transition-colors"
          title="Drucken"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
        </button>
        <a
          href={`/api/exporte/auftragsbestaetigung?lieferungId=${id}`}
          download={`Auftragsbestaetigung_${auftragsNr}.pdf`}
          className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 transition-colors text-sm"
          title="PDF herunterladen"
        >
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          <span className="hidden sm:inline">PDF</span>
        </a>
        <button
          onClick={handleTeilen}
          className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          title={canShare ? "Teilen" : "Link kopieren"}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
        </button>
        <button
          onClick={() => { setMailMsg(""); setMailFehler(""); setMailModalOffen(true); }}
          disabled={mailSending}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white rounded-lg transition-colors text-sm"
          title="Per E-Mail senden"
        >
          {mailSending
            ? <><svg className="w-5 h-5 animate-spin shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg><span className="hidden sm:inline">Sendet…</span></>
            : <><svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg><span className="hidden sm:inline">E-Mail</span></>
          }
        </button>
        {lieferung.auftragsbestaetigungVersendetAm && (
          <span
            className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-lg px-2 py-1 ml-1"
            title={`Auftragsbestätigung wurde per E-Mail versendet am ${formatDatum(lieferung.auftragsbestaetigungVersendetAm)}`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            Per E-Mail versendet ({formatDatum(lieferung.auftragsbestaetigungVersendetAm)})
          </span>
        )}
        {shareMsg && <span className="text-xs text-green-700 font-medium ml-1">{shareMsg}</span>}
        {mailMsg && (
          <span className={`text-xs font-medium ml-1 ${mailMsg.includes("gesendet") ? "text-green-700" : "text-red-600"}`}>
            {mailMsg}
          </span>
        )}
      </div>

      <EmailVersandModal
        open={mailModalOffen}
        onClose={() => setMailModalOffen(false)}
        title={`Auftragsbestätigung ${auftragsNr} versenden`}
        kundenname={lieferung.kunde.firma ?? lieferung.kunde.name}
        emailKontakte={(lieferung.kunde.kontakte ?? []).filter((k) => k.typ === "email") as EmailKontakt[]}
        docType="sonstige"
        loading={mailSending}
        fehler={mailFehler || undefined}
        onSend={handleMailSenden}
      />

      {/* Fester (nicht nur maximaler) Wrapper um [data-print-area] mit eigenem overflow-x:auto —
          gleiches Muster wie bei /lieferungen/[id]/rechnung: das Dokument behält IMMER seine
          volle A4-Breite, auf dem Handy scrollt man es horizontal statt dass Kopfzeile und
          Inhalt zusammengequetscht werden. */}
      <div className="auftragsbestaetigung-scroll-wrapper" style={{ overflowX: "auto" }}>
      <div
        data-print-area
        style={{
          fontFamily: "Arial, Helvetica, sans-serif",
          fontSize: "11pt",
          color: "#000",
          width: "210mm",
          margin: "0 auto",
          padding: "1.5cm 1cm",
          background: "#fff",
        }}
      >
        {/* Briefkopf */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
          <div>
            {logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="Logo" style={{ height: "64px", marginBottom: "8px", display: "block" }} />
            )}
            {firmaName && (
              <div style={{ fontWeight: "bold", fontSize: "13pt", marginBottom: "2px" }}>{firmaName}</div>
            )}
            {firmaAdresse && <div style={{ fontSize: "10pt" }}>{firmaAdresse}</div>}
            {firmaTel && <div style={{ fontSize: "10pt" }}>Tel: {firmaTel}</div>}
            {firmaEmail && <div style={{ fontSize: "10pt" }}>{firmaEmail}</div>}
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "20pt", fontWeight: "bold", marginBottom: "6px" }}>
              AUFTRAGSBESTÄTIGUNG
            </div>
            <table style={{ fontSize: "10pt", borderCollapse: "collapse", marginLeft: "auto" }}>
              <tbody>
                <tr>
                  <td style={{ paddingRight: "8px", color: "#555" }}>Auftragsnummer:</td>
                  <td style={{ fontWeight: "bold", fontFamily: "monospace" }}>{auftragsNr}</td>
                </tr>
                <tr>
                  <td style={{ paddingRight: "8px", color: "#555" }}>Datum:</td>
                  <td>{formatDatum(lieferung.datum)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <hr style={{ borderTop: "2px solid #222", marginBottom: "24px" }} />

        {/* Empfängeranschrift */}
        <div style={{ marginBottom: "32px" }}>
          <div style={{ fontSize: "8pt", color: "#888", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {firmaAdresse}
          </div>
          <div style={{ fontWeight: "bold", fontSize: "12pt" }}>{lieferung.kunde.name}</div>
          {lieferung.kunde.firma && <div style={{ fontSize: "10pt" }}>{lieferung.kunde.firma}</div>}
          {lieferung.kunde.strasse && <div style={{ fontSize: "10pt" }}>{lieferung.kunde.strasse}</div>}
          {(lieferung.kunde.plz || lieferung.kunde.ort) && (
            <div style={{ fontSize: "10pt" }}>
              {[lieferung.kunde.plz, lieferung.kunde.ort].filter(Boolean).join(" ")}
            </div>
          )}
        </div>

        <div style={{ fontSize: "10pt", marginBottom: "24px" }}>
          Sehr geehrte Damen und Herren,<br />
          vielen Dank für Ihren Auftrag. Wir bestätigen Ihnen die folgenden Positionen:
        </div>

        {/* Positionen */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "20px", fontSize: "10pt" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #333", backgroundColor: "#f5f5f5" }}>
              <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: "600" }}>Artikel</th>
              <th style={{ textAlign: "right", padding: "6px 8px", fontWeight: "600" }}>Menge</th>
              <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: "600" }}>Einheit</th>
              <th style={{ textAlign: "right", padding: "6px 8px", fontWeight: "600" }}>Einzelpreis</th>
              {hatRabatt && <th style={{ textAlign: "right", padding: "6px 8px", fontWeight: "600" }}>Rabatt</th>}
              <th style={{ textAlign: "right", padding: "6px 8px", fontWeight: "600" }}>Gesamt</th>
            </tr>
          </thead>
          <tbody>
            {lieferung.positionen.map((pos, i) => {
              const netto = pos.menge * pos.verkaufspreis * (1 - pos.rabattProzent / 100);
              return (
                <tr
                  key={pos.id}
                  style={{ borderBottom: "1px solid #ddd", backgroundColor: i % 2 === 0 ? "#fff" : "#fafafa" }}
                >
                  <td style={{ padding: "6px 8px" }}>
                    {pos.artikel.name}
                    {pos.notiz && <div style={{ fontSize: "9pt", color: "#666" }}>{pos.notiz}</div>}
                  </td>
                  <td style={{ padding: "6px 8px", textAlign: "right", fontFamily: "monospace" }}>
                    {pos.menge.toLocaleString("de-DE")}
                  </td>
                  <td style={{ padding: "6px 8px" }}>{pos.artikel.einheit}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right", fontFamily: "monospace" }}>
                    {formatEuro(pos.verkaufspreis)}
                  </td>
                  {hatRabatt && (
                    <td style={{ padding: "6px 8px", textAlign: "right", fontFamily: "monospace" }}>
                      {pos.rabattProzent > 0 ? `${pos.rabattProzent} %` : "—"}
                    </td>
                  )}
                  <td style={{ padding: "6px 8px", textAlign: "right", fontFamily: "monospace", fontWeight: "500" }}>
                    {formatEuro(netto)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Summen */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "32px" }}>
          <table style={{ fontSize: "10pt", borderCollapse: "collapse", minWidth: "240px" }}>
            <tbody>
              <tr>
                <td style={{ padding: "4px 10px", color: "#444" }}>Nettobetrag:</td>
                <td style={{ padding: "4px 10px", textAlign: "right", fontFamily: "monospace" }}>
                  {formatEuro(nettoGesamt)}
                </td>
              </tr>
              {Array.from(mwstGruppen.entries())
                .sort(([a], [b]) => a - b)
                .map(([satz, basis]) => (
                  <tr key={satz}>
                    <td style={{ padding: "4px 10px", color: "#444" }}>MwSt {satz} %:</td>
                    <td style={{ padding: "4px 10px", textAlign: "right", fontFamily: "monospace" }}>
                      {formatEuro(basis * (satz / 100))}
                    </td>
                  </tr>
                ))}
              <tr style={{ borderTop: "2px solid #333" }}>
                <td style={{ padding: "6px 10px", fontWeight: "bold", fontSize: "12pt" }}>Auftragssumme:</td>
                <td style={{ padding: "6px 10px", textAlign: "right", fontFamily: "monospace", fontWeight: "bold", fontSize: "12pt" }}>
                  {formatEuro(bruttoGesamt)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Notiz */}
        {lieferung.notiz && (
          <div
            style={{
              marginBottom: "32px",
              padding: "12px 16px",
              backgroundColor: "#f9f9f9",
              border: "1px solid #ddd",
              borderRadius: "4px",
              fontSize: "10pt",
            }}
          >
            <div style={{ fontWeight: "bold", marginBottom: "4px" }}>Hinweis:</div>
            {lieferung.notiz}
          </div>
        )}

        {/* Schlusstext */}
        <div style={{ fontSize: "9pt", color: "#555", marginTop: "32px", marginBottom: "12px" }}>
          <p style={{ marginBottom: "4px" }}>Die Rechnungsstellung erfolgt nach erfolgter Lieferung.</p>
          <p style={{ marginBottom: "4px" }}>
            Alle Preise verstehen sich netto zuzüglich der ausgewiesenen Mehrwertsteuer.
          </p>
          <p style={{ marginTop: "16px", marginBottom: "4px" }}>Mit freundlichen Grüßen</p>
          <p style={{ fontWeight: "bold" }}>{firmaName}</p>
        </div>

        <DokumentFooter firmaData={firma} footerConfig={footerData} marginTop="16px" />
      </div>
      </div>
    </>
  );
}
