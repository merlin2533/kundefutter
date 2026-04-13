"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { formatEuro, formatDatum, addTage } from "@/lib/utils";
import DriveUploadButton from "@/components/DriveUploadButton";
import { erzeugeGiroCodeDataUrl } from "@/lib/girocode";
import DokumentFooter from "@/components/DokumentFooter";

interface ArtikelInfo {
  name: string;
  einheit: string;
  mwstSatz: number;
}

interface Position {
  id: number;
  menge: number;
  verkaufspreis: number;
  einkaufspreis: number;
  rabattProzent?: number | null;
  artikel: ArtikelInfo;
}

interface Kunde {
  name: string;
  firma?: string | null;
  strasse?: string | null;
  plz?: string | null;
  ort?: string | null;
}

interface Lieferung {
  id: number;
  datum: string;
  rechnungNr?: string | null;
  rechnungDatum?: string | null;
  zahlungsziel?: number | null;
  bezahltAm?: string | null;
  kundeId: number;
  kunde: Kunde;
  positionen: Position[];
}

export default function RechnungPrintPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [lieferung, setLieferung] = useState<Lieferung | null>(null);
  const [firmaData, setFirmaData] = useState<Record<string, string>>({});
  const [footerData, setFooterData] = useState<Record<string, string>>({});
  const [logo, setLogo] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [giroCode, setGiroCode] = useState<string>("");
  const [canShare, setCanShare] = useState(false);
  const [shareMsg, setShareMsg] = useState("");
  const [mailSending, setMailSending] = useState(false);
  const [mailMsg, setMailMsg] = useState("");

  function downloadMitZugferd() {
    // PDF herunterladen
    const a = document.createElement("a");
    a.href = `/api/exporte/rechnung?lieferungId=${id}`;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // ZUGFeRD XML kurz verzögert herunterladen
    setTimeout(() => {
      const b = document.createElement("a");
      b.href = `/api/exporte/zugferd?lieferungId=${id}`;
      b.download = "";
      document.body.appendChild(b);
      b.click();
      document.body.removeChild(b);
    }, 600);
  }

  async function loadLieferung(): Promise<Lieferung | null> {
    const res = await fetch(`/api/lieferungen/${id}`);
    if (!res.ok) {
      setError("Lieferung nicht gefunden.");
      return null;
    }
    return res.json();
  }

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        let data = await loadLieferung();
        if (!data) { setLoading(false); return; }

        // If no invoice number yet, create one
        if (!data.rechnungNr) {
          const patchRes = await fetch(`/api/lieferungen/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ aktion: "rechnung_erstellen" }),
          });
          if (patchRes.ok) {
            data = await patchRes.json();
          } else {
            const errBody = await patchRes.json().catch(() => ({}));
            // If it failed because one already exists, reload to get current data
            if ((errBody as { error?: string }).error?.includes("bereits")) {
              data = await loadLieferung();
              if (!data) { setLoading(false); return; }
            } else {
              setError((errBody as { error?: string }).error ?? "Fehler beim Erstellen der Rechnungsnummer.");
            }
          }
        }

        setLieferung(data);
      } catch {
        setError("Fehler beim Laden der Lieferung.");
      } finally {
        setLoading(false);
      }
    }

    init(); // eslint-disable-line react-hooks/exhaustive-deps

    Promise.all([
      fetch("/api/einstellungen?prefix=firma.").then((r) => r.json()),
      fetch("/api/einstellungen?prefix=system.logo").then((r) => r.json()),
      fetch("/api/einstellungen?prefix=dokument.footer").then((r) => r.json()),
    ]).then(([fd, ld, ftr]) => {
      setFirmaData(fd);
      if (ld["system.logo"]) setLogo(ld["system.logo"]);
      setFooterData(ftr);
    }).catch(() => {});

    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      setCanShare(true);
    }
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // GiroCode erzeugen, sobald Firmen- und Rechnungsdaten vorliegen
  useEffect(() => {
    if (!lieferung) { setGiroCode(""); return; }
    const iban = firmaData["firma.iban"] ?? "";
    const bic = firmaData["firma.bic"] ?? "";
    const empfaenger =
      firmaData["firma.firmenname"] ?? firmaData["firma.name"] ?? "";
    if (!iban || !empfaenger) { setGiroCode(""); return; }

    const netto = lieferung.positionen.reduce(
      (s, p) => s + p.menge * p.verkaufspreis * (1 - (p.rabattProzent ?? 0) / 100),
      0,
    );
    const mwst = lieferung.positionen.reduce(
      (s, p) => s + p.menge * p.verkaufspreis * (1 - (p.rabattProzent ?? 0) / 100) * ((p.artikel.mwstSatz ?? 19) / 100),
      0,
    );
    const brutto = netto + mwst;
    const verwendung = `Rechnung ${lieferung.rechnungNr ?? `LS-${lieferung.id}`}`;

    let cancelled = false;
    erzeugeGiroCodeDataUrl({ empfaenger, iban, bic, betrag: brutto, verwendungszweck: verwendung })
      .then((url) => { if (!cancelled && url) setGiroCode(url); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [lieferung, firmaData]);

  async function handleTeilen() {
    if (!lieferung) return;
    const url = typeof window !== "undefined" ? window.location.href : "";
    const title = `Rechnung ${lieferung.rechnungNr ?? `LS-${lieferung.id}`}`;
    const text = `Rechnung ${lieferung.rechnungNr ?? ""} – ${lieferung.kunde.firma ?? lieferung.kunde.name}`;
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({ title, text, url });
        return;
      }
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setShareMsg("Link kopiert");
        setTimeout(() => setShareMsg(""), 2500);
      }
    } catch {
      // Benutzer hat Dialog abgebrochen – ignorieren
    }
  }

  async function handleMailSenden() {
    if (!lieferung) return;
    setMailSending(true);
    setMailMsg("");
    try {
      const res = await fetch("/api/exporte/rechnung/mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lieferungId: Number(id) }),
      });
      const data = await res.json() as { ok?: boolean; empfaenger?: string; error?: string };
      if (data.ok) {
        setMailMsg(`Rechnung an ${data.empfaenger} gesendet.`);
      } else {
        setMailMsg(data.error ?? "Fehler beim Versand.");
      }
    } catch {
      setMailMsg("Netzwerkfehler beim E-Mail-Versand.");
    } finally {
      setMailSending(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-gray-500 text-sm">
        Rechnung wird vorbereitet…
      </div>
    );
  }

  if (!lieferung) {
    return (
      <div className="p-8">
        <p className="text-red-600 mb-4">{error || "Lieferung nicht gefunden."}</p>
        <Link href="/lieferungen" className="text-green-700 hover:underline text-sm">
          ← Zurück zu Lieferungen
        </Link>
      </div>
    );
  }

  // ---- calculations ----
  const zahlungszielTage = lieferung.zahlungsziel ?? 30;
  const basisDatum = lieferung.rechnungDatum
    ? new Date(lieferung.rechnungDatum)
    : new Date(lieferung.datum);
  const faelligkeitsDatum = addTage(basisDatum, zahlungszielTage);

  // Per-position netto
  const positionenMitNetto = lieferung.positionen.map((p) => ({
    ...p,
    netto: p.menge * p.verkaufspreis * (1 - (p.rabattProzent ?? 0) / 100),
  }));

  const hatRabatt = positionenMitNetto.some((p) => (p.rabattProzent ?? 0) > 0);

  const nettobetrag = positionenMitNetto.reduce((s, p) => s + p.netto, 0);

  // MwSt grouping
  const mwstGruppen = positionenMitNetto.reduce<Record<number, number>>((acc, p) => {
    const satz = p.artikel.mwstSatz ?? 19;
    acc[satz] = (acc[satz] ?? 0) + p.netto * (satz / 100);
    return acc;
  }, {});

  const mwstGesamt = Object.values(mwstGruppen).reduce((s, v) => s + v, 0);
  const bruttobetrag = nettobetrag + mwstGesamt;

  const rechnungNr = lieferung.rechnungNr ?? `LS-${lieferung.id}`;
  const rechnungsDatumStr = lieferung.rechnungDatum
    ? formatDatum(lieferung.rechnungDatum)
    : formatDatum(lieferung.datum);

  const firmenname = firmaData["firma.name"] ?? firmaData["firma.firmenname"] ?? "";
  const firmaAdresse = firmaData["firma.strasse"] ?? firmaData["firma.adresse"] ?? "";
  const firmaPlz = firmaData["firma.plz"] ?? "";
  const firmaOrt = firmaData["firma.ort"] ?? "";
  const firmaTel = firmaData["firma.telefon"] ?? firmaData["firma.tel"] ?? "";
  const firmaEmail = firmaData["firma.email"] ?? "";
  const firmaSteuernr = firmaData["firma.steuernummer"] ?? firmaData["firma.steuernr"] ?? "";
  const firmaUstId = firmaData["firma.ustIdNr"] ?? "";
  const firmaOeko = firmaData["firma.oekoNummer"] ?? "";
  const firmaIban = firmaData["firma.iban"] ?? "";
  const firmaBic = firmaData["firma.bic"] ?? "";
  const firmaBankname = firmaData["firma.bank"] ?? firmaData["firma.bankname"] ?? "";


  return (
    <>
      <style>{`
        @media print {
          @page {
            margin: 2cm;
            size: A4;
          }
          .print-hidden { display: none !important; }
        }
      `}</style>

      {/* Screen-only controls – sticky so user always has a way out */}
      <div className="print-hidden sticky top-0 z-20 flex items-center flex-wrap gap-1.5 p-2.5 bg-white/95 backdrop-blur border-b border-gray-200 shadow-sm no-print">
        <button
          onClick={() => router.push(`/lieferungen/${id}`)}
          className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 rounded-lg transition-colors"
          title="Schließen – zurück zur Lieferung"
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
        {lieferung?.rechnungNr && (
          <button
            onClick={downloadMitZugferd}
            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 transition-colors"
            title="PDF + ZUGFeRD XML herunterladen"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          </button>
        )}
        <button
          onClick={handleTeilen}
          className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          title={canShare ? "Rechnung teilen" : "Link kopieren"}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
        </button>
        {lieferung?.rechnungNr && (
          <button
            onClick={handleMailSenden}
            disabled={mailSending}
            className="p-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white rounded-lg transition-colors"
            title="Per E-Mail senden"
          >
            {mailSending
              ? <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            }
          </button>
        )}
        {lieferung && (
          <DriveUploadButton
            kundeId={lieferung.kunde ? (lieferung as unknown as { kundeId: number }).kundeId ?? 0 : 0}
            typ="rechnung"
            dateiName={`Rechnung_${lieferung.rechnungNr ?? `LS-${lieferung.id}`}.pdf`}
            getInhalt={async () => {
              try {
                const { default: html2canvas } = await import("html2canvas");
                const { jsPDF } = await import("jspdf");
                const element = document.querySelector<HTMLElement>("[data-print-area]");
                if (!element) return null;
                const canvas = await html2canvas(element, { scale: 2, useCORS: true });
                const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
                const imgData = canvas.toDataURL("image/png");
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
                pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
                return pdf.output("datauristring").split(",")[1];
              } catch {
                return null;
              }
            }}
          />
        )}
        {shareMsg && (
          <span className="text-xs text-green-700 font-medium ml-1">{shareMsg}</span>
        )}
        {mailMsg && (
          <span className={`text-xs font-medium ml-1 ${mailMsg.includes("gesendet") ? "text-green-700" : "text-red-600"}`}>
            {mailMsg}
          </span>
        )}
        {error && (
          <span className="text-sm text-red-600 ml-1">{error}</span>
        )}
      </div>

      {/* Rechnung document */}
      <div
        data-print-area
        style={{
          fontFamily: "Arial, Helvetica, sans-serif",
          fontSize: "11pt",
          color: "#000",
          maxWidth: "210mm",
          minHeight: "277mm",
          margin: "0 auto",
          padding: "1.5cm 1cm",
          background: "#fff",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Briefkopf */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap" }}>
          <div>
            {logo && (
              <img
                src={logo}
                alt="Logo"
                style={{ height: "64px", marginBottom: "8px", display: "block" }}
              />
            )}
            {firmenname && (
              <div style={{ fontWeight: "bold", fontSize: "13pt", marginBottom: "2px" }}>
                {firmenname}
              </div>
            )}
            {firmaAdresse && <div style={{ fontSize: "10pt" }}>{firmaAdresse}</div>}
            {(firmaPlz || firmaOrt) && (
              <div style={{ fontSize: "10pt" }}>
                {[firmaPlz, firmaOrt].filter(Boolean).join(" ")}
              </div>
            )}
            {firmaTel && <div style={{ fontSize: "10pt", marginBottom: "8px" }}>Tel: {firmaTel}</div>}
            {firmaEmail && <div style={{ fontSize: "10pt" }}>E-Mail: {firmaEmail}</div>}
            {firmaSteuernr && (
              <div style={{ fontSize: "10pt" }}>Steuernr.: {firmaSteuernr}</div>
            )}
          </div>

          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "20pt", fontWeight: "bold", marginBottom: "6px" }}>
              Rechnung
            </div>
            <table style={{ fontSize: "10pt", borderCollapse: "collapse", marginLeft: "auto" }}>
              <tbody>
                <tr>
                  <td style={{ paddingRight: "8px", color: "#555" }}>Rechnungsnummer:</td>
                  <td style={{ fontWeight: "bold", fontFamily: "monospace" }}>{rechnungNr}</td>
                </tr>
                <tr>
                  <td style={{ paddingRight: "8px", color: "#555" }}>Rechnungsdatum:</td>
                  <td>{rechnungsDatumStr}</td>
                </tr>
                <tr>
                  <td style={{ paddingRight: "8px", color: "#555" }}>Fällig am:</td>
                  <td style={{ fontWeight: "bold" }}>{formatDatum(faelligkeitsDatum)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          {/* Trennlinie nach beiden Spalten */}
          <div style={{ flex: "0 0 100%", borderTop: "2px solid #222", marginTop: "20px", marginBottom: "24px" }} />
        </div>

        {/* Empfänger */}
        <div style={{ marginBottom: "48px" }}>
          <div style={{ fontSize: "8pt", color: "#888", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Rechnungsempfänger
          </div>
          <div style={{ fontWeight: "bold", fontSize: "12pt" }}>
            {lieferung.kunde.firma
              ? lieferung.kunde.firma
              : lieferung.kunde.name}
          </div>
          {lieferung.kunde.firma && (
            <div style={{ fontSize: "10pt" }}>{lieferung.kunde.name}</div>
          )}
          {lieferung.kunde.strasse && (
            <div style={{ fontSize: "10pt" }}>{lieferung.kunde.strasse}</div>
          )}
          {(lieferung.kunde.plz || lieferung.kunde.ort) && (
            <div style={{ fontSize: "10pt" }}>
              {[lieferung.kunde.plz, lieferung.kunde.ort].filter(Boolean).join(" ")}
            </div>
          )}
        </div>

        {/* Betreff */}
        <div style={{ marginBottom: "20px", fontSize: "11pt" }}>
          <strong>Betreff: Rechnung {rechnungNr}</strong>
        </div>

        {/* Positionen */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "20px", fontSize: "10pt" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #333", backgroundColor: "#f5f5f5" }}>
              <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: "600" }}>Pos.</th>
              <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: "600" }}>Artikel</th>
              <th style={{ textAlign: "right", padding: "6px 8px", fontWeight: "600" }}>Menge</th>
              <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: "600" }}>Einheit</th>
              <th style={{ textAlign: "right", padding: "6px 8px", fontWeight: "600" }}>Einzelpreis</th>
              {hatRabatt && <th style={{ textAlign: "right", padding: "6px 8px", fontWeight: "600" }}>Rabatt %</th>}
              <th style={{ textAlign: "right", padding: "6px 8px", fontWeight: "600" }}>Gesamt</th>
            </tr>
          </thead>
          <tbody>
            {positionenMitNetto.map((p, idx) => (
              <tr
                key={p.id}
                style={{
                  borderBottom: "1px solid #ddd",
                  backgroundColor: idx % 2 === 0 ? "#fff" : "#fafafa",
                }}
              >
                <td style={{ padding: "6px 8px", verticalAlign: "top" }}>{idx + 1}</td>
                <td style={{ padding: "6px 8px", verticalAlign: "top" }}>
                  <div>{p.artikel.name}</div>
                  <div style={{ fontSize: "9pt", color: "#666" }}>
                    MwSt {p.artikel.mwstSatz ?? 19} %
                  </div>
                </td>
                <td style={{ padding: "6px 8px", verticalAlign: "top", textAlign: "right", fontFamily: "monospace" }}>
                  {p.menge}
                </td>
                <td style={{ padding: "6px 8px", verticalAlign: "top" }}>{p.artikel.einheit}</td>
                <td style={{ padding: "6px 8px", verticalAlign: "top", textAlign: "right", fontFamily: "monospace" }}>
                  {formatEuro(p.verkaufspreis)}
                </td>
                {hatRabatt && (
                  <td style={{ padding: "6px 8px", verticalAlign: "top", textAlign: "right" }}>
                    {(p.rabattProzent ?? 0) > 0 ? `${p.rabattProzent} %` : ""}
                  </td>
                )}
                <td style={{ padding: "6px 8px", verticalAlign: "top", textAlign: "right", fontFamily: "monospace" }}>
                  {formatEuro(p.netto)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Betragsblock */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "32px" }}>
          <table style={{ fontSize: "10pt", borderCollapse: "collapse", minWidth: "260px" }}>
            <tbody>
              <tr>
                <td style={{ padding: "4px 10px", color: "#444" }}>Nettobetrag:</td>
                <td style={{ padding: "4px 10px", textAlign: "right", fontFamily: "monospace" }}>
                  {formatEuro(nettobetrag)}
                </td>
              </tr>
              {Object.entries(mwstGruppen)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([satz, betrag]) => (
                  <tr key={satz}>
                    <td style={{ padding: "4px 10px", color: "#444" }}>
                      MwSt {satz} %:
                    </td>
                    <td style={{ padding: "4px 10px", textAlign: "right", fontFamily: "monospace" }}>
                      {formatEuro(betrag)}
                    </td>
                  </tr>
                ))}
              <tr style={{ borderTop: "2px solid #333" }}>
                <td style={{ padding: "6px 10px", fontWeight: "bold", fontSize: "12pt" }}>
                  Bruttobetrag:
                </td>
                <td style={{ padding: "6px 10px", textAlign: "right", fontFamily: "monospace", fontWeight: "bold", fontSize: "12pt" }}>
                  {formatEuro(bruttobetrag)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Zahlungsinfo */}
        <div
          style={{
            backgroundColor: "#f9f9f9",
            border: "1px solid #ddd",
            borderRadius: "4px",
            padding: "12px 16px",
            marginBottom: "32px",
            fontSize: "10pt",
            display: "flex",
            gap: "16px",
            alignItems: "flex-start",
            justifyContent: "space-between",
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: "bold", marginBottom: "6px" }}>Zahlungsinformationen</div>
            <div style={{ marginBottom: "4px" }}>
              Bitte überweisen Sie den Betrag von{" "}
              <strong>{formatEuro(bruttobetrag)}</strong> bis zum{" "}
              <strong>{formatDatum(faelligkeitsDatum)}</strong> unter Angabe der
              Rechnungsnummer <strong>{rechnungNr}</strong>.
            </div>
            {(firmaIban || firmaBic || firmaBankname) && (
              <div style={{ marginTop: "8px", color: "#333" }}>
                {firmaBankname && <div>Bank: {firmaBankname}</div>}
                <div style={{ marginTop: "4px" }}>
                  {firmaIban && <span>IBAN: {firmaIban}</span>}
                  {firmaBic && <span style={{ marginLeft: "16px" }}>BIC: {firmaBic}</span>}
                </div>
              </div>
            )}
          </div>
          {giroCode && (
            <div style={{ textAlign: "center", flexShrink: 0 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={giroCode}
                alt="GiroCode – per Banking-App scannen"
                style={{ width: "110px", height: "110px", display: "block" }}
              />
              <div style={{ fontSize: "8pt", color: "#666", marginTop: "2px" }}>
                Scan &amp; Pay
              </div>
            </div>
          )}
        </div>

        {/* Footer – 3 Spalten */}
        <DokumentFooter firmaData={firmaData} footerConfig={footerData} marginTop="auto" />
      </div>
    </>
  );
}
