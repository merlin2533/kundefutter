"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { formatDatum } from "@/lib/utils";
import DriveUploadButton from "@/components/DriveUploadButton";
import DokumentFooter from "@/components/DokumentFooter";

interface Inhaltsstoff {
  id: number;
  name: string;
  menge: number | null;
  einheit: string | null;
}

interface Position {
  id: number;
  menge: number;
  chargeNr?: string | null;
  artikel: {
    name: string;
    einheit: string;
    kategorie?: string | null;
    unterkategorie?: string | null;
    ghsKlassen?: string | null;
    hSaetze?: string | null;
    pSaetze?: string | null;
    signalwort?: string | null;
    inhaltsstoffe?: Inhaltsstoff[];
  };
}

function GhsBadge({ klasse }: { klasse: string }) {
  const farbe = klasse === "GHS06" ? "#cc0000" : "#cc3300";
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: "9pt",
        border: `1px solid ${farbe}`,
        borderRadius: "2px",
        padding: "0 3px",
        color: farbe,
        fontFamily: "monospace",
        marginRight: "3px",
        lineHeight: "1.4",
        verticalAlign: "middle",
      }}
    >
      {klasse}
    </span>
  );
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
  unterschriftPng?: string | null;
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

  // Digitale Unterschrift
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const [unterschriftGespeichert, setUnterschriftGespeichert] = useState(false);
  const [unterschriftSaving, setUnterschriftSaving] = useState(false);
  const [unterschriftMsg, setUnterschriftMsg] = useState("");

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
        const firmaData: Record<string, string> = eRes.ok ? await eRes.json() : {};
        const logoData: Record<string, string> = logoRes.ok ? await logoRes.json() : {};
        const ftrData: Record<string, string> = ftrRes.ok ? await ftrRes.json() : {};
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

  // Canvas weißen Hintergrund initialisieren
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  // Canvas Events via native DOM (vermeidet React-Namespace-Typen)
  useEffect(() => {
    if (loading || !lieferung) return;

    const t = setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Init Hintergrund
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      function onMouseDown(e: MouseEvent) {
        const c = canvasRef.current;
        if (!c) return;
        isDrawing.current = true;
        lastPos.current = getCanvasPosFromMouse(e, c);
      }
      function onMouseMove(e: MouseEvent) {
        if (!isDrawing.current) return;
        const c = canvasRef.current;
        if (!c) return;
        const ctxC = c.getContext("2d");
        if (!ctxC) return;
        const pos = getCanvasPosFromMouse(e, c);
        if (lastPos.current) {
          ctxC.beginPath();
          ctxC.strokeStyle = "#000";
          ctxC.lineWidth = 2.5;
          ctxC.lineCap = "round";
          ctxC.lineJoin = "round";
          ctxC.moveTo(lastPos.current.x, lastPos.current.y);
          ctxC.lineTo(pos.x, pos.y);
          ctxC.stroke();
        }
        lastPos.current = pos;
      }
      function onTouchStart(e: TouchEvent) {
        e.preventDefault();
        const c = canvasRef.current;
        if (!c) return;
        isDrawing.current = true;
        lastPos.current = getCanvasPosFromTouch(e, c);
      }
      function onTouchMove(e: TouchEvent) {
        e.preventDefault();
        if (!isDrawing.current) return;
        const c = canvasRef.current;
        if (!c) return;
        const ctxC = c.getContext("2d");
        if (!ctxC) return;
        const pos = getCanvasPosFromTouch(e, c);
        if (!pos) return;
        if (lastPos.current) {
          ctxC.beginPath();
          ctxC.strokeStyle = "#000";
          ctxC.lineWidth = 2.5;
          ctxC.lineCap = "round";
          ctxC.lineJoin = "round";
          ctxC.moveTo(lastPos.current.x, lastPos.current.y);
          ctxC.lineTo(pos.x, pos.y);
          ctxC.stroke();
        }
        lastPos.current = pos;
      }

      canvas.addEventListener("mousedown", onMouseDown);
      canvas.addEventListener("mousemove", onMouseMove);
      canvas.addEventListener("mouseup", stopDrawing);
      canvas.addEventListener("mouseleave", stopDrawing);
      canvas.addEventListener("touchstart", onTouchStart, { passive: false });
      canvas.addEventListener("touchmove", onTouchMove, { passive: false });
      canvas.addEventListener("touchend", stopDrawing);

      return () => {
        canvas.removeEventListener("mousedown", onMouseDown);
        canvas.removeEventListener("mousemove", onMouseMove);
        canvas.removeEventListener("mouseup", stopDrawing);
        canvas.removeEventListener("mouseleave", stopDrawing);
        canvas.removeEventListener("touchstart", onTouchStart);
        canvas.removeEventListener("touchmove", onTouchMove);
        canvas.removeEventListener("touchend", stopDrawing);
      };
    }, 100);

    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, lieferung]);

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

  // Canvas-Hilfsfunktionen (native DOM Events, kein React-Namespace nötig)
  function getCanvasPosFromMouse(e: MouseEvent, canvas: HTMLCanvasElement): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function getCanvasPosFromTouch(e: TouchEvent, canvas: HTMLCanvasElement): { x: number; y: number } | null {
    const touch = e.touches[0];
    if (!touch) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (touch.clientX - rect.left) * (canvas.width / rect.width),
      y: (touch.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function stopDrawing() {
    isDrawing.current = false;
    lastPos.current = null;
  }

  function canvasLoeschen() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setUnterschriftMsg("");
  }

  async function unterschriftSpeichern() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setUnterschriftSaving(true);
    setUnterschriftMsg("");
    try {
      const dataUrl = canvas.toDataURL("image/png");
      const res = await fetch(`/api/lieferungen/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unterschriftPng: dataUrl }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setUnterschriftMsg(d.error ?? "Fehler beim Speichern");
        return;
      }
      setUnterschriftGespeichert(true);
      setUnterschriftMsg("Unterschrift gespeichert");
      if (lieferung) {
        setLieferung({ ...lieferung, unterschriftPng: dataUrl });
      }
    } catch {
      setUnterschriftMsg("Netzwerkfehler – bitte nochmal versuchen");
    } finally {
      setUnterschriftSaving(false);
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
                    <td style={{ padding: "6px 8px" }}>
                      {(pos.artikel.kategorie || pos.artikel.unterkategorie) && (
                        <div style={{ fontSize: "8pt", color: "#888", marginBottom: "2px" }}>
                          {[pos.artikel.kategorie === "Duenger" ? "Dünger" : pos.artikel.kategorie, pos.artikel.unterkategorie].filter(Boolean).join(" / ")}
                        </div>
                      )}
                      {pos.artikel.name}
                      {(() => {
                        try {
                          const klassen: string[] = JSON.parse(pos.artikel.ghsKlassen || "[]");
                          if (klassen.length === 0) return null;
                          return (
                            <div style={{ marginTop: "3px" }}>
                              {klassen.map((k) => <GhsBadge key={k} klasse={k} />)}
                              {pos.artikel.signalwort && (
                                <span style={{ fontSize: "8pt", color: "#cc3300", marginLeft: "4px" }}>
                                  {pos.artikel.signalwort}
                                </span>
                              )}
                            </div>
                          );
                        } catch { return null; }
                      })()}
                    </td>
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

        {/* Gefahrgut-Hinweis block (only when positions have GHS data) */}
        {(() => {
          const gefahrPositionen = lieferung.positionen.filter((p) => {
            try {
              const k: string[] = JSON.parse(p.artikel.ghsKlassen || "[]");
              return k.length > 0;
            } catch { return false; }
          });
          if (gefahrPositionen.length === 0) return null;

          return (
            <div style={{ marginBottom: "32px", border: "1px solid #cc3300", borderRadius: "4px", padding: "12px" }}>
              <div style={{ fontWeight: "bold", fontSize: "10pt", color: "#cc3300", marginBottom: "8px" }}>
                ⚠ Sicherheitshinweise gemäß CLP-Verordnung
              </div>
              {gefahrPositionen.map((p) => {
                let klassen: string[] = [];
                try { klassen = JSON.parse(p.artikel.ghsKlassen || "[]"); } catch { /* ignore */ }
                const hSaetze = (p.artikel.hSaetze || "").trim();
                const pSaetze = (p.artikel.pSaetze || "").trim();
                return (
                  <div key={p.id} style={{ marginBottom: "8px", paddingBottom: "8px", borderBottom: "1px solid #f0d0d0" }}>
                    <div style={{ fontWeight: "600", fontSize: "9pt" }}>{p.artikel.name}</div>
                    <div style={{ fontSize: "8pt", marginTop: "2px" }}>
                      {klassen.map((k) => <GhsBadge key={k} klasse={k} />)}
                      {p.artikel.signalwort && (
                        <span style={{ color: "#cc3300", fontSize: "8pt", marginLeft: "4px", fontWeight: "600" }}>
                          {p.artikel.signalwort}
                        </span>
                      )}
                    </div>
                    {hSaetze && (
                      <div style={{ fontSize: "8pt", color: "#555", marginTop: "3px" }}>
                        <span style={{ fontWeight: "600" }}>H-Sätze: </span>{hSaetze}
                      </div>
                    )}
                    {pSaetze && (
                      <div style={{ fontSize: "8pt", color: "#555", marginTop: "2px" }}>
                        <span style={{ fontWeight: "600" }}>P-Sätze: </span>{pSaetze}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* ── DüV-Nährstoffdeklaration (§11 DüMV) ── */}
        {(() => {
          const posWithInhalt = lieferung.positionen.filter(
            (p) => p.artikel.inhaltsstoffe && p.artikel.inhaltsstoffe.length > 0
          );
          if (posWithInhalt.length === 0) return null;
          return (
            <div style={{ marginBottom: "32px", pageBreakInside: "avoid" }}>
              <div style={{ fontSize: "8pt", color: "#888", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Nährstoffdeklaration gem. DüMV / DüV
              </div>
              {posWithInhalt.map((pos) => (
                <div key={pos.id} style={{ marginBottom: "14px" }}>
                  <div style={{ fontSize: "9pt", fontWeight: 700, marginBottom: "4px", color: "#333" }}>
                    {pos.artikel.name} — Deklarierte Nährstoffe
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9pt" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #bbb", backgroundColor: "#f9f9f9" }}>
                        <th style={{ textAlign: "left", padding: "4px 8px", fontWeight: 600 }}>Nährstoff / Inhaltsstoff</th>
                        <th style={{ textAlign: "right", padding: "4px 8px", fontWeight: 600 }}>Gehalt</th>
                        <th style={{ textAlign: "left", padding: "4px 8px", fontWeight: 600 }}>Einheit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pos.artikel.inhaltsstoffe!.map((is) => (
                        <tr key={is.id} style={{ borderBottom: "1px solid #eee" }}>
                          <td style={{ padding: "3px 8px" }}>{is.name}</td>
                          <td style={{ padding: "3px 8px", textAlign: "right", fontFamily: "monospace" }}>
                            {is.menge != null ? is.menge.toLocaleString("de-DE") : "k.A."}
                          </td>
                          <td style={{ padding: "3px 8px", color: "#555" }}>{is.einheit ?? ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
              <div style={{ fontSize: "8pt", color: "#999", marginTop: "4px", borderTop: "1px solid #eee", paddingTop: "4px" }}>
                Angaben gem. Düngemittelverordnung (DüV) i.V.m. Verordnung (EG) Nr. 2003/2003 bzw. EU 2019/1009.
                Deklarierte Gehalte beziehen sich auf das Produkt in der gelieferten Form.
              </div>
            </div>
          );
        })()}

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

      {/* ── Digitale Unterschrift (nur am Bildschirm, nicht beim Drucken) ── */}
      <div className="print-hidden max-w-[210mm] mx-auto px-4 pb-10 mt-6">
        <div className="bg-white border-2 border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
            <svg className="w-5 h-5 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            <h3 className="font-semibold text-gray-800 text-sm">Digitale Kundenunterschrift</h3>
          </div>

          <div className="p-5">
            {/* Bereits gespeicherte Unterschrift anzeigen */}
            {lieferung.unterschriftPng && !unterschriftGespeichert ? (
              <div className="flex flex-col items-start gap-3">
                <div className="flex items-center gap-2 text-green-700 text-sm font-medium">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Unterschrift erhalten
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={lieferung.unterschriftPng}
                  alt="Gespeicherte Kundenunterschrift"
                  className="border border-gray-200 rounded-lg bg-white"
                  style={{ maxWidth: "400px", height: "150px", objectFit: "contain" }}
                />
                <button
                  onClick={() => {
                    if (confirm("Neue Unterschrift aufnehmen? Die bestehende wird überschrieben.")) {
                      setLieferung({ ...lieferung, unterschriftPng: null });
                      setTimeout(initCanvas, 50);
                    }
                  }}
                  className="text-xs text-gray-500 hover:text-gray-700 underline"
                >
                  Neue Unterschrift aufnehmen
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-gray-600">
                  Bitte hier unterschreiben, um den Erhalt der Lieferung zu bestätigen:
                </p>

                {/* Zeichenfläche */}
                <div className="border-2 border-dashed border-gray-300 rounded-xl overflow-hidden bg-white touch-none"
                  style={{ width: "100%", maxWidth: "400px" }}
                >
                  <canvas
                    ref={canvasRef}
                    width={400}
                    height={150}
                    className="block w-full cursor-crosshair"
                    style={{ touchAction: "none" }}
                  />
                </div>

                {/* Buttons */}
                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    type="button"
                    onClick={canvasLoeschen}
                    className="px-4 py-2.5 min-h-[44px] bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Löschen
                  </button>
                  <button
                    type="button"
                    onClick={unterschriftSpeichern}
                    disabled={unterschriftSaving}
                    className="px-4 py-2.5 min-h-[44px] bg-green-700 hover:bg-green-600 disabled:opacity-60 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
                  >
                    {unterschriftSaving ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        Speichern…
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Unterschrift speichern
                      </>
                    )}
                  </button>
                  {unterschriftMsg && (
                    <span className={`text-sm font-medium ${unterschriftMsg.includes("Fehler") || unterschriftMsg.includes("Netzwerk") ? "text-red-600" : "text-green-700"}`}>
                      {unterschriftMsg}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
