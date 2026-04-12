"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { formatDatum } from "@/lib/utils";
import DriveUploadButton from "@/components/DriveUploadButton";

interface Position {
  id: number;
  menge: number;
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
  positionen: Position[];
  kunde: Kunde;
}

export default function LieferscheinPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [lieferung, setLieferung] = useState<Lieferung | null>(null);
  const [firma, setFirma] = useState<Record<string, string>>({});
  const [logo, setLogo] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [origin, setOrigin] = useState("");
  const [canShare, setCanShare] = useState(false);
  const [shareMsg, setShareMsg] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      setCanShare(true);
    }
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const [lRes, eRes, logoRes] = await Promise.all([
          fetch(`/api/lieferungen/${id}`),
          fetch("/api/einstellungen?prefix=firma."),
          fetch("/api/einstellungen?prefix=system.logo"),
        ]);
        if (!lRes.ok) throw new Error("Lieferung nicht gefunden");
        const lData: Lieferung = await lRes.json();
        const firmaData: Record<string, string> = await eRes.json();
        const logoData: Record<string, string> = await logoRes.json();
        setLieferung(lData);
        setFirma(firmaData);
        if (logoData["system.logo"]) setLogo(logoData["system.logo"]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Fehler beim Laden");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

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
      <div className="print-hidden sticky top-0 z-20 flex items-center flex-wrap gap-3 p-3 bg-white/95 backdrop-blur border-b border-gray-200 shadow-sm">
        <button
          onClick={() => router.push(`/lieferungen/${id}`)}
          className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 rounded-lg font-medium transition-colors inline-flex items-center gap-1"
          title="Lieferschein schließen und zurück zur Lieferung"
        >
          <span aria-hidden>✕</span> Schließen
        </button>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 text-sm bg-green-700 hover:bg-green-800 text-white rounded-lg font-medium transition-colors"
        >
          Drucken
        </button>
        <button
          onClick={handleTeilen}
          className="px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors inline-flex items-center gap-1"
          title={canShare ? "Lieferschein teilen" : "Link in Zwischenablage kopieren"}
        >
          <span aria-hidden>↗</span> Teilen
        </button>
        {shareMsg && (
          <span className="text-xs text-green-700 font-medium">{shareMsg}</span>
        )}
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

        {/* Positionen-Tabelle */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "32px", fontSize: "10pt" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #333", backgroundColor: "#f5f5f5" }}>
              <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: "600" }}>Pos.</th>
              <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: "600" }}>Artikel</th>
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
                <td style={{ padding: "6px 8px", textAlign: "right", fontFamily: "monospace" }}>
                  {pos.menge.toLocaleString("de-DE")}
                </td>
                <td style={{ padding: "6px 8px" }}>{pos.artikel.einheit}</td>
              </tr>
            ))}
          </tbody>
        </table>

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

        {/* Footer */}
        <hr style={{ borderTop: "1px solid #ccc", marginTop: "64px", marginBottom: "10px" }} />
        <div
          style={{
            fontSize: "8.5pt",
            color: "#666",
            display: "flex",
            flexWrap: "wrap",
            gap: "16px",
            justifyContent: "space-between",
          }}
        >
          <span>
            {[firmaName, firmaStrasse, [firmaPlz, firmaOrt].filter(Boolean).join(" ")]
              .filter(Boolean)
              .join(" · ")}
          </span>
          <span style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
            {firmaTel && <span>Tel.: {firmaTel}</span>}
            {firmaEmail && <span>{firmaEmail}</span>}
          </span>
        </div>
      </div>
    </>
  );
}
