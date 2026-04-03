"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { formatEuro, formatDatum, addTage } from "@/lib/utils";
import DriveUploadButton from "@/components/DriveUploadButton";

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

  const [lieferung, setLieferung] = useState<Lieferung | null>(null);
  const [firmaData, setFirmaData] = useState<Record<string, string>>({});
  const [logo, setLogo] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

    fetch("/api/einstellungen?prefix=firma.")
      .then((r) => r.json())
      .then((d) => setFirmaData(d))
      .catch(() => {});

    fetch("/api/einstellungen?prefix=system.logo")
      .then((r) => r.json())
      .then((d) => { if (d["system.logo"]) setLogo(d["system.logo"]); })
      .catch(() => {});
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const firmenname = firmaData["firma.firmenname"] ?? "";
  const firmaAdresse = firmaData["firma.adresse"] ?? "";
  const firmaPlz = firmaData["firma.plz"] ?? "";
  const firmaOrt = firmaData["firma.ort"] ?? "";
  const firmaTel = firmaData["firma.tel"] ?? "";
  const firmaEmail = firmaData["firma.email"] ?? "";
  const firmaSteuernr = firmaData["firma.steuernr"] ?? "";
  const firmaIban = firmaData["firma.iban"] ?? "";
  const firmaBic = firmaData["firma.bic"] ?? "";
  const firmaBankname = firmaData["firma.bankname"] ?? "";

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

      {/* Screen-only controls */}
      <div className="print-hidden flex items-center flex-wrap gap-4 p-4 bg-gray-50 border-b border-gray-200 no-print">
        <Link
          href={`/lieferungen/${id}`}
          className="text-sm text-green-700 hover:text-green-900 hover:underline"
        >
          ← Zurück
        </Link>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 text-sm bg-green-700 hover:bg-green-800 text-white rounded-lg font-medium transition-colors"
        >
          Drucken
        </button>
        {lieferung?.rechnungNr && (
          <a
            href={`/api/exporte/zugferd?lieferungId=${id}`}
            download
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600 font-medium transition-colors"
            title="ZUGFeRD / Factur-X E-Rechnung herunterladen"
          >
            ⬇ ZUGFeRD XML
          </a>
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
        {error && (
          <span className="text-sm text-red-600">{error}</span>
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
          margin: "0 auto",
          padding: "1.5cm 1cm",
          background: "#fff",
        }}
      >
        {/* Briefkopf */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
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
            {firmaTel && <div style={{ fontSize: "10pt" }}>Tel: {firmaTel}</div>}
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
                  <td style={{ paddingRight: "8px", color: "#555" }}>Zahlungsziel:</td>
                  <td>{zahlungszielTage} Tage</td>
                </tr>
                <tr>
                  <td style={{ paddingRight: "8px", color: "#555" }}>Fällig am:</td>
                  <td style={{ fontWeight: "bold" }}>{formatDatum(faelligkeitsDatum)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <hr style={{ borderTop: "2px solid #222", marginBottom: "24px" }} />

        {/* Empfänger */}
        <div style={{ marginBottom: "32px" }}>
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
              <th style={{ textAlign: "right", padding: "6px 8px", fontWeight: "600" }}>Rabatt %</th>
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
                <td style={{ padding: "6px 8px", verticalAlign: "top", textAlign: "right" }}>
                  {(p.rabattProzent ?? 0) > 0
                    ? `${p.rabattProzent} %`
                    : "—"}
                </td>
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
          }}
        >
          <div style={{ fontWeight: "bold", marginBottom: "6px" }}>Zahlungsinformationen</div>
          <div style={{ marginBottom: "4px" }}>
            Bitte überweisen Sie den Betrag von{" "}
            <strong>{formatEuro(bruttobetrag)}</strong> bis zum{" "}
            <strong>{formatDatum(faelligkeitsDatum)}</strong> unter Angabe der
            Rechnungsnummer <strong>{rechnungNr}</strong>.
          </div>
          {(firmaIban || firmaBic || firmaBankname) && (
            <div style={{ marginTop: "8px", display: "flex", flexWrap: "wrap", gap: "16px", color: "#333" }}>
              {firmaBankname && <span>Bank: {firmaBankname}</span>}
              {firmaIban && <span>IBAN: {firmaIban}</span>}
              {firmaBic && <span>BIC: {firmaBic}</span>}
            </div>
          )}
        </div>

        {/* Footer */}
        <hr style={{ borderTop: "1px solid #ccc", marginBottom: "10px" }} />
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
            {[firmenname, firmaAdresse, [firmaPlz, firmaOrt].filter(Boolean).join(" ")]
              .filter(Boolean)
              .join(" · ")}
          </span>
          <span style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
            {firmaTel && <span>Tel: {firmaTel}</span>}
            {firmaEmail && <span>{firmaEmail}</span>}
            {firmaSteuernr && <span>Steuernr.: {firmaSteuernr}</span>}
          </span>
        </div>
      </div>
    </>
  );
}
