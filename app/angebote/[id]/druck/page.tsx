"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import DriveUploadButton from "@/components/DriveUploadButton";
import DokumentFooter from "@/components/DokumentFooter";

interface ArtikelInfo {
  id: number;
  name: string;
  einheit: string;
  mwstSatz: number;
}

interface AngebotPosition {
  id: number;
  artikelId: number;
  menge: number;
  preis: number;
  rabatt: number;
  einheit: string;
  notiz: string | null;
  artikel: ArtikelInfo;
}

interface Angebot {
  id: number;
  nummer: string;
  datum: string;
  gueltigBis: string | null;
  status: string;
  notiz: string | null;
  kunde: {
    id: number;
    name: string;
    firma: string | null;
    strasse: string | null;
    plz: string | null;
    ort: string | null;
    land: string;
  };
  positionen: AngebotPosition[];
}

function fmt(n: number): string {
  return n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

function fmtDatum(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("de-DE");
}

export default function AngebotDruckPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();

  const [angebot, setAngebot] = useState<Angebot | null>(null);
  const [firma, setFirma] = useState<Record<string, string>>({});
  const [footerData, setFooterData] = useState<Record<string, string>>({});
  const [logo, setLogo] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [canShare, setCanShare] = useState(false);
  const [shareMsg, setShareMsg] = useState("");

  useEffect(() => {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      setCanShare(true);
    }
  }, []);

  useEffect(() => {
    Promise.all([
      fetch(`/api/angebote/${id}`).then((r) => r.json()),
      fetch("/api/einstellungen?prefix=firma.").then((r) => r.json()),
      fetch("/api/einstellungen?prefix=system.logo").then((r) => r.json()),
      fetch("/api/einstellungen?prefix=dokument.footer").then((r) => r.json()),
    ])
      .then(([ang, firmaData, logoData, ftrData]) => {
        setAngebot(ang);
        setFirma(firmaData ?? {});
        setFooterData(ftrData ?? {});
        if (logoData?.["system.logo"]) setLogo(logoData["system.logo"]);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  async function handleTeilen() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const title = `Angebot ${angebot?.nummer ?? ""}`;
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
    } catch {
      // Benutzer hat Dialog abgebrochen
    }
  }

  if (loading) {
    return <div className="p-8 text-gray-400">Lade…</div>;
  }

  if (!angebot) {
    return <div className="p-8 text-red-500">Angebot nicht gefunden.</div>;
  }

  const gesamtNetto = angebot.positionen.reduce((sum, pos) => {
    return sum + pos.menge * pos.preis * (1 - pos.rabatt / 100);
  }, 0);

  // Group MwSt
  const mwstMap: Record<number, number> = {};
  for (const pos of angebot.positionen) {
    const netto = pos.menge * pos.preis * (1 - pos.rabatt / 100);
    const satz = pos.artikel.mwstSatz;
    mwstMap[satz] = (mwstMap[satz] ?? 0) + netto * (satz / 100);
  }
  const gesamtMwst = Object.values(mwstMap).reduce((a, b) => a + b, 0);
  const gesamtBrutto = gesamtNetto + gesamtMwst;

  const firmaName = firma["firma.firmenname"] ?? firma["firma.name"] ?? "";
  const firmaStrasse = firma["firma.strasse"] ?? "";
  const firmaPlz = firma["firma.plz"] ?? "";
  const firmaOrt = firma["firma.ort"] ?? "";
  const firmaTel = firma["firma.tel"] ?? firma["firma.telefon"] ?? "";
  const firmaEmail = firma["firma.email"] ?? "";
  const firmaSteuernr = firma["firma.steuernummer"] ?? "";
  const firmaUstId = firma["firma.ustIdNr"] ?? "";
  const firmaOeko = firma["firma.oekoNummer"] ?? "";
  const firmaIban = firma["firma.iban"] ?? "";
  const firmaBic = firma["firma.bic"] ?? "";
  const firmaBankname = firma["firma.bank"] ?? "";
  const firmaAdresse = [firmaStrasse, [firmaPlz, firmaOrt].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");



  return (
    <>
      <style>{`
        @media print {
          @page { margin: 2cm; size: A4; }
          .print-hidden { display: none !important; }
        }
        body { font-family: Arial, sans-serif; }
      `}</style>

      {/* Sticky controls – hidden when printing */}
      <div className="print-hidden sticky top-0 z-20 flex items-center flex-wrap gap-1.5 p-2.5 bg-white/95 backdrop-blur border-b border-gray-200 shadow-sm">
        <button
          onClick={() => router.push(`/angebote/${id}`)}
          className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 rounded-lg transition-colors"
          title="Schließen – zurück zum Angebot"
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
        <button
          onClick={handleTeilen}
          className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          title={canShare ? "Angebot teilen" : "Link kopieren"}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
        </button>
        {shareMsg && (
          <span className="text-xs text-green-700 font-medium ml-1">{shareMsg}</span>
        )}
        <DriveUploadButton
          kundeId={angebot.kunde.id}
          typ="angebot"
          dateiName={`Angebot_${angebot.nummer}.pdf`}
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
      </div>

      <div
        data-print-area
        style={{
          fontFamily: "Arial, Helvetica, sans-serif",
          fontSize: "11pt",
          color: "#000",
          maxWidth: "210mm",
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
              <img
                src={logo}
                alt="Logo"
                style={{ height: "64px", marginBottom: "8px", display: "block" }}
              />
            )}
            {firmaName && (
              <div style={{ fontWeight: "bold", fontSize: "13pt", marginBottom: "2px" }}>
                {firmaName}
              </div>
            )}
            {firmaAdresse && <div style={{ fontSize: "10pt" }}>{firmaAdresse}</div>}
            {firmaTel && <div style={{ fontSize: "10pt" }}>Tel: {firmaTel}</div>}
            {firmaEmail && <div style={{ fontSize: "10pt" }}>{firmaEmail}</div>}
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "20pt", fontWeight: "bold", marginBottom: "6px" }}>
              ANGEBOT
            </div>
            <table style={{ fontSize: "10pt", borderCollapse: "collapse", marginLeft: "auto" }}>
              <tbody>
                <tr>
                  <td style={{ paddingRight: "8px", color: "#555" }}>Angebotsnr.:</td>
                  <td style={{ fontWeight: "bold", fontFamily: "monospace" }}>{angebot.nummer}</td>
                </tr>
                <tr>
                  <td style={{ paddingRight: "8px", color: "#555" }}>Datum:</td>
                  <td>{fmtDatum(angebot.datum)}</td>
                </tr>
                <tr>
                  <td style={{ paddingRight: "8px", color: "#555" }}>Gültig bis:</td>
                  <td style={{ fontWeight: "bold" }}>{fmtDatum(angebot.gueltigBis)}</td>
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
          <div style={{ fontWeight: "bold", fontSize: "12pt" }}>{angebot.kunde.name}</div>
          {angebot.kunde.firma && <div style={{ fontSize: "10pt" }}>{angebot.kunde.firma}</div>}
          {angebot.kunde.strasse && <div style={{ fontSize: "10pt" }}>{angebot.kunde.strasse}</div>}
          {(angebot.kunde.plz || angebot.kunde.ort) && (
            <div style={{ fontSize: "10pt" }}>
              {[angebot.kunde.plz, angebot.kunde.ort].filter(Boolean).join(" ")}
            </div>
          )}
          {angebot.kunde.land && angebot.kunde.land !== "Deutschland" && (
            <div style={{ fontSize: "10pt" }}>{angebot.kunde.land}</div>
          )}
        </div>

        <div style={{ fontSize: "10pt", marginBottom: "24px" }}>
          Sehr geehrte Damen und Herren,<br />
          wir unterbreiten Ihnen folgendes Angebot:
        </div>

        {/* Positionen */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "20px", fontSize: "10pt" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #333", backgroundColor: "#f5f5f5" }}>
              <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: "600" }}>Artikel</th>
              <th style={{ textAlign: "right", padding: "6px 8px", fontWeight: "600" }}>Menge</th>
              <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: "600" }}>Einheit</th>
              <th style={{ textAlign: "right", padding: "6px 8px", fontWeight: "600" }}>Einzelpreis</th>
              <th style={{ textAlign: "right", padding: "6px 8px", fontWeight: "600" }}>Rabatt</th>
              <th style={{ textAlign: "right", padding: "6px 8px", fontWeight: "600" }}>Gesamt</th>
            </tr>
          </thead>
          <tbody>
            {angebot.positionen.map((pos, i) => {
              const netto = pos.menge * pos.preis * (1 - pos.rabatt / 100);
              return (
                <tr
                  key={pos.id}
                  style={{
                    borderBottom: "1px solid #ddd",
                    backgroundColor: i % 2 === 0 ? "#fff" : "#fafafa",
                  }}
                >
                  <td style={{ padding: "6px 8px" }}>
                    {pos.artikel.name}
                    {pos.notiz && (
                      <div style={{ fontSize: "9pt", color: "#666" }}>{pos.notiz}</div>
                    )}
                  </td>
                  <td style={{ padding: "6px 8px", textAlign: "right", fontFamily: "monospace" }}>
                    {pos.menge.toLocaleString("de-DE")}
                  </td>
                  <td style={{ padding: "6px 8px" }}>{pos.einheit}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right", fontFamily: "monospace" }}>
                    {fmt(pos.preis)}
                  </td>
                  <td style={{ padding: "6px 8px", textAlign: "right" }}>
                    {pos.rabatt > 0 ? `${pos.rabatt.toLocaleString("de-DE")} %` : "—"}
                  </td>
                  <td style={{ padding: "6px 8px", textAlign: "right", fontFamily: "monospace", fontWeight: "500" }}>
                    {fmt(netto)}
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
                <td style={{ padding: "4px 10px", color: "#444" }}>Netto:</td>
                <td style={{ padding: "4px 10px", textAlign: "right", fontFamily: "monospace" }}>
                  {fmt(gesamtNetto)}
                </td>
              </tr>
              {Object.entries(mwstMap)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([satz, betrag]) => (
                  <tr key={satz}>
                    <td style={{ padding: "4px 10px", color: "#444" }}>MwSt. {satz} %:</td>
                    <td style={{ padding: "4px 10px", textAlign: "right", fontFamily: "monospace" }}>
                      {fmt(betrag)}
                    </td>
                  </tr>
                ))}
              <tr style={{ borderTop: "2px solid #333" }}>
                <td style={{ padding: "6px 10px", fontWeight: "bold", fontSize: "12pt" }}>
                  Brutto gesamt:
                </td>
                <td style={{ padding: "6px 10px", textAlign: "right", fontFamily: "monospace", fontWeight: "bold", fontSize: "12pt" }}>
                  {fmt(gesamtBrutto)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Notiz */}
        {angebot.notiz && (
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
            {angebot.notiz}
          </div>
        )}

        {/* Hinweistext */}
        <div style={{ fontSize: "9pt", color: "#555", marginTop: "32px", marginBottom: "12px" }}>
          <p style={{ marginBottom: "4px" }}>
            Dieses Angebot ist gültig bis {fmtDatum(angebot.gueltigBis)}.
          </p>
          <p style={{ marginBottom: "4px" }}>
            Alle Preise verstehen sich netto zuzüglich der gesetzlichen Mehrwertsteuer.
          </p>
          <p style={{ marginTop: "16px", marginBottom: "4px" }}>Mit freundlichen Grüßen</p>
          <p style={{ fontWeight: "bold" }}>{firmaName}</p>
        </div>

        {/* Footer – 3 Spalten */}
        <DokumentFooter firmaData={firma} footerConfig={footerData} marginTop="16px" />
      </div>
    </>
  );
}
