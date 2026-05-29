"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import DriveUploadButton from "@/components/DriveUploadButton";
import DokumentFooter from "@/components/DokumentFooter";

interface Position {
  id: number;
  menge: number;
  preis?: number | null;
  einheit: string;
  reserviert: boolean;
  notiz?: string | null;
  bestelltAm?: string | null;
  artikel: { id: number; name: string; einheit: string; standardpreis: number };
}

interface Vorbestellung {
  id: number;
  nummer: string;
  saison: string;
  status: string;
  bestelldatum: string;
  bestellfrist?: string | null;
  lieferdatum?: string | null;
  rabattProzent?: number | null;
  notiz?: string | null;
  kunde: {
    id: number;
    name: string;
    firma?: string | null;
    strasse?: string | null;
    plz?: string | null;
    ort?: string | null;
    land?: string | null;
  };
  positionen: Position[];
}

function fmt(n: number): string {
  return n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

function fmtDatum(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("de-DE");
}

export default function AuftragsbestaetigungPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();

  const [vb, setVb] = useState<Vorbestellung | null>(null);
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
      fetch(`/api/vorbestellungen/${id}`).then((r) => r.ok ? r.json() : null),
      fetch("/api/einstellungen?prefix=firma.").then((r) => r.ok ? r.json() : {}),
      fetch("/api/einstellungen?prefix=system.logo").then((r) => r.ok ? r.json() : {}),
      fetch("/api/einstellungen?prefix=dokument.footer").then((r) => r.ok ? r.json() : {}),
    ])
      .then(([data, firmaData, logoData, ftrData]) => {
        setVb(data as Vorbestellung | null);
        setFirma((firmaData as Record<string, string>) ?? {});
        setFooterData((ftrData as Record<string, string>) ?? {});
        const ld = logoData as Record<string, string>;
        if (ld?.["system.logo"]) setLogo(ld["system.logo"]);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  async function handleTeilen() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const title = `Auftragsbestätigung ${vb?.nummer ?? ""}`;
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

  if (loading) return <div className="p-8 text-gray-400">Lade…</div>;
  if (!vb) return <div className="p-8 text-red-500">Vorbestellung nicht gefunden.</div>;

  const zwischensumme = vb.positionen.reduce(
    (s, p) => s + p.menge * (p.preis ?? p.artikel.standardpreis),
    0
  );
  const rabattBetrag = vb.rabattProzent ? zwischensumme * (vb.rabattProzent / 100) : 0;
  const gesamtNetto = zwischensumme - rabattBetrag;

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
        }
        body { font-family: Arial, sans-serif; }
      `}</style>

      {/* Sticky controls – hidden when printing */}
      <div className="print-hidden sticky top-0 z-20 flex items-center flex-wrap gap-1.5 p-2.5 bg-white/95 backdrop-blur border-b border-gray-200 shadow-sm">
        <button
          onClick={() => router.push(`/vorbestellungen/${id}`)}
          className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 rounded-lg transition-colors"
          title="Schließen – zurück zur Vorbestellung"
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
          title={canShare ? "Teilen" : "Link kopieren"}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
        </button>
        {shareMsg && (
          <span className="text-xs text-green-700 font-medium ml-1">{shareMsg}</span>
        )}
        <DriveUploadButton
          kundeId={vb.kunde.id}
          typ="angebot"
          dateiName={`Auftragsbestaetigung_${vb.nummer}.pdf`}
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
              AUFTRAGSBESTÄTIGUNG
            </div>
            <table style={{ fontSize: "10pt", borderCollapse: "collapse", marginLeft: "auto" }}>
              <tbody>
                <tr>
                  <td style={{ paddingRight: "8px", color: "#555" }}>Nummer:</td>
                  <td style={{ fontWeight: "bold", fontFamily: "monospace" }}>{vb.nummer}</td>
                </tr>
                <tr>
                  <td style={{ paddingRight: "8px", color: "#555" }}>Datum:</td>
                  <td>{fmtDatum(vb.bestelldatum)}</td>
                </tr>
                <tr>
                  <td style={{ paddingRight: "8px", color: "#555" }}>Saison:</td>
                  <td style={{ fontWeight: "bold" }}>{vb.saison}</td>
                </tr>
                {vb.lieferdatum && (
                  <tr>
                    <td style={{ paddingRight: "8px", color: "#555" }}>Lieferdatum:</td>
                    <td style={{ fontWeight: "bold" }}>{fmtDatum(vb.lieferdatum)}</td>
                  </tr>
                )}
                {vb.bestellfrist && (
                  <tr>
                    <td style={{ paddingRight: "8px", color: "#555" }}>Bestellfrist:</td>
                    <td>{fmtDatum(vb.bestellfrist)}</td>
                  </tr>
                )}
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
          <div style={{ fontWeight: "bold", fontSize: "12pt" }}>{vb.kunde.name}</div>
          {vb.kunde.firma && <div style={{ fontSize: "10pt" }}>{vb.kunde.firma}</div>}
          {vb.kunde.strasse && <div style={{ fontSize: "10pt" }}>{vb.kunde.strasse}</div>}
          {(vb.kunde.plz || vb.kunde.ort) && (
            <div style={{ fontSize: "10pt" }}>
              {[vb.kunde.plz, vb.kunde.ort].filter(Boolean).join(" ")}
            </div>
          )}
          {vb.kunde.land && vb.kunde.land !== "Deutschland" && (
            <div style={{ fontSize: "10pt" }}>{vb.kunde.land}</div>
          )}
        </div>

        <div style={{ fontSize: "10pt", marginBottom: "24px" }}>
          Sehr geehrte Damen und Herren,<br />
          vielen Dank für Ihre Bestellung. Wir bestätigen Ihren Auftrag wie folgt:
        </div>

        {/* Positionen */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "20px", fontSize: "10pt" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #333", backgroundColor: "#f5f5f5" }}>
              <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: "600" }}>Artikel</th>
              <th style={{ textAlign: "right", padding: "6px 8px", fontWeight: "600" }}>Menge</th>
              <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: "600" }}>Einheit</th>
              <th style={{ textAlign: "right", padding: "6px 8px", fontWeight: "600" }}>Einzelpreis</th>
              <th style={{ textAlign: "right", padding: "6px 8px", fontWeight: "600" }}>Gesamt</th>
            </tr>
          </thead>
          <tbody>
            {vb.positionen.map((pos, i) => {
              const preis = pos.preis ?? pos.artikel.standardpreis;
              const gesamt = pos.menge * preis;
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
                    {/* Interner Beschaffungsstatus – nicht im Druck/PDF */}
                    {pos.bestelltAm ? (
                      <div
                        className="print-hidden"
                        style={{ fontSize: "8.5pt", color: "#15803d", fontWeight: 600, marginTop: "2px" }}
                      >
                        ✓ beim Lieferanten bestellt am {fmtDatum(pos.bestelltAm)}
                      </div>
                    ) : (
                      <div
                        className="print-hidden"
                        style={{ fontSize: "8.5pt", color: "#b45309", marginTop: "2px" }}
                      >
                        ○ noch nicht bestellt
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "6px 8px", textAlign: "right", fontFamily: "monospace" }}>
                    {pos.menge.toLocaleString("de-DE")}
                  </td>
                  <td style={{ padding: "6px 8px" }}>{pos.einheit}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right", fontFamily: "monospace" }}>
                    {fmt(preis)}
                  </td>
                  <td style={{ padding: "6px 8px", textAlign: "right", fontFamily: "monospace", fontWeight: "500" }}>
                    {fmt(gesamt)}
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
              {vb.rabattProzent ? (
                <>
                  <tr>
                    <td style={{ padding: "4px 10px", color: "#444" }}>Zwischensumme:</td>
                    <td style={{ padding: "4px 10px", textAlign: "right", fontFamily: "monospace" }}>
                      {fmt(zwischensumme)}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: "4px 10px", color: "#2d6a4f" }}>
                      Frühbezugsrabatt {vb.rabattProzent} %:
                    </td>
                    <td style={{ padding: "4px 10px", textAlign: "right", fontFamily: "monospace", color: "#2d6a4f" }}>
                      − {fmt(rabattBetrag)}
                    </td>
                  </tr>
                </>
              ) : null}
              <tr style={{ borderTop: "2px solid #333" }}>
                <td style={{ padding: "6px 10px", fontWeight: "bold", fontSize: "12pt" }}>
                  Netto gesamt:
                </td>
                <td style={{ padding: "6px 10px", textAlign: "right", fontFamily: "monospace", fontWeight: "bold", fontSize: "12pt" }}>
                  {fmt(gesamtNetto)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Notiz */}
        {vb.notiz && (
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
            {vb.notiz}
          </div>
        )}

        {/* Schlusstext */}
        <div style={{ fontSize: "9pt", color: "#555", marginTop: "32px", marginBottom: "12px" }}>
          {vb.lieferdatum && (
            <p style={{ marginBottom: "4px" }}>
              Die voraussichtliche Lieferung erfolgt am {fmtDatum(vb.lieferdatum)}.
            </p>
          )}
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
