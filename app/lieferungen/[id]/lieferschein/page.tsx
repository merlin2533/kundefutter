"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { formatDatum } from "@/lib/utils";
import DriveUploadButton from "@/components/DriveUploadButton";
import DokumentFooter from "@/components/DokumentFooter";

interface Position {
  id: number;
  menge: number;
  chargeNr?: string | null;
  artikel: { name: string; einheit: string };
}

interface Kunde {
  name: string;
  firma?: string | null;
  strasse?: string | null;
  plz?: string | null;
  ort?: string | null;
  kontakte: { typ: string; wert: string }[];
}

interface Lieferung {
  id: number;
  kundeId: number;
  datum: string;
  status: string;
  notiz?: string | null;
  lieferadresse?: string | null;
  angebotId?: number | null;
  rechnungNr?: string | null;
  positionen: Position[];
  kunde: Kunde;
}

export default function LieferscheinPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [lieferung, setLieferung] = useState<Lieferung | null>(null);
  const [firma, setFirma] = useState<Record<string, string>>({});
  const [footerData, setFooterData] = useState<Record<string, string>>({});
  const [logo, setLogo] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [origin, setOrigin] = useState("");
  const [canShare, setCanShare] = useState(false);
  const [shareMsg, setShareMsg] = useState("");
  const [rechnungLoading, setRechnungLoading] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      setCanShare(true);
    }
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const [lRes, eRes, logoRes, ftrRes] = await Promise.all([
          fetch(`/api/lieferungen/${id}`),
          fetch("/api/einstellungen?prefix=firma."),
          fetch("/api/einstellungen?prefix=system.logo"),
          fetch("/api/einstellungen?prefix=dokument.footer"),
        ]);
        if (!lRes.ok) throw new Error("Lieferung nicht gefunden");
        const lData: Lieferung = await lRes.json();
        const firmaData: Record<string, string> = await eRes.json();
        const logoData: Record<string, string> = await logoRes.json();
        const ftrData: Record<string, string> = await ftrRes.json();
        setLieferung(lData);
        setFirma(firmaData);
        setFooterData(ftrData);
        if (logoData["system.logo"]) setLogo(logoData["system.logo"]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Fehler beim Laden");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  async function inRechnungUmwandeln() {
    if (!lieferung) return;
    if (!confirm("Diese Lieferung in eine Rechnung umwandeln?")) return;
    setRechnungLoading(true);
    try {
      const res = await fetch(`/api/lieferungen/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aktion: "rechnung_erstellen" }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error ?? "Fehler beim Erstellen der Rechnung");
        return;
      }
      router.push(`/lieferungen/${id}/rechnung`);
    } catch {
      alert("Netzwerkfehler beim Erstellen der Rechnung");
    } finally {
      setRechnungLoading(false);
    }
  }

  async function handleTeilen() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const title = `Lieferschein ${lieferung?.id ?? ""}`;
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
    return <div className="p-8 text-gray-500">Lade Lieferschein…</div>;
  }

  if (error || !lieferung) {
    return <div className="p-8 text-red-600">{error || "Lieferung nicht gefunden"}</div>;
  }

  const { kunde } = lieferung;
  const telefon = kunde.kontakte.find((k) => k.typ === "telefon" || k.typ === "mobil")?.wert;
  const email = kunde.kontakte.find((k) => k.typ === "email")?.wert;

  const firmaName = firma["firma.firmenname"] ?? firma["firma.name"] ?? "";
  const firmaStrasse = firma["firma.strasse"] ?? "";
  const firmaPlz = firma["firma.plz"] ?? "";
  const firmaOrt = firma["firma.ort"] ?? "";
  const firmaTel = firma["firma.tel"] ?? firma["firma.telefon"] ?? "";
  const firmaEmail = firma["firma.email"] ?? "";
  return (
    <>
      <style>{`
        @media print {
          @page { margin: 2cm; size: A4; }
          .print-hidden { display: none !important; }
        }
      `}</style>

      {/* Sticky controls – hidden when printing */}
      <div className="print-hidden sticky top-0 z-20 flex items-center flex-wrap gap-1.5 p-2.5 bg-white/95 backdrop-blur border-b border-gray-200 shadow-sm">
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
        <a
          href={`/api/exporte/lieferschein?lieferungId=${id}`}
          download
          className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 transition-colors block"
          title="PDF herunterladen"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
        </a>
        <button
          onClick={handleTeilen}
          className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          title={canShare ? "Lieferschein teilen" : "Link kopieren"}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
        </button>
        {!lieferung.rechnungNr && (
          <button
            onClick={inRechnungUmwandeln}
            disabled={rechnungLoading}
            className="px-3 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white rounded-lg transition-colors text-sm font-medium flex items-center gap-1.5"
            title="Diese Lieferung in eine Rechnung umwandeln"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            <span className="hidden sm:inline">{rechnungLoading ? "Erstelle…" : "In Rechnung umwandeln"}</span>
            <span className="sm:hidden">{rechnungLoading ? "…" : "Rechnung"}</span>
          </button>
        )}
        {shareMsg && (
          <span className="text-xs text-green-700 font-medium ml-1">{shareMsg}</span>
        )}
        <a
          href={`/api/exporte/lieferschein?lieferungId=${id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 font-medium transition-colors"
          title="Lieferschein als PDF herunterladen"
        >
          ⬇ PDF
        </a>
        <DriveUploadButton
          kundeId={lieferung.kundeId}
          typ="lieferschein"
          dateiName={`Lieferschein_${lieferung.id}.pdf`}
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

      {/* Lieferschein document */}
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
          {/* Absender links */}
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
            {firmaStrasse && <div style={{ fontSize: "10pt" }}>{firmaStrasse}</div>}
            {(firmaPlz || firmaOrt) && (
              <div style={{ fontSize: "10pt" }}>
                {[firmaPlz, firmaOrt].filter(Boolean).join(" ")}
              </div>
            )}
            {firmaTel && <div style={{ fontSize: "10pt" }}>Tel.: {firmaTel}</div>}
            {firmaEmail && <div style={{ fontSize: "10pt" }}>{firmaEmail}</div>}
          </div>

          {/* Titel + Metadaten rechts */}
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "20pt", fontWeight: "bold", marginBottom: "6px" }}>
              Lieferschein
            </div>
            <table style={{ fontSize: "10pt", borderCollapse: "collapse", marginLeft: "auto" }}>
              <tbody>
                <tr>
                  <td style={{ paddingRight: "8px", color: "#555" }}>Nr.:</td>
                  <td style={{ fontWeight: "bold", fontFamily: "monospace" }}>{lieferung.id}</td>
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

        {/* Empfänger-Block */}
        <div style={{ marginBottom: "32px" }}>
          <div style={{ fontSize: "8pt", color: "#888", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Empfänger
          </div>
          <div style={{ fontWeight: "bold", fontSize: "12pt" }}>{kunde.name}</div>
          {kunde.firma && <div style={{ fontSize: "10pt" }}>{kunde.firma}</div>}
          {kunde.strasse && <div style={{ fontSize: "10pt" }}>{kunde.strasse}</div>}
          {(kunde.plz || kunde.ort) && (
            <div style={{ fontSize: "10pt" }}>
              {[kunde.plz, kunde.ort].filter(Boolean).join(" ")}
            </div>
          )}
          {telefon && <div style={{ fontSize: "10pt" }}>Tel.: {telefon}</div>}
          {email && <div style={{ fontSize: "10pt" }}>{email}</div>}
        </div>

        {/* Lieferadresse (falls abweichend) */}
        {lieferung.lieferadresse && (
          <div style={{ marginBottom: "24px" }}>
            <div style={{ fontSize: "8pt", color: "#888", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Lieferadresse
            </div>
            <div style={{ fontSize: "10pt", whiteSpace: "pre-line" }}>{lieferung.lieferadresse}</div>
          </div>
        )}

        {/* Angebot-Referenz */}
        {lieferung.angebotId && (
          <div style={{ marginBottom: "16px", fontSize: "10pt", color: "#555" }}>
            Bezug: Angebot Nr. {lieferung.angebotId}
          </div>
        )}

        {/* Positionen-Tabelle */}
        {(() => {
          const hasCharge = lieferung.positionen.some((p) => p.chargeNr);
          return (
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "32px", fontSize: "10pt" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #333", backgroundColor: "#f5f5f5" }}>
                  <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: "600" }}>Pos.</th>
                  <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: "600" }}>Artikel</th>
                  {hasCharge && (
                    <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: "600" }}>Charge</th>
                  )}
                  <th style={{ textAlign: "right", padding: "6px 8px", fontWeight: "600" }}>Menge</th>
                  <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: "600" }}>Einheit</th>
                </tr>
              </thead>
              <tbody>
                {lieferung.positionen.map((pos, idx) => (
                  <tr
                    key={pos.id}
                    style={{
                      borderBottom: "1px solid #ddd",
                      backgroundColor: idx % 2 === 0 ? "#fff" : "#fafafa",
                    }}
                  >
                    <td style={{ padding: "6px 8px" }}>{idx + 1}</td>
                    <td style={{ padding: "6px 8px" }}>{pos.artikel.name}</td>
                    {hasCharge && (
                      <td style={{ padding: "6px 8px", fontFamily: "monospace", fontSize: "9pt", color: "#555" }}>
                        {pos.chargeNr ?? "—"}
                      </td>
                    )}
                    <td style={{ padding: "6px 8px", textAlign: "right", fontFamily: "monospace" }}>
                      {pos.menge.toLocaleString("de-DE")}
                    </td>
                    <td style={{ padding: "6px 8px" }}>{pos.artikel.einheit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          );
        })()}

        {/* Bemerkung / Notiz */}
        {lieferung.notiz && (
          <div style={{ marginBottom: "32px" }}>
            <div style={{ fontSize: "8pt", color: "#888", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Bemerkung
            </div>
            <div style={{ fontSize: "10pt", whiteSpace: "pre-line", border: "1px solid #ddd", borderRadius: "4px", padding: "10px 12px" }}>
              {lieferung.notiz}
            </div>
          </div>
        )}

        {/* Unterschriftszeile + QR-Code */}
        <div style={{ marginTop: "48px", display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "32px", fontSize: "10pt" }}>
          <div style={{ display: "flex", gap: "64px" }}>
            <div>
              <div style={{ marginBottom: "32px" }}>Erhalten am: _______________</div>
              <div style={{ borderTop: "1px solid #000", paddingTop: "4px", width: "192px" }}>Datum</div>
            </div>
            <div>
              <div style={{ marginBottom: "32px" }}>&nbsp;</div>
              <div style={{ borderTop: "1px solid #000", paddingTop: "4px", width: "256px" }}>Unterschrift Empfänger</div>
            </div>
          </div>

          {/* QR-Code für Lieferbestätigung */}
          {origin && (
            <div style={{ textAlign: "center", fontSize: "9pt", color: "#666" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(`${origin}/qr/${lieferung.id}`)}`}
                alt="QR-Code Lieferbestätigung"
                style={{ width: "120px", height: "120px", display: "block", marginBottom: "4px" }}
              />
              <span>QR-Code scannen für<br />Lieferbestätigung</span>
            </div>
          )}
        </div>

        {/* Footer – 3 Spalten */}
        <DokumentFooter firmaData={firma} footerConfig={footerData} marginTop="64px" />
      </div>
    </>
  );
}
