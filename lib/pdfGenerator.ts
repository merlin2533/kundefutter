/**
 * Serverseitige PDF-Generierung mit jsPDF.
 * Wird für automatischen Google-Drive-Upload bei Rechnungs- und Lieferschein-Erstellung genutzt.
 */

import { prisma } from "@/lib/prisma";
import { Sentry } from "@/lib/sentry";
import { formatDatum, formatEuro, rundeKaufmaennisch } from "@/lib/utils";
import { ladeFirmaDaten, type FirmaDaten } from "@/lib/firma";
import { liefposArtikelSelect, artikelWithInhaltSelect } from "@/lib/artikel-select";
import { erzeugeGiroCodeDataUrl } from "@/lib/girocode";
import { generateZugferdXml, type ZugferdData } from "@/lib/zugferd-xml";
import { embedZugferdInPdf } from "@/lib/zugferd-embed";
import { berechneLieferungBrutto } from "@/lib/lieferung-brutto";
import { parseMahnwesenConfig, mahngebuehr, berechneVerzugszinsen, MAHNUNG_BETREFF, mahnungTextBausteine } from "@/lib/mahnwesen-config";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type JsPDFWithAutoTable = jsPDF & { lastAutoTable: { finalY: number } };

// Oberer Rand, den autoTable auf Folgeseiten für eine Tabelle freihält (14 = Standard-
// Seitenrand + Platz für den per zeichneFortsetzungskopf() nachträglich gezeichneten
// Fortsetzungskopf inkl. Trennlinie). Ohne diesen Wert positioniert autoTable die erste
// Zeile einer Folgeseite bei y≈14mm — exakt dort, wo der Fortsetzungskopf gezeichnet wird.
const AUTOTABLE_TOP_MARGIN_FORTSETZUNG = 24;

interface LogoDaten {
  dataUrl: string;
  format: string;
}

/**
 * Lädt das Firmenlogo aus den Einstellungen (Key: system.logo).
 * Erwartet eine Base64-DataURL im Format data:image/<format>;base64,...
 */
async function ladeLogo(): Promise<LogoDaten | null> {
  const eintrag = await prisma.einstellung.findUnique({
    where: { key: "system.logo" },
  });
  const value = eintrag?.value;
  if (!value || !value.startsWith("data:image")) return null;
  const match = /^data:image\/([a-zA-Z0-9+.-]+);base64,/.exec(value);
  if (!match) return null;
  let format = match[1].toLowerCase();
  if (format === "jpeg") format = "jpg";
  if (format === "svg+xml") return null; // jsPDF unterstützt kein SVG
  if (!["png", "jpg", "webp"].includes(format)) return null;
  return { dataUrl: value, format };
}

const EIGENTUMSVORBEHALT_DEFAULT =
  "Die Ware bleibt bis zur vollständigen Bezahlung unser Eigentum.";

/**
 * Lädt den rechtlichen Hinweis "Eigentumsvorbehalt" aus den Einstellungen.
 * Fällt auf den Standardtext zurück.
 */
async function ladeEigentumsvorbehalt(): Promise<string> {
  const row = await prisma.einstellung.findUnique({
    where: { key: "dokument.rechnung.eigentumsvorbehalt" },
  });
  const value = row?.value?.trim();
  return value && value.length > 0 ? value : EIGENTUMSVORBEHALT_DEFAULT;
}

/**
 * Lädt die dokument.footer.* Einstellungen oder fällt auf Firmendaten zurück.
 * Spiegelt die Logik von components/DokumentFooter.tsx – buildFooterColumns().
 */
async function ladeFooterSpalten(firma: FirmaDaten): Promise<{ links: string; mitte: string; rechts: string }> {
  const rows = await prisma.einstellung.findMany({
    where: { key: { startsWith: "dokument.footer." } },
  });
  const cfg: Record<string, string> = {};
  for (const r of rows) cfg[r.key] = r.value;

  const links = cfg["dokument.footer.links"] ||
    [firma.name, firma.zusatz, firma.strasse, firma.plzOrt].filter(Boolean).join("\n");

  const mitte = cfg["dokument.footer.mitte"] ||
    [
      firma.telefon ? `Tel: ${firma.telefon}` : "",
      firma.email,
      firma.steuernummer ? `Steuernr.: ${firma.steuernummer}` : "",
      firma.ustIdNr ? `USt-IdNr.: ${firma.ustIdNr}` : "",
      firma.oekoNummer ? `Öko-Nr.: ${firma.oekoNummer}` : "",
    ].filter(Boolean).join("\n");

  const rechts = cfg["dokument.footer.rechts"] ||
    [
      firma.bank,
      firma.iban ? `IBAN: ${firma.iban}` : "",
      firma.bic ? `BIC: ${firma.bic}` : "",
    ].filter(Boolean).join("\n");

  return { links, mitte, rechts };
}

/**
 * Zeichnet zwei Falzmarken nach DIN 5008 am linken Seitenrand:
 * 1. Falzmarke bei 105 mm, 2. Falzmarke bei 210 mm (jeweils ab Seitenanfang).
 * Die Marken liegen im linken Randbereich (x 0–5 mm) außerhalb des Inhaltsbereichs.
 */
function zeichneFalzmarken(doc: jsPDF): void {
  doc.setDrawColor(170);
  doc.setLineWidth(0.15);
  doc.line(0, 105, 5, 105);
  doc.line(0, 210, 5, 210);
}

/**
 * Zeichnet ein großes, diagonales "STORNO"-Wasserzeichen quer über das Blatt.
 * Halbtransparent (sofern jsPDF GState unterstützt), damit der Rechnungsinhalt
 * lesbar bleibt. Wird für stornierte Rechnungen verwendet.
 */
function zeichneStornoWasserzeichen(doc: jsPDF, text = "STORNO"): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyDoc = doc as any;
  if (typeof anyDoc.saveGraphicsState === "function") anyDoc.saveGraphicsState();
  try {
    // Halbtransparent, damit Text darunter lesbar bleibt (nur wenn unterstützt)
    if (typeof anyDoc.setGState === "function" && typeof anyDoc.GState === "function") {
      anyDoc.setGState(new anyDoc.GState({ opacity: 0.18 }));
    }
    doc.setTextColor(220, 38, 38);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(96);
    // angle 45° → diagonal von unten-links nach oben-rechts quer übers Blatt
    doc.text(text, pageWidth / 2, pageHeight / 2, {
      align: "center",
      baseline: "middle",
      angle: 45,
    });
  } catch (e) {
    Sentry.captureException(e); // Wasserzeichen ist rein optisch – Fehler ignorieren
  } finally {
    if (typeof anyDoc.restoreGraphicsState === "function") anyDoc.restoreGraphicsState();
  }
}

/**
 * Zeichnet den 3-spaltigen Dokument-Footer am unteren Seitenrand.
 * Optional: direkt über dem Footer einen kleinen rechtlichen Hinweis (Eigentumsvorbehalt o.ä.).
 */
function zeichneDokumentFooter(
  doc: jsPDF,
  spalten: { links: string; mitte: string; rechts: string },
  hinweis?: string,
  seitenInfo?: string,
) {
  const pageHeight = doc.internal.pageSize.getHeight();
  const left = 14;
  const right = 196;
  const width = right - left;
  const colWidth = (width - 8) / 3;

  // Footer ist 6 Zeilen hoch (max), Zeilenhöhe 3.2 mm
  const zeilenHoehe = 3.2;
  const maxZeilen = Math.max(
    spalten.links.split("\n").length,
    spalten.mitte.split("\n").length,
    spalten.rechts.split("\n").length,
    1,
  );
  const footerHoehe = maxZeilen * zeilenHoehe + 4;
  const footerY = pageHeight - footerHoehe - 8;

  // Rechtlicher Hinweis über der Trennlinie (z.B. Eigentumsvorbehalt) + Seitenzahl
  if ((hinweis && hinweis.trim().length > 0) || seitenInfo) {
    doc.setFontSize(7);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(102);
    let hinweisHoehe = 3;
    if (hinweis && hinweis.trim().length > 0) {
      const hinweisLines = doc.splitTextToSize(hinweis, width) as string[];
      hinweisHoehe = hinweisLines.length * 3;
      const hinweisY = footerY - hinweisHoehe - 1;
      hinweisLines.forEach((line, i) => doc.text(line, left, hinweisY + i * 3));
    }
    if (seitenInfo) {
      doc.text(seitenInfo, right, footerY - hinweisHoehe - 1, { align: "right" });
    }
  }

  // Trennlinie
  doc.setDrawColor(187);
  doc.setLineWidth(0.2);
  doc.line(left, footerY, right, footerY);

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(102);

  const startY = footerY + 4;
  const links = spalten.links.split("\n");
  const mitte = spalten.mitte.split("\n");
  const rechts = spalten.rechts.split("\n");

  links.forEach((line, i) => doc.text(line, left, startY + i * zeilenHoehe));
  mitte.forEach((line, i) =>
    doc.text(line, left + colWidth + 4 + colWidth / 2, startY + i * zeilenHoehe, { align: "center" }),
  );
  rechts.forEach((line, i) => doc.text(line, right, startY + i * zeilenHoehe, { align: "right" }));
}

/**
 * Zeichnet die schlichte 2-zeilige Lieferschein-Fußzeile (Firmenname/Adresse,
 * Kontakt) relativ zur tatsächlichen Seitenhöhe – damit sie auf jeder Seite an
 * derselben Stelle sitzt, unabhängig davon, wie viele Seiten das Dokument hat.
 */
function zeichneLieferscheinFusszeile(doc: jsPDF, firma: FirmaDaten, seitenInfo?: string): void {
  const pageHeight = doc.internal.pageSize.getHeight();
  const lineY = pageHeight - 19;
  doc.setDrawColor(200);
  doc.setLineWidth(0.2);
  doc.line(14, lineY, 196, lineY);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120);
  const lsFooter = [firma.name, firma.strasse, firma.plzOrt].filter(Boolean).join(" · ");
  if (lsFooter) doc.text(lsFooter, 14, lineY + 5);
  const lsFooterKontakt = [
    firma.telefon && `Tel: ${firma.telefon}`,
    firma.email,
  ].filter(Boolean).join(" · ");
  if (lsFooterKontakt) doc.text(lsFooterKontakt, 14, lineY + 9);
  if (seitenInfo) doc.text(seitenInfo, 196, lineY + 9, { align: "right" });
}

/**
 * Sorgt dafür, dass ab der aktuellen Y-Position noch genügend Platz bis zur Fußzeile
 * bleibt. Reicht der Platz nicht, wird eine neue Seite begonnen. Verhindert, dass bei
 * langen Rechnungen/Lieferscheinen (viele Positionen, lange Hinweistexte) Inhalte über
 * den unteren Seitenrand hinaus- oder in die Fußzeile hineinlaufen.
 */
function sicherstellenPlatz(doc: jsPDF, y: number, benoetigterPlatz: number, footerReserve = 42): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + benoetigterPlatz > pageHeight - footerReserve) {
    doc.addPage();
    return 20;
  }
  return y;
}

/**
 * Schätzt die tatsächliche Höhe des Dokument-Footers (inkl. rechtlichem Hinweis wie
 * Eigentumsvorbehalt). Die Footer-Spalten (dokument.footer.links/mitte/rechts) sind
 * frei konfigurierbar und können beliebig viele Zeilen enthalten – ein fest verdrahteter
 * Platzhalter würde bei langen Footer-Texten dazu führen, dass Inhalte (Summenblock,
 * Zahlungsbox, Hinweise) in die Fußzeile hineinlaufen bzw. von ihr überdeckt werden.
 * Wird als dynamische `footerReserve` an sicherstellenPlatz() übergeben.
 */
function schaetzeFooterReserve(
  doc: jsPDF,
  spalten: { links: string; mitte: string; rechts: string },
  hinweis?: string,
): number {
  const zeilenHoehe = 3.2;
  const maxZeilen = Math.max(
    spalten.links.split("\n").length,
    spalten.mitte.split("\n").length,
    spalten.rechts.split("\n").length,
    1,
  );
  const footerHoehe = maxZeilen * zeilenHoehe + 4 + 8; // + Innenabstand + Abstand zur Trennlinie

  let hinweisHoehe = 0;
  if (hinweis && hinweis.trim().length > 0) {
    doc.setFontSize(7);
    doc.setFont("helvetica", "italic");
    const hinweisLines = doc.splitTextToSize(hinweis, 182) as string[];
    hinweisHoehe = hinweisLines.length * 3 + 1;
  }

  return footerHoehe + hinweisHoehe + 4; // + Sicherheitsabstand
}

/**
 * Zeichnet einen schlanken Kopf für Folgeseiten (Seite 2, 3, …) mehrseitiger Dokumente:
 * Firmenname links, Dokumenttitel/-nummer rechts, darunter eine dünne Trennlinie.
 * Ersetzt NICHT den vollständigen Briefkopf von Seite 1 (inkl. DIN-5008-Anschriftfeld),
 * der nur auf Seite 1 relevant ist – sorgt aber dafür, dass jede Folgeseite klar als
 * Teil desselben Dokuments erkennbar ist ("Kopf kommt auf jeder Seite sauber wieder").
 */
function zeichneFortsetzungskopf(doc: jsPDF, firmenname: string, titelZeile: string): void {
  const top = 14;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  if (firmenname) doc.text(firmenname, 14, top);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(85);
  doc.text(titelZeile, 196, top, { align: "right" });
  doc.setDrawColor(200);
  doc.setLineWidth(0.2);
  doc.line(14, top + 2.5, 196, top + 2.5);
}

/**
 * Vervollständigt ein mehrseitiges Dokument: läuft NACH dem Zeichnen des gesamten
 * Inhalts über alle bereits erzeugten Seiten und zeichnet auf JEDER Seite die
 * Fußzeile (+ optional Seitenzahl), auf Folgeseiten zusätzlich den schlanken
 * Fortsetzungskopf. So bleiben Kopf und Fuß bei mehrseitigen Rechnungen und
 * Lieferscheinen auf jeder Seite sauber sichtbar, unabhängig davon, wie viele
 * Seiten durch lange Positions-/Hinweistexte tatsächlich entstehen.
 */
function vervollstaendigeMehrseitigesDokument(
  doc: jsPDF,
  opts: {
    footerSpalten: { links: string; mitte: string; rechts: string };
    eigentumsvorbehalt?: string;
    firmenname?: string;
    fortsetzungsTitel?: string;
    wasserzeichen?: string;
  },
): void {
  const gesamtSeiten = doc.getNumberOfPages();
  for (let seite = 1; seite <= gesamtSeiten; seite++) {
    doc.setPage(seite);
    if (seite > 1 && opts.firmenname !== undefined && opts.fortsetzungsTitel) {
      zeichneFortsetzungskopf(doc, opts.firmenname, opts.fortsetzungsTitel);
    }
    zeichneDokumentFooter(
      doc,
      opts.footerSpalten,
      opts.eigentumsvorbehalt,
      gesamtSeiten > 1 ? `Seite ${seite} von ${gesamtSeiten}` : undefined,
    );
    if (opts.wasserzeichen) {
      zeichneStornoWasserzeichen(doc, opts.wasserzeichen);
    }
  }
}

/**
 * Generiert eine Rechnung als PDF-Buffer für die angegebene Lieferung.
 * Layout spiegelt die HTML-Vorschau unter /lieferungen/[id]/rechnung.
 * Die Lieferung muss bereits eine Rechnungsnummer besitzen.
 */
export async function generiereRechnungPdf(lieferungId: number): Promise<Buffer> {
  const lieferung = await prisma.lieferung.findUnique({
    where: { id: lieferungId },
    include: {
      kunde: { include: { kontakte: true } },
      positionen: { include: { artikel: { select: liefposArtikelSelect } } },
    },
  });
  if (!lieferung) throw new Error(`Lieferung ${lieferungId} nicht gefunden`);

  const FIRMA = await ladeFirmaDaten();
  const footerSpalten = await ladeFooterSpalten(FIRMA);
  const eigentumsvorbehalt = await ladeEigentumsvorbehalt();
  const logo = await ladeLogo();
  const doc = new jsPDF();
  zeichneFalzmarken(doc);
  // Footer-Texte sind frei konfigurierbar (dokument.footer.*, Eigentumsvorbehalt) und
  // können mehrzeilig/lang sein – Reserve dynamisch schätzen, damit Inhalte nie in die
  // (dann höhere) Fußzeile hineinlaufen.
  const footerReserve = schaetzeFooterReserve(doc, footerSpalten, eigentumsvorbehalt);

  // ── Farben (matches HTML-Preview) ────────────────────────────────────────────
  const COL_TEXT: [number, number, number] = [0, 0, 0];
  const COL_MUTED: [number, number, number] = [85, 85, 85];
  const COL_LABEL: [number, number, number] = [136, 136, 136];
  const COL_BORDER_STRONG: [number, number, number] = [34, 34, 34];
  const COL_TABLE_HEAD_BG: [number, number, number] = [245, 245, 245];
  const COL_ROW_ALT_BG: [number, number, number] = [250, 250, 250];
  const COL_BOX_BG: [number, number, number] = [249, 249, 249];
  const COL_BOX_BORDER: [number, number, number] = [221, 221, 221];

  const k = lieferung.kunde;
  const zahlungsziel = lieferung.zahlungsziel ?? 30;
  const rechnungDatum = lieferung.rechnungDatum
    ? new Date(lieferung.rechnungDatum)
    : new Date(lieferung.datum);
  const lieferDatum = lieferung.lieferDatum
    ? new Date(lieferung.lieferDatum)
    : new Date(lieferung.datum);
  const faelligDatum = new Date(rechnungDatum.getTime() + zahlungsziel * 24 * 60 * 60 * 1000);

  // ── Kopfbereich: Logo + Firmenname links, Rechnungs-Meta rechts ─────────────
  let logoBreiteMm = 0;
  if (logo) {
    try {
      const format = logo.format.toUpperCase() === "JPG" ? "JPEG" : logo.format.toUpperCase();
      doc.addImage(logo.dataUrl, format, 14, 14, 40, 20, undefined, "FAST");
      logoBreiteMm = 40;
    } catch (e) {
      Sentry.captureException(e); // Ungültiges Bildformat - ignorieren
    }
  }

  // Firmenname unter Logo (fett, 13pt)
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COL_TEXT);
  if (FIRMA.name) doc.text(FIRMA.name, 14, logoBreiteMm > 0 ? 40 : 20);

  // "Rechnung" Titel oben rechts — bei stornierter Rechnung "Stornorechnung" statt
  // "Rechnung" (zusätzlich zum diagonalen STORNO-Wasserzeichen weiter unten), damit auch
  // eine schwarz-weiß gedruckte oder ohne Wasserzeichen-Transparenz dargestellte Kopie
  // auf den ersten Blick eindeutig als Storno erkennbar ist.
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COL_TEXT);
  doc.text(lieferung.rechnungStorniert ? "Stornorechnung" : "Rechnung", 196, 20, { align: "right" });

  // Meta-Tabelle (Rechnungsnummer, Rechnungsdatum, Fällig am)
  // Start bei y=27 (nicht y=23!): der 20pt-fette "Rechnung"-Titel bei y=20 hat einen
  // Unterlängen-Buchstaben (das "g"), der bis knapp unter y=22 reicht — bei y=23 lief
  // die erste Meta-Zeile sichtbar in den Titel hinein. y=27 hält denselben Abstand wie
  // die Titel/Meta-Lücke bei Angebot/Gutschrift und bleibt trotzdem deutlich oberhalb
  // des Anschriftfelds (Fenster ab 45 mm).
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  let metaY = 27;
  const metaLabelX = 155;
  const metaValueX = 196;
  const drawMetaZeile = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COL_MUTED);
    doc.text(label, metaLabelX, metaY, { align: "right" });
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setTextColor(...COL_TEXT);
    doc.text(value, metaValueX, metaY, { align: "right" });
    metaY += 3.4;
  };
  drawMetaZeile("Rechnungsnummer:", lieferung.rechnungNr ?? "—", true);
  drawMetaZeile("Rechnungsdatum:", formatDatum(rechnungDatum));
  drawMetaZeile("Lieferschein-Nr.:", lieferung.lieferscheinNr?.trim() || String(lieferung.id));
  drawMetaZeile("Lieferdatum:", formatDatum(lieferDatum));
  drawMetaZeile("Fällig am:", formatDatum(faelligDatum), true);

  // (Trennlinie unter dem Kopf entfernt – Kundenwunsch: kein dicker Strich in der Kopfzeile)

  // ── Anschriftfeld nach DIN 5008 / Binect (Fensterkuvert) ────────────────────
  // Maßgabe (Binect): linker Rand 20 mm, Oberkante des Anschriftfelds bei 45 mm,
  // Gesamthöhe 45 mm (also bis 90 mm), Breite ≤ 90 mm.
  //   • Zusatz-/Absenderzone 45–55 mm  → kleine Absenderzeile
  //   • Anschriftzone ab 55 mm          → Empfängeranschrift
  // Im Anschriftfeld (20–105 mm × 45–90 mm) darf NICHTS außer Absender + Empfänger
  // stehen. Feste mm-Positionen, damit die Adresse unabhängig von der Kopfhöhe
  // immer mittig im Sichtfenster liegt.
  const ADRESS_X = 20;
  const absenderParts = [FIRMA.name, FIRMA.strasse, FIRMA.plzOrt].filter(Boolean);
  if (absenderParts.length > 0) {
    const absenderText = absenderParts.join(" · ");
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COL_LABEL);
    // Absenderzeile in der Zusatzzone (45–55 mm)
    doc.text(absenderText, ADRESS_X, 49, { maxWidth: 85 });
    const lineWidth = Math.min(doc.getTextWidth(absenderText), 85);
    doc.setDrawColor(...COL_LABEL);
    doc.setLineWidth(0.25);
    doc.line(ADRESS_X, 50.5, ADRESS_X + lineWidth, 50.5);
  }

  // Empfängeranschrift ab 55 mm (Anschriftzone)
  let ey = 57;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COL_TEXT);
  doc.text(k.firma ?? k.name, ADRESS_X, ey);
  ey += 5;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COL_TEXT);
  if (k.firma) { doc.text(k.name, ADRESS_X, ey); ey += 5; }
  if (k.strasse) { doc.text(k.strasse, ADRESS_X, ey); ey += 5; }
  if (k.plz || k.ort) {
    doc.text([k.plz, k.ort].filter(Boolean).join(" "), ADRESS_X, ey);
    ey += 5;
  }

  // ── Betreff (unterhalb des Anschriftfelds, ab 95 mm – außerhalb des Fensters) ─
  ey = Math.max(ey + 8, 95);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COL_TEXT);
  doc.text(`Betreff: Rechnung ${lieferung.rechnungNr ?? ""}`.trim(), 14, ey);
  ey += 6;

  // ── Positionen-Tabelle ──────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const positionen = lieferung.positionen as any[];
  const hatRabatt = positionen.some((p) => (p.rabattProzent ?? 0) > 0);
  const hatCharge = positionen.some((p) => p.chargeNr);

  const headCols = ["Pos.", "Artikel"];
  if (hatCharge) headCols.push("Charge");
  headCols.push("Menge", "Einheit", "Einzelpreis");
  if (hatRabatt) headCols.push("Rabatt %");
  headCols.push("Gesamt");
  const head = [headCols];

  const body = positionen.map((p, i) => {
    const netto = p.menge * p.verkaufspreis * (1 - (p.rabattProzent ?? 0) / 100);
    const posNotiz = typeof p.notiz === "string" ? p.notiz.trim() : "";
    const posMwstSatz = p.mwstSatz ?? p.artikel.mwstSatz ?? 19;
    const artikelZelle = posNotiz
      ? `${p.artikel.name}\n${posNotiz}\nMwSt ${posMwstSatz} %`
      : `${p.artikel.name}\nMwSt ${posMwstSatz} %`;
    const mengeStr = p.menge.toLocaleString("de-DE", { maximumFractionDigits: 3 });
    const base = [String(i + 1), artikelZelle];
    if (hatCharge) base.push(p.chargeNr ?? "—");
    base.push(mengeStr, p.artikel.einheit, formatEuro(p.verkaufspreis));
    if (hatRabatt) {
      base.push((p.rabattProzent ?? 0) > 0 ? `${p.rabattProzent} %` : "");
    }
    base.push(formatEuro(netto));
    return base;
  });

  // Spaltenbreiten dynamisch je nach optionalen Charge-/Rabatt-Spalten
  type ColStyle = { cellWidth?: number | "auto"; halign?: "left" | "center" | "right" | "justify" };
  const columnStyles: Record<number, ColStyle> = {};
  let ci = 0;
  columnStyles[ci++] = { cellWidth: 16 };                 // Pos.
  columnStyles[ci++] = { cellWidth: "auto" };             // Artikel
  if (hatCharge) columnStyles[ci++] = { cellWidth: 24 };  // Charge
  columnStyles[ci++] = { halign: "right", cellWidth: 18 };// Menge
  columnStyles[ci++] = { cellWidth: 20 };                 // Einheit
  columnStyles[ci++] = { halign: "right", cellWidth: 24 };// Einzelpreis
  if (hatRabatt) columnStyles[ci++] = { halign: "right", cellWidth: 20 }; // Rabatt %
  columnStyles[ci++] = { halign: "right", cellWidth: 26 };// Gesamt

  autoTable(doc, {
    startY: ey + 2,
    head,
    body,
    theme: "plain",
    // Bottom-Rand = tatsächliche Fußzeilenhöhe (dynamisch, s. schaetzeFooterReserve), sonst
    // platziert autoTable Zeilen näher am Seitenende als die später gezeichnete Fußzeile
    // Platz braucht → Überlappung von Zeilentext und Fußzeile beim Seitenumbruch.
    margin: { top: AUTOTABLE_TOP_MARGIN_FORTSETZUNG, right: 14, bottom: footerReserve, left: 14 },
    // Verhindert, dass eine einzelne Zeile (mehrzeilige Artikelzelle) mitten im Text über
    // einen Seitenumbruch hinweg aufgeteilt wird — die ganze Zeile wandert stattdessen
    // gemeinsam auf die nächste Seite.
    rowPageBreak: "avoid",
    headStyles: {
      fillColor: COL_TABLE_HEAD_BG,
      textColor: [51, 51, 51],
      fontStyle: "bold",
      lineColor: [51, 51, 51],
      lineWidth: 0.3,
    },
    alternateRowStyles: { fillColor: COL_ROW_ALT_BG },
    styles: {
      fontSize: 9,
      cellPadding: { top: 2, right: 3, bottom: 2, left: 3 },
      lineColor: [221, 221, 221],
      lineWidth: 0.1,
      textColor: [0, 0, 0],
      valign: "top",
    },
    columnStyles,
  });

  const finalY = (doc as JsPDFWithAutoTable).lastAutoTable.finalY + 4;

  // ── Summenblock rechtsbündig ────────────────────────────────────────────────
  const mwstGruppen = new Map<number, number>();
  let nettoGesamt = 0;
  for (const p of positionen) {
    const netto = p.menge * p.verkaufspreis * (1 - (p.rabattProzent ?? 0) / 100);
    nettoGesamt += netto;
    const satz = p.mwstSatz ?? p.artikel.mwstSatz ?? 19;
    mwstGruppen.set(satz, (mwstGruppen.get(satz) ?? 0) + netto);
  }
  let mwstGesamt = 0;
  for (const [satz, basis] of mwstGruppen) {
    mwstGesamt += basis * (satz / 100);
  }
  const brutto = rundeKaufmaennisch(nettoGesamt + mwstGesamt, 2);

  const sumLabelX = 140;
  const sumValueX = 196;
  // Reicht der Platz bis zur Fußzeile nicht mehr für den Summenblock, neue Seite beginnen –
  // verhindert, dass Netto-/MwSt-/Bruttozeilen bei langen Rechnungen abgeschnitten werden.
  const summenHoehe = (2 + mwstGruppen.size) * 6 + 6;
  let sumY = sicherstellenPlatz(doc, finalY, summenHoehe, footerReserve) + 2;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(68);
  doc.text("Nettobetrag:", sumLabelX, sumY);
  doc.setTextColor(...COL_TEXT);
  doc.text(formatEuro(nettoGesamt), sumValueX, sumY, { align: "right" });
  sumY += 5.5;

  const sortedSaetze = Array.from(mwstGruppen.entries()).sort(([a], [b]) => a - b);
  for (const [satz, basis] of sortedSaetze) {
    doc.setTextColor(68);
    doc.text(`MwSt ${satz} %:`, sumLabelX, sumY);
    doc.setTextColor(...COL_TEXT);
    doc.text(formatEuro(basis * (satz / 100)), sumValueX, sumY, { align: "right" });
    sumY += 5.5;
  }

  doc.setDrawColor(...COL_BORDER_STRONG);
  doc.setLineWidth(0.5);
  doc.line(sumLabelX, sumY, sumValueX, sumY);
  sumY += 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...COL_TEXT);
  doc.text("Bruttobetrag:", sumLabelX, sumY);
  doc.text(formatEuro(brutto), sumValueX, sumY, { align: "right" });
  sumY += 8;

  // ── Notiz / Hinweis zur Lieferung (vor der Zahlungsbox, damit immer sichtbar) ──
  if (lieferung.notiz && lieferung.notiz.trim().length > 0) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(...COL_MUTED);
    const notizLines = doc.splitTextToSize(`Hinweis: ${lieferung.notiz.trim()}`, 182) as string[];
    sumY = sicherstellenPlatz(doc, sumY, notizLines.length * 4 + 2, footerReserve);
    notizLines.forEach((line, i) => doc.text(line, 14, sumY + i * 4));
    sumY += notizLines.length * 4 + 2;
  }

  // ── Zahlungsinformationen Box ───────────────────────────────────────────────
  // GiroCode-Bilddaten + alle Textzeilen VOR dem Zeichnen des Rahmens ermitteln,
  // damit die Box mit dem Inhalt mitwächst (fixe Höhe hätte bei zusätzlichem
  // Skonto-Hinweis überlaufen können) statt einer festen Höhe.
  const boxX = 14;
  const boxW = 182;

  let giroCode: string | null = null;
  if (FIRMA.iban && FIRMA.name) {
    giroCode = await erzeugeGiroCodeDataUrl({
      empfaenger: FIRMA.name,
      iban: FIRMA.iban,
      bic: FIRMA.bic,
      betrag: brutto,
      verwendungszweck: `Rechnung ${lieferung.rechnungNr ?? ""}`.trim(),
    });
  }
  const textMaxWidth = giroCode ? boxW - 40 : boxW - 8;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const zahlText =
    `Bitte überweisen Sie den Betrag von ${formatEuro(brutto)} bis zum ${formatDatum(faelligDatum)} ` +
    `unter Angabe der Rechnungsnummer ${lieferung.rechnungNr ?? ""}.`;
  const zahlLines = doc.splitTextToSize(zahlText, textMaxWidth) as string[];

  // Skonto nur wenn Prozent UND Frist gepflegt sind — Basisdatum/-berechnung identisch
  // zum Skonto-Abschnitt der Lieferungs-Detailseite (app/lieferungen/[id]/page.tsx).
  let skontoLines: string[] = [];
  if (lieferung.skontoProzent != null && lieferung.skontoTage != null) {
    const skontoFaellig = new Date(rechnungDatum.getTime() + lieferung.skontoTage * 24 * 60 * 60 * 1000);
    const skontobetrag = brutto * (lieferung.skontoProzent / 100);
    const skontoText =
      `Bei Zahlung bis zum ${formatDatum(skontoFaellig)} gewähren wir ${lieferung.skontoProzent}% Skonto ` +
      `(${formatEuro(skontobetrag)}).`;
    skontoLines = doc.splitTextToSize(skontoText, textMaxWidth) as string[];
  }

  const bankZeile1 = FIRMA.bank ? `Bank: ${FIRMA.bank}` : "";
  const bankZeile2 = [
    FIRMA.iban ? `IBAN: ${FIRMA.iban}` : "",
    FIRMA.bic ? `BIC: ${FIRMA.bic}` : "",
  ].filter(Boolean).join("    ");
  const bankLinesCount = (bankZeile1 ? 1 : 0) + (bankZeile2 ? 1 : 0);

  const boxH = 12 + (zahlLines.length + skontoLines.length) * 4 + (bankLinesCount > 0 ? bankLinesCount * 4 + 2 : 0);
  sumY = sicherstellenPlatz(doc, sumY, boxH + 4, footerReserve);
  const boxY = sumY + 4;

  // Hintergrund + Rahmen
  doc.setDrawColor(...COL_BOX_BORDER);
  doc.setFillColor(...COL_BOX_BG);
  doc.setLineWidth(0.2);
  doc.roundedRect(boxX, boxY, boxW, boxH, 1.5, 1.5, "FD");

  // GiroCode optional rechts in der Box
  if (giroCode) {
    try {
      const qrSize = 26;
      const qrX = boxX + boxW - qrSize - 4;
      const qrY = boxY + 3;
      doc.addImage(giroCode, "PNG", qrX, qrY, qrSize, qrSize, undefined, "FAST");
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(120);
      doc.text("Scan & Pay", qrX + qrSize / 2, qrY + qrSize + 3, { align: "center" });
    } catch (e) {
      Sentry.captureException(e); // Bild-Einbettung fehlgeschlagen – ignorieren
    }
  }

  // Text in der Box links
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COL_TEXT);
  doc.text("Zahlungsinformationen", boxX + 4, boxY + 6);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(51);
  let zeileY = boxY + 12;
  zahlLines.forEach((line) => { doc.text(line, boxX + 4, zeileY); zeileY += 4; });
  skontoLines.forEach((line) => { doc.text(line, boxX + 4, zeileY); zeileY += 4; });

  if (bankZeile1) {
    doc.text(bankZeile1, boxX + 4, zeileY + 2);
  }
  if (bankZeile2) {
    doc.text(bankZeile2, boxX + 4, zeileY + 2 + (bankZeile1 ? 4 : 0));
  }

  // ── Dokument-Footer (3-spaltig) + Fortsetzungskopf auf JEDER Seite; STORNO-Wasserzeichen
  //    auf allen Seiten, falls die Rechnung storniert ist. ────────────────────────
  vervollstaendigeMehrseitigesDokument(doc, {
    footerSpalten,
    eigentumsvorbehalt,
    firmenname: FIRMA.name,
    fortsetzungsTitel: `Rechnung ${lieferung.rechnungNr ?? ""} – Fortsetzung`.trim(),
    wasserzeichen: lieferung.rechnungStorniert ? "STORNO" : undefined,
  });

  return Buffer.from(doc.output("arraybuffer"));
}

/**
 * Generiert einen Lieferschein als PDF-Buffer (ohne Preise, mit Unterschriftsfeld).
 */
export async function generiereLieferscheinPdf(lieferungId: number): Promise<Buffer> {
  const lieferung = await prisma.lieferung.findUnique({
    where: { id: lieferungId },
    include: {
      kunde: { include: { kontakte: true } },
      positionen: { include: { artikel: artikelWithInhaltSelect } },
    },
  });
  if (!lieferung) throw new Error(`Lieferung ${lieferungId} nicht gefunden`);

  const FIRMA = await ladeFirmaDaten();
  const logo = await ladeLogo();
  const doc = new jsPDF();
  zeichneFalzmarken(doc);
  const k = lieferung.kunde;

  // ── Logo oben links ─────────────────────────────────────────────────────────
  let logoBreiteMm = 0;
  if (logo) {
    try {
      const format = logo.format.toUpperCase() === "JPG" ? "JPEG" : logo.format.toUpperCase();
      doc.addImage(logo.dataUrl, format, 14, 12, 45, 22, undefined, "FAST");
      logoBreiteMm = 45;
    } catch (e) {
      Sentry.captureException(e);
    }
  }

  // ── Header: Firmenname links, Lieferschein-Titel rechts ─────────────────────
  const headerX = logoBreiteMm > 0 ? 65 : 14;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(22, 101, 52);
  doc.text(FIRMA.name, headerX, 18);

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80);
  let lsKopfY = 24;
  if (FIRMA.zusatz) { doc.text(FIRMA.zusatz, headerX, lsKopfY); lsKopfY += 4; }
  const lsAdress = [FIRMA.strasse, FIRMA.plzOrt].filter(Boolean);
  if (lsAdress.length) { doc.text(lsAdress.join(" · "), headerX, lsKopfY); lsKopfY += 4; }
  const lsKontakt = [FIRMA.telefon && `Tel: ${FIRMA.telefon}`, FIRMA.email].filter(Boolean) as string[];
  if (lsKontakt.length) doc.text(lsKontakt.join(" · "), headerX, lsKopfY);

  // Titel oben rechts
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  doc.text("Lieferschein", 196, 18, { align: "right" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60);
  doc.text(`Nr.: ${lieferung.lieferscheinNr?.trim() || lieferung.id}`, 196, 26, { align: "right" });
  doc.text(`Lieferdatum: ${formatDatum(lieferung.datum)}`, 196, 31, { align: "right" });

  doc.setDrawColor(22, 101, 52);
  doc.setLineWidth(0.5);
  doc.line(14, 40, 196, 40);

  // ── Empfänger ───────────────────────────────────────────────────────────────
  const telefon = k.kontakte?.find((c: { typ: string; wert: string }) => c.typ === "telefon" || c.typ === "mobil")?.wert;
  const email = k.kontakte?.find((c: { typ: string; wert: string }) => c.typ === "email")?.wert;

  doc.setFontSize(7);
  doc.setTextColor(120);
  doc.text("Empfänger", 14, 48);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  doc.text(k.firma ?? k.name, 14, 55);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  let empfY = 60;
  if (k.firma) { doc.text(k.name, 14, empfY); empfY += 5; }
  if (k.strasse) { doc.text(k.strasse, 14, empfY); empfY += 5; }
  if (k.plz || k.ort) { doc.text([k.plz, k.ort].filter(Boolean).join(" "), 14, empfY); empfY += 5; }
  if (telefon) { doc.setTextColor(80); doc.text(`Tel.: ${telefon}`, 14, empfY); empfY += 5; }
  if (email) { doc.text(email, 14, empfY); }

  // ── Lieferadresse (falls abweichend) ────────────────────────────────────────
  let tabelleStart = 78;
  if ((lieferung as { lieferadresse?: string | null }).lieferadresse) {
    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.text("Lieferadresse", 120, 48);
    doc.setFontSize(9);
    doc.setTextColor(0);
    doc.setFont("helvetica", "normal");
    const lzLines = doc.splitTextToSize(
      (lieferung as { lieferadresse?: string | null }).lieferadresse as string,
      73,
    ) as string[];
    lzLines.forEach((line: string, i: number) => doc.text(line, 120, 55 + i * 5));
    tabelleStart = Math.max(tabelleStart, 55 + lzLines.length * 5 + 8);
  }

  // ── Positionen ──────────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const positionen = lieferung.positionen as any[];
  const hasCharge = positionen.some((p) => p.chargeNr);
  const lsHead = hasCharge
    ? [["Pos.", "Bezeichnung", "Charge", "Menge", "Einheit"]]
    : [["Pos.", "Bezeichnung", "Menge", "Einheit"]];
  const lsBody = positionen.map((p, i) =>
    hasCharge
      ? [String(i + 1), p.artikel.name, p.chargeNr ?? "—", p.menge.toLocaleString("de-DE"), p.artikel.einheit]
      : [String(i + 1), p.artikel.name, p.menge.toLocaleString("de-DE"), p.artikel.einheit],
  );
  autoTable(doc, {
    startY: tabelleStart,
    head: lsHead,
    body: lsBody,
    // Bottom-Rand reserviert Platz für die nachträglich gezeichnete Lieferschein-Fußzeile
    // (zeichneLieferscheinFusszeile beginnt bei pageHeight-19), Top-Rand für den
    // Fortsetzungskopf auf Folgeseiten — verhindert Überlappung beim Seitenumbruch.
    margin: { top: AUTOTABLE_TOP_MARGIN_FORTSETZUNG, right: 14, bottom: 26, left: 14 },
    rowPageBreak: "avoid",
    headStyles: { fillColor: [22, 101, 52] },
    styles: { fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 16 },
      [hasCharge ? 3 : 2]: { halign: "right" },
    },
  });

  const pageHeight = doc.internal.pageSize.getHeight();
  let yPos = (doc as JsPDFWithAutoTable).lastAutoTable.finalY + 8;

  // ── Bemerkung / Notiz (wie in der Bildschirm-Vorschau) ───────────────────────
  if (lieferung.notiz && lieferung.notiz.trim().length > 0) {
    if (yPos > pageHeight - 50) { doc.addPage(); yPos = 20; }
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120);
    doc.text("BEMERKUNG", 14, yPos);
    yPos += 5;
    doc.setFontSize(9);
    doc.setTextColor(0);
    const notizLines = doc.splitTextToSize(lieferung.notiz.trim(), 182) as string[];
    notizLines.forEach((line, i) => doc.text(line, 14, yPos + i * 4));
    yPos += notizLines.length * 4 + 6;
  }

  // ── Nährstoffdeklaration gem. DüMV / DüV (deklarierte Inhaltsstoffe) ──────────
  const posMitInhalt = positionen.filter(
    (p) => Array.isArray(p.artikel.inhaltsstoffe) && p.artikel.inhaltsstoffe.length > 0,
  );
  if (posMitInhalt.length > 0) {
    if (yPos > pageHeight - 50) { doc.addPage(); yPos = 20; }
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120);
    doc.text("NÄHRSTOFFDEKLARATION GEM. DÜMV / DÜV", 14, yPos);
    yPos += 4;

    for (const pos of posMitInhalt) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const inhaltBody = (pos.artikel.inhaltsstoffe as any[]).map((is) => [
        String(is.name ?? ""),
        is.menge != null ? Number(is.menge).toLocaleString("de-DE") : "k.A.",
        String(is.einheit ?? ""),
      ]);
      autoTable(doc, {
        startY: yPos,
        head: [[`${pos.artikel.name} — Deklarierte Nährstoffe`, "Gehalt", "Einheit"]],
        body: inhaltBody,
        theme: "plain",
        headStyles: { fillColor: [249, 249, 249], textColor: [51, 51, 51], fontStyle: "bold", lineColor: [187, 187, 187], lineWidth: 0.2 },
        styles: { fontSize: 8, cellPadding: { top: 1.5, right: 3, bottom: 1.5, left: 3 }, lineColor: [238, 238, 238], lineWidth: 0.1, textColor: [0, 0, 0] },
        columnStyles: { 1: { halign: "right", cellWidth: 28 }, 2: { cellWidth: 24 } },
        margin: { left: 14, right: 14 },
      });
      yPos = (doc as JsPDFWithAutoTable).lastAutoTable.finalY + 4;
    }

    if (yPos > pageHeight - 30) { doc.addPage(); yPos = 20; }
    doc.setFontSize(7);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(150);
    const disclaimer =
      "Angaben gem. Düngemittelverordnung (DüV) i.V.m. Verordnung (EG) Nr. 2003/2003 bzw. EU 2019/1009. " +
      "Deklarierte Gehalte beziehen sich auf das Produkt in der gelieferten Form.";
    const discLines = doc.splitTextToSize(disclaimer, 182) as string[];
    discLines.forEach((line, i) => doc.text(line, 14, yPos + i * 3));
    yPos += discLines.length * 3 + 4;
    doc.setFont("helvetica", "normal");
  }

  // ── Unterschriftsfeld ───────────────────────────────────────────────────────
  let finalY = yPos + 4;
  if (finalY > pageHeight - 50) { doc.addPage(); finalY = 30; }
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text("Erhalten am: _______________", 14, finalY + 15);
  doc.text("Unterschrift Empfänger:", 110, finalY + 15);
  doc.setLineWidth(0.3);
  doc.line(14, finalY + 28, 90, finalY + 28);
  doc.line(110, finalY + 28, 196, finalY + 28);
  doc.text("Datum", 14, finalY + 33);
  doc.text("Ort / Datum / Unterschrift", 110, finalY + 33);

  // ── Fußzeile auf JEDER Seite + schlanker Fortsetzungskopf ab Seite 2 ─────────
  // (autoTable kann die Positionstabelle selbst über mehrere Seiten verteilen –
  // ohne diese Schleife hätten Folgeseiten weder Kopf noch Fußzeile.)
  const lieferscheinNrAnzeige = lieferung.lieferscheinNr?.trim() || String(lieferung.id);
  const gesamtSeitenLs = doc.getNumberOfPages();
  for (let seite = 1; seite <= gesamtSeitenLs; seite++) {
    doc.setPage(seite);
    if (seite > 1) {
      zeichneFortsetzungskopf(doc, FIRMA.name, `Lieferschein ${lieferscheinNrAnzeige} – Fortsetzung`);
    }
    zeichneLieferscheinFusszeile(doc, FIRMA, gesamtSeitenLs > 1 ? `Seite ${seite} von ${gesamtSeitenLs}` : undefined);
  }

  return Buffer.from(doc.output("arraybuffer"));
}

/**
 * Generiert ein Angebot als PDF-Buffer.
 */
export async function generiereAngebotPdf(angebotId: number): Promise<Buffer> {
  const angebot = await prisma.angebot.findUnique({
    where: { id: angebotId },
    include: {
      kunde: { include: { kontakte: true } },
      positionen: { include: { artikel: { select: { id: true, name: true, einheit: true, mwstSatz: true } } } },
    },
  });
  if (!angebot) throw new Error(`Angebot ${angebotId} nicht gefunden`);

  const FIRMA = await ladeFirmaDaten();
  const footerSpalten = await ladeFooterSpalten(FIRMA);
  const logo = await ladeLogo();
  const doc = new jsPDF();
  zeichneFalzmarken(doc);
  const footerReserve = schaetzeFooterReserve(doc, footerSpalten);

  const COL_TEXT: [number, number, number] = [0, 0, 0];
  const COL_MUTED: [number, number, number] = [85, 85, 85];
  const COL_LABEL: [number, number, number] = [136, 136, 136];
  const COL_BORDER_STRONG: [number, number, number] = [34, 34, 34];
  const COL_TABLE_HEAD_BG: [number, number, number] = [245, 245, 245];
  const COL_ROW_ALT_BG: [number, number, number] = [250, 250, 250];

  const k = angebot.kunde;
  const angebotDatum = new Date(angebot.datum);
  const gueltigBis = angebot.gueltigBis ? new Date(angebot.gueltigBis) : null;

  let logoBreiteMm = 0;
  if (logo) {
    try {
      const format = logo.format.toUpperCase() === "JPG" ? "JPEG" : logo.format.toUpperCase();
      doc.addImage(logo.dataUrl, format, 14, 14, 40, 20, undefined, "FAST");
      logoBreiteMm = 40;
    } catch (e) {
      Sentry.captureException(e);
    }
  }

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COL_TEXT);
  if (FIRMA.name) doc.text(FIRMA.name, 14, logoBreiteMm > 0 ? 40 : 20);

  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COL_TEXT);
  doc.text("Angebot", 196, 20, { align: "right" });

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  let metaY = 27;
  const metaLabelX = 155;
  const metaValueX = 196;
  const drawMetaAngebot = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COL_MUTED);
    doc.text(label, metaLabelX, metaY, { align: "right" });
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setTextColor(...COL_TEXT);
    doc.text(value, metaValueX, metaY, { align: "right" });
    metaY += 5;
  };
  drawMetaAngebot("Angebotsnummer:", angebot.nummer, true);
  drawMetaAngebot("Datum:", formatDatum(angebotDatum));
  if (gueltigBis) drawMetaAngebot("Gültig bis:", formatDatum(gueltigBis), true);

  const sepY = Math.max(metaY + 2, 44);
  doc.setDrawColor(...COL_BORDER_STRONG);
  doc.setLineWidth(0.6);
  doc.line(14, sepY, 196, sepY);

  let ey = sepY + 10;
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COL_LABEL);
  doc.text("ANGEBOTSEMPFÄNGER", 14, ey);
  ey += 5;

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COL_TEXT);
  doc.text(k.firma ?? k.name, 14, ey);
  ey += 5;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  if (k.firma) { doc.text(k.name, 14, ey); ey += 5; }
  if (k.strasse) { doc.text(k.strasse, 14, ey); ey += 5; }
  if (k.plz || k.ort) { doc.text([k.plz, k.ort].filter(Boolean).join(" "), 14, ey); ey += 5; }

  ey += 8;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COL_TEXT);
  doc.text(`Betreff: Angebot ${angebot.nummer}`, 14, ey);
  ey += 6;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const positionen = angebot.positionen as any[];
  const hatRabatt = positionen.some((p) => (p.rabatt ?? 0) > 0);
  const angebotHead = hatRabatt
    ? [["Pos.", "Artikel", "Menge", "Einheit", "Einzelpreis", "Rabatt %", "Gesamt"]]
    : [["Pos.", "Artikel", "Menge", "Einheit", "Einzelpreis", "Gesamt"]];
  const angebotBody = positionen.map((p, i) => {
    const netto = p.menge * p.preis * (1 - (p.rabatt ?? 0) / 100);
    const mengeStr = p.menge.toLocaleString("de-DE", { maximumFractionDigits: 3 });
    const base = [String(i + 1), p.artikel.name, mengeStr, p.einheit ?? p.artikel.einheit, formatEuro(p.preis)];
    if (hatRabatt) base.push((p.rabatt ?? 0) > 0 ? `${p.rabatt} %` : "");
    base.push(formatEuro(netto));
    return base;
  });

  autoTable(doc, {
    startY: ey + 2,
    head: angebotHead,
    body: angebotBody,
    theme: "plain",
    margin: { top: AUTOTABLE_TOP_MARGIN_FORTSETZUNG, right: 14, bottom: footerReserve, left: 14 },
    // Verhindert, dass eine einzelne Zeile (mehrzeilige Artikelzelle) mitten im Text über
    // einen Seitenumbruch hinweg aufgeteilt wird — die ganze Zeile wandert stattdessen
    // gemeinsam auf die nächste Seite.
    rowPageBreak: "avoid",
    headStyles: { fillColor: COL_TABLE_HEAD_BG, textColor: [51, 51, 51], fontStyle: "bold", lineColor: [51, 51, 51], lineWidth: 0.3 },
    alternateRowStyles: { fillColor: COL_ROW_ALT_BG },
    styles: { fontSize: 9, cellPadding: { top: 2, right: 3, bottom: 2, left: 3 }, lineColor: [221, 221, 221], lineWidth: 0.1, textColor: [0, 0, 0], valign: "top" },
    columnStyles: hatRabatt
      ? { 0: { cellWidth: 16 }, 1: { cellWidth: "auto" }, 2: { halign: "right", cellWidth: 18 }, 3: { cellWidth: 20 }, 4: { halign: "right", cellWidth: 24 }, 5: { halign: "right", cellWidth: 20 }, 6: { halign: "right", cellWidth: 26 } }
      : { 0: { cellWidth: 16 }, 1: { cellWidth: "auto" }, 2: { halign: "right", cellWidth: 20 }, 3: { cellWidth: 18 }, 4: { halign: "right", cellWidth: 28 }, 5: { halign: "right", cellWidth: 28 } },
  });

  const finalY = (doc as JsPDFWithAutoTable).lastAutoTable.finalY + 4;
  const mwstGruppenA = new Map<number, number>();
  let nettoGesamtA = 0;
  for (const p of positionen) {
    const netto = p.menge * p.preis * (1 - (p.rabatt ?? 0) / 100);
    nettoGesamtA += netto;
    const satz = p.artikel.mwstSatz ?? 19;
    mwstGruppenA.set(satz, (mwstGruppenA.get(satz) ?? 0) + netto);
  }
  let mwstGesamtA = 0;
  for (const [satz, basis] of mwstGruppenA) mwstGesamtA += basis * (satz / 100);
  const bruttoA = rundeKaufmaennisch(nettoGesamtA + mwstGesamtA, 2);

  let sumY = finalY + 2;
  const sumLabelX = 140;
  const sumValueX = 196;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(68);
  doc.text("Nettobetrag:", sumLabelX, sumY);
  doc.setTextColor(...COL_TEXT);
  doc.text(formatEuro(nettoGesamtA), sumValueX, sumY, { align: "right" });
  sumY += 5.5;

  for (const [satz, basis] of Array.from(mwstGruppenA.entries()).sort(([a], [b]) => a - b)) {
    doc.setTextColor(68);
    doc.text(`MwSt ${satz} %:`, sumLabelX, sumY);
    doc.setTextColor(...COL_TEXT);
    doc.text(formatEuro(basis * (satz / 100)), sumValueX, sumY, { align: "right" });
    sumY += 5.5;
  }

  doc.setDrawColor(...COL_BORDER_STRONG);
  doc.setLineWidth(0.5);
  doc.line(sumLabelX, sumY, sumValueX, sumY);
  sumY += 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...COL_TEXT);
  doc.text("Angebotssumme:", sumLabelX, sumY);
  doc.text(formatEuro(bruttoA), sumValueX, sumY, { align: "right" });
  sumY += 8;

  if (gueltigBis) {
    sumY = sicherstellenPlatz(doc, sumY, 5, footerReserve);
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(...COL_MUTED);
    doc.text(`Dieses Angebot ist gültig bis: ${formatDatum(gueltigBis)}`, 14, sumY);
    sumY += 5;
  }
  if (angebot.notiz?.trim()) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(...COL_MUTED);
    const notizLines = doc.splitTextToSize(`Hinweis: ${angebot.notiz.trim()}`, 182) as string[];
    sumY = sicherstellenPlatz(doc, sumY, notizLines.length * 4 + 2, footerReserve);
    notizLines.forEach((line, i) => doc.text(line, 14, sumY + i * 4));
  }

  vervollstaendigeMehrseitigesDokument(doc, {
    footerSpalten,
    firmenname: FIRMA.name,
    fortsetzungsTitel: `Angebot ${angebot.nummer} – Fortsetzung`,
  });
  return Buffer.from(doc.output("arraybuffer"));
}

/**
 * Wie generiereRechnungPdf, aber mit eingebettetem ZUGFeRD / Factur-X XML (PDF/A-3b).
 * Gibt ein einzelnes PDF zurück, das die strukturierte E-Rechnung enthält.
 */
export async function generiereRechnungPdfMitZugferd(lieferungId: number): Promise<Buffer> {
  const lieferung = await prisma.lieferung.findUnique({
    where: { id: lieferungId },
    include: {
      kunde: { include: { kontakte: true } },
      positionen: { include: { artikel: { select: liefposArtikelSelect } } },
    },
  });
  if (!lieferung) throw new Error(`Lieferung ${lieferungId} nicht gefunden`);
  if (!lieferung.rechnungNr) throw new Error("Lieferung hat noch keine Rechnungsnummer");

  const firma = await ladeFirmaDaten();

  const firmaEinstellungen = await prisma.einstellung.findMany({
    where: { key: { startsWith: "firma." } },
  });
  const firmaCfg: Record<string, string> = {};
  for (const e of firmaEinstellungen) firmaCfg[e.key] = e.value;

  const rechnungDatum = lieferung.rechnungDatum
    ? new Date(lieferung.rechnungDatum)
    : new Date(lieferung.datum);
  const zahlungsziel = lieferung.zahlungsziel ?? 30;

  const zugferdData: ZugferdData = {
    rechnungNr: lieferung.rechnungNr,
    datum: rechnungDatum,
    zahlungsziel,
    firma: {
      name: firmaCfg["firma.name"] ?? firmaCfg["firma.firmenname"] ?? firma.name,
      strasse: firmaCfg["firma.strasse"] ?? firmaCfg["firma.adresse"] ?? firma.strasse,
      plz: firmaCfg["firma.plz"] ?? "",
      ort: firmaCfg["firma.ort"] ?? "",
      ustIdNr: firmaCfg["firma.ustIdNr"] || firmaCfg["firma.ustidnr"] || undefined,
      steuernummer: firmaCfg["firma.steuernummer"] || firmaCfg["firma.steuernr"] || undefined,
      iban: firmaCfg["firma.iban"] || undefined,
      bic: firmaCfg["firma.bic"] || undefined,
      bank: firmaCfg["firma.bank"] || firmaCfg["firma.bankname"] || undefined,
    },
    kunde: {
      name: lieferung.kunde.name,
      firma: lieferung.kunde.firma ?? undefined,
      strasse: lieferung.kunde.strasse ?? undefined,
      plz: lieferung.kunde.plz ?? undefined,
      ort: lieferung.kunde.ort ?? undefined,
      ustIdNr: (lieferung.kunde as { ustIdNr?: string | null }).ustIdNr ?? undefined,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    positionen: (lieferung.positionen as any[]).map((p) => ({
      bezeichnung: p.artikel.name,
      menge: p.menge,
      einheit: p.artikel.einheit,
      einzelpreis: p.verkaufspreis,
      mwstSatz: p.mwstSatz ?? p.artikel.mwstSatz ?? 19,
      rabattProzent: p.rabattProzent ?? 0,
    })),
  };

  const zugferdXml = generateZugferdXml(zugferdData);
  const pdfBuffer = await generiereRechnungPdf(lieferungId);
  return embedZugferdInPdf(pdfBuffer, zugferdXml, lieferung.rechnungNr, rechnungDatum);
}

/**
 * Generiert eine Gutschrift als PDF-Buffer.
 */
export async function generiereGutschriftPdf(gutschriftId: number): Promise<Buffer> {
  const gutschrift = await prisma.gutschrift.findUnique({
    where: { id: gutschriftId },
    include: {
      kunde: { include: { kontakte: true } },
      lieferung: { select: { rechnungNr: true } },
      positionen: { include: { artikel: { select: { id: true, name: true, einheit: true, mwstSatz: true } } } },
    },
  });
  if (!gutschrift) throw new Error(`Gutschrift ${gutschriftId} nicht gefunden`);

  const FIRMA = await ladeFirmaDaten();
  const footerSpalten = await ladeFooterSpalten(FIRMA);
  const logo = await ladeLogo();
  const doc = new jsPDF();
  zeichneFalzmarken(doc);
  const footerReserve = schaetzeFooterReserve(doc, footerSpalten);

  const COL_TEXT: [number, number, number] = [0, 0, 0];
  const COL_MUTED: [number, number, number] = [85, 85, 85];
  const COL_LABEL: [number, number, number] = [136, 136, 136];
  const COL_BORDER_STRONG: [number, number, number] = [34, 34, 34];
  const COL_TABLE_HEAD_BG: [number, number, number] = [245, 245, 245];
  const COL_ROW_ALT_BG: [number, number, number] = [250, 250, 250];
  const COL_BOX_BG: [number, number, number] = [249, 249, 249];
  const COL_BOX_BORDER: [number, number, number] = [221, 221, 221];

  const k = gutschrift.kunde;
  const gutschriftDatum = new Date(gutschrift.datum);

  let logoBreiteMm = 0;
  if (logo) {
    try {
      const format = logo.format.toUpperCase() === "JPG" ? "JPEG" : logo.format.toUpperCase();
      doc.addImage(logo.dataUrl, format, 14, 14, 40, 20, undefined, "FAST");
      logoBreiteMm = 40;
    } catch (e) {
      Sentry.captureException(e);
    }
  }

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COL_TEXT);
  if (FIRMA.name) doc.text(FIRMA.name, 14, logoBreiteMm > 0 ? 40 : 20);

  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COL_TEXT);
  doc.text("Gutschrift", 196, 20, { align: "right" });

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  let metaYG = 27;
  const metaLabelXG = 155;
  const metaValueXG = 196;
  const drawMetaG = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COL_MUTED);
    doc.text(label, metaLabelXG, metaYG, { align: "right" });
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setTextColor(...COL_TEXT);
    doc.text(value, metaValueXG, metaYG, { align: "right" });
    metaYG += 5;
  };
  const rechnungNrGutschrift = gutschrift.lieferung?.rechnungNr ?? null;
  drawMetaG("Gutschriftnummer:", gutschrift.nummer, true);
  if (rechnungNrGutschrift) drawMetaG("Rechnungsnummer:", rechnungNrGutschrift);
  drawMetaG("Datum:", formatDatum(gutschriftDatum));
  drawMetaG("Grund:", gutschrift.grund);

  // ── Anschriftfeld nach DIN 5008 / Binect (Fensterkuvert) — wie generiereRechnungPdf,
  // feste mm-Positionen (Absenderzeile 45–55 mm, Empfängeranschrift ab 55 mm), damit
  // Absender + Empfänger unabhängig von der Anzahl der Metazeilen (Gutschriftnummer/
  // Rechnungsnummer/Datum/Grund) immer im Sichtfenster des Fensterkuverts liegen. Die
  // vorherige, an sepYG=metaYG+2 gekoppelte Position rutschte je nach Metazeilen-Anzahl
  // ins Fenster hinein oder die Betreffzeile begann zu weit oben — kein Absender, keine
  // feste Fensterposition.
  const ADRESS_X_G = 20;
  const absenderPartsG = [FIRMA.name, FIRMA.strasse, FIRMA.plzOrt].filter(Boolean);
  if (absenderPartsG.length > 0) {
    const absenderTextG = absenderPartsG.join(" · ");
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COL_LABEL);
    doc.text(absenderTextG, ADRESS_X_G, 49, { maxWidth: 85 });
    const lineWidthG = Math.min(doc.getTextWidth(absenderTextG), 85);
    doc.setDrawColor(...COL_LABEL);
    doc.setLineWidth(0.25);
    doc.line(ADRESS_X_G, 50.5, ADRESS_X_G + lineWidthG, 50.5);
  }

  let eyG = 57;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COL_TEXT);
  doc.text(k.firma ?? k.name, ADRESS_X_G, eyG);
  eyG += 5;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  if (k.firma) { doc.text(k.name, ADRESS_X_G, eyG); eyG += 5; }
  if (k.strasse) { doc.text(k.strasse, ADRESS_X_G, eyG); eyG += 5; }
  if (k.plz || k.ort) { doc.text([k.plz, k.ort].filter(Boolean).join(" "), ADRESS_X_G, eyG); eyG += 5; }

  // ── Betreff (unterhalb des Anschriftfelds, ab 95 mm – außerhalb des Fensters) ─
  eyG = Math.max(eyG + 8, 95);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COL_TEXT);
  const betreffText = rechnungNrGutschrift
    ? `Betreff: Gutschrift ${gutschrift.nummer} zu Rechnung ${rechnungNrGutschrift}`
    : `Betreff: Gutschrift ${gutschrift.nummer}`;
  doc.text(betreffText, 14, eyG);
  eyG += 6;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const positionenG = gutschrift.positionen as any[];
  const gutschriftHead = [["Pos.", "Artikel", "Menge", "Einheit", "Einzelpreis", "Gesamt"]];
  const gutschriftBody = positionenG.map((p, i) => [
    String(i + 1),
    p.artikel.name,
    p.menge.toLocaleString("de-DE", { maximumFractionDigits: 3 }),
    p.artikel.einheit,
    formatEuro(p.preis),
    formatEuro(p.menge * p.preis),
  ]);

  autoTable(doc, {
    startY: eyG + 2,
    head: gutschriftHead,
    body: gutschriftBody,
    theme: "plain",
    margin: { top: AUTOTABLE_TOP_MARGIN_FORTSETZUNG, right: 14, bottom: footerReserve, left: 14 },
    // Verhindert, dass eine einzelne Zeile (mehrzeilige Artikelzelle) mitten im Text über
    // einen Seitenumbruch hinweg aufgeteilt wird — die ganze Zeile wandert stattdessen
    // gemeinsam auf die nächste Seite.
    rowPageBreak: "avoid",
    headStyles: { fillColor: COL_TABLE_HEAD_BG, textColor: [51, 51, 51], fontStyle: "bold", lineColor: [51, 51, 51], lineWidth: 0.3 },
    alternateRowStyles: { fillColor: COL_ROW_ALT_BG },
    styles: { fontSize: 9, cellPadding: { top: 2, right: 3, bottom: 2, left: 3 }, lineColor: [221, 221, 221], lineWidth: 0.1, textColor: [0, 0, 0], valign: "top" },
    columnStyles: { 0: { cellWidth: 16 }, 1: { cellWidth: "auto" }, 2: { halign: "right", cellWidth: 20 }, 3: { cellWidth: 18 }, 4: { halign: "right", cellWidth: 28 }, 5: { halign: "right", cellWidth: 28 } },
  });

  const finalYG = (doc as JsPDFWithAutoTable).lastAutoTable.finalY + 4;
  const mwstGruppenG = new Map<number, number>();
  let nettoGesamtG = 0;
  for (const p of positionenG) {
    const netto = p.menge * p.preis;
    nettoGesamtG += netto;
    const satz = p.artikel.mwstSatz ?? 19;
    mwstGruppenG.set(satz, (mwstGruppenG.get(satz) ?? 0) + netto);
  }
  let mwstGesamtG = 0;
  for (const [satz, basis] of mwstGruppenG) mwstGesamtG += basis * (satz / 100);
  const bruttoG = rundeKaufmaennisch(nettoGesamtG + mwstGesamtG, 2);

  let sumYG = finalYG + 2;
  const sumLabelXG = 140;
  const sumValueXG = 196;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(68);
  doc.text("Nettobetrag:", sumLabelXG, sumYG);
  doc.setTextColor(...COL_TEXT);
  doc.text(formatEuro(nettoGesamtG), sumValueXG, sumYG, { align: "right" });
  sumYG += 5.5;

  for (const [satz, basis] of Array.from(mwstGruppenG.entries()).sort(([a], [b]) => a - b)) {
    doc.setTextColor(68);
    doc.text(`MwSt ${satz} %:`, sumLabelXG, sumYG);
    doc.setTextColor(...COL_TEXT);
    doc.text(formatEuro(basis * (satz / 100)), sumValueXG, sumYG, { align: "right" });
    sumYG += 5.5;
  }

  doc.setDrawColor(...COL_BORDER_STRONG);
  doc.setLineWidth(0.5);
  doc.line(sumLabelXG, sumYG, sumValueXG, sumYG);
  sumYG += 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...COL_TEXT);
  doc.text("Gutschriftbetrag:", sumLabelXG, sumYG);
  doc.text(formatEuro(bruttoG), sumValueXG, sumYG, { align: "right" });
  sumYG += 8;

  if (FIRMA.iban) {
    const boxX = 14;
    const boxW = 182;
    const boxH = 20;
    sumYG = sicherstellenPlatz(doc, sumYG, boxH + 4, footerReserve);
    const boxY = sumYG + 4;
    doc.setDrawColor(...COL_BOX_BORDER);
    doc.setFillColor(...COL_BOX_BG);
    doc.setLineWidth(0.2);
    doc.roundedRect(boxX, boxY, boxW, boxH, 1.5, 1.5, "FD");
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COL_TEXT);
    doc.text("Bankverbindung für Rückerstattung", boxX + 4, boxY + 6);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(51);
    const bankZeile = [
      FIRMA.bank ? `Bank: ${FIRMA.bank}` : "",
      FIRMA.iban ? `IBAN: ${FIRMA.iban}` : "",
      FIRMA.bic ? `BIC: ${FIRMA.bic}` : "",
    ].filter(Boolean).join("    ");
    if (bankZeile) doc.text(bankZeile, boxX + 4, boxY + 13);
  }

  if (gutschrift.notiz?.trim()) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(...COL_MUTED);
    const notizLines = doc.splitTextToSize(`Hinweis: ${gutschrift.notiz.trim()}`, 182) as string[];
    const notizYG = sicherstellenPlatz(doc, sumYG + 30, notizLines.length * 4 + 2, footerReserve);
    notizLines.forEach((line, i) => doc.text(line, 14, notizYG + i * 4));
  }

  vervollstaendigeMehrseitigesDokument(doc, {
    footerSpalten,
    firmenname: FIRMA.name,
    fortsetzungsTitel: `Gutschrift ${gutschrift.nummer} – Fortsetzung`,
  });
  return Buffer.from(doc.output("arraybuffer"));
}

/**
 * Generiert die Übersicht einer Rechnungsuebersicht als PDF-Buffer: reine
 * Zusammenfassungstabelle über bereits ausgestellte Einzelrechnungen (Rechnungsnr.,
 * Datum, Status, Nettobetrag je Rechnung) + Gesamtsumme. Erzeugt KEINE neue
 * Rechnungsnummer und ändert nichts an den referenzierten Lieferungen/Rechnungen —
 * dient nur als Sammelüberblick (z.B. Monatsübersicht für einen Kunden).
 * Der Nettobetrag je Rechnung folgt bewusst derselben Konvention wie die Beträge
 * in der Rechnungsliste (/rechnungen) und im Sammelrechnungs-Auswahlformular:
 * Menge × Verkaufspreis × (1 − Rabatt%), ohne MwSt-Aufschlag.
 */
export async function generiereRechnungsuebersichtPdf(rechnungsuebersichtId: number): Promise<Buffer> {
  const uebersicht = await prisma.rechnungsuebersicht.findUnique({
    where: { id: rechnungsuebersichtId },
    include: {
      kunde: { select: { id: true, name: true, firma: true, strasse: true, plz: true, ort: true } },
      eintraege: {
        select: {
          lieferung: {
            select: {
              id: true,
              rechnungNr: true,
              rechnungDatum: true,
              datum: true,
              bezahltAm: true,
              rechnungStorniert: true,
              positionen: { select: { menge: true, verkaufspreis: true, rabattProzent: true } },
            },
          },
        },
      },
    },
  });
  if (!uebersicht) throw new Error(`Rechnungsuebersicht ${rechnungsuebersichtId} nicht gefunden`);

  const FIRMA = await ladeFirmaDaten();
  const footerSpalten = await ladeFooterSpalten(FIRMA);
  const logo = await ladeLogo();
  const doc = new jsPDF();
  zeichneFalzmarken(doc);
  const footerReserve = schaetzeFooterReserve(doc, footerSpalten);

  const COL_TEXT: [number, number, number] = [0, 0, 0];
  const COL_MUTED: [number, number, number] = [85, 85, 85];
  const COL_BORDER_STRONG: [number, number, number] = [34, 34, 34];
  const COL_TABLE_HEAD_BG: [number, number, number] = [245, 245, 245];
  const COL_ROW_ALT_BG: [number, number, number] = [250, 250, 250];

  const k = uebersicht.kunde;

  let logoBreiteMm = 0;
  if (logo) {
    try {
      const format = logo.format.toUpperCase() === "JPG" ? "JPEG" : logo.format.toUpperCase();
      doc.addImage(logo.dataUrl, format, 14, 14, 40, 20, undefined, "FAST");
      logoBreiteMm = 40;
    } catch { /* ignore */ }
  }

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COL_TEXT);
  if (FIRMA.name) doc.text(FIRMA.name, 14, logoBreiteMm > 0 ? 40 : 20);

  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COL_TEXT);
  doc.text("Rechnungsübersicht", 196, 20, { align: "right" });

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COL_MUTED);
  doc.text(`Erstellt am ${formatDatum(uebersicht.createdAt)}`, 196, 27, { align: "right" });
  if (uebersicht.titel) doc.text(uebersicht.titel, 196, 32, { align: "right" });

  const sepY = 44;
  doc.setDrawColor(...COL_BORDER_STRONG);
  doc.setLineWidth(0.6);
  doc.line(14, sepY, 196, sepY);

  let ey = sepY + 10;
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(136);
  doc.text("KUNDE", 14, ey);
  ey += 5;

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COL_TEXT);
  doc.text(k.firma ?? k.name, 14, ey);
  ey += 5;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  if (k.firma) { doc.text(k.name, 14, ey); ey += 5; }
  if (k.strasse) { doc.text(k.strasse, 14, ey); ey += 5; }
  if (k.plz || k.ort) { doc.text([k.plz, k.ort].filter(Boolean).join(" "), 14, ey); ey += 5; }

  ey += 6;
  if (uebersicht.notiz?.trim()) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(...COL_MUTED);
    const notizLines = doc.splitTextToSize(uebersicht.notiz.trim(), 182) as string[];
    notizLines.forEach((line, i) => doc.text(line, 14, ey + i * 4));
    ey += notizLines.length * 4 + 4;
  }
  ey += 2;

  function nettoBetrag(positionen: { menge: number; verkaufspreis: number; rabattProzent: number }[]) {
    return positionen.reduce((s, p) => s + p.menge * p.verkaufspreis * (1 - p.rabattProzent / 100), 0);
  }
  function status(l: { bezahltAm: Date | null; rechnungStorniert: Date | null; rechnungDatum: Date | null; datum: Date }) {
    if (l.rechnungStorniert) return "Storniert";
    if (l.bezahltAm) return "Bezahlt";
    return "Offen";
  }

  const lieferungen = uebersicht.eintraege
    .map((e) => e.lieferung)
    .sort((a, b) => new Date(a.rechnungDatum ?? a.datum).getTime() - new Date(b.rechnungDatum ?? b.datum).getTime());

  const head = [["Nr.", "Rechnungsnummer", "Datum", "Status", "Nettobetrag"]];
  const body = lieferungen.map((l, i) => [
    String(i + 1),
    l.rechnungNr ?? "—",
    formatDatum(l.rechnungDatum ?? l.datum),
    status(l),
    formatEuro(nettoBetrag(l.positionen)),
  ]);

  autoTable(doc, {
    startY: ey + 2,
    head,
    body,
    theme: "plain",
    margin: { top: AUTOTABLE_TOP_MARGIN_FORTSETZUNG, right: 14, bottom: footerReserve, left: 14 },
    // Verhindert, dass eine einzelne Zeile (mehrzeilige Artikelzelle) mitten im Text über
    // einen Seitenumbruch hinweg aufgeteilt wird — die ganze Zeile wandert stattdessen
    // gemeinsam auf die nächste Seite.
    rowPageBreak: "avoid",
    headStyles: {
      fillColor: COL_TABLE_HEAD_BG,
      textColor: [51, 51, 51],
      fontStyle: "bold",
      lineColor: [51, 51, 51],
      lineWidth: 0.3,
    },
    alternateRowStyles: { fillColor: COL_ROW_ALT_BG },
    styles: {
      fontSize: 9,
      cellPadding: { top: 2, right: 3, bottom: 2, left: 3 },
      lineColor: [221, 221, 221],
      lineWidth: 0.1,
      textColor: [0, 0, 0],
      valign: "top",
    },
    columnStyles: {
      0: { cellWidth: 12 },
      1: { cellWidth: "auto" },
      2: { cellWidth: 28 },
      3: { cellWidth: 26 },
      4: { halign: "right", cellWidth: 32 },
    },
  });

  const finalY = (doc as JsPDFWithAutoTable).lastAutoTable.finalY + 4;
  const gesamtNetto = lieferungen.reduce((s, l) => s + nettoBetrag(l.positionen), 0);

  const sumLabelX = 140;
  const sumValueX = 196;
  let sumY = sicherstellenPlatz(doc, finalY, 20, footerReserve) + 4;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(68);
  doc.text("Anzahl Rechnungen:", sumLabelX, sumY, { align: "right" });
  doc.setTextColor(...COL_TEXT);
  doc.text(String(lieferungen.length), sumValueX, sumY, { align: "right" });
  sumY += 6;

  doc.setDrawColor(...COL_BORDER_STRONG);
  doc.setLineWidth(0.5);
  doc.line(sumLabelX, sumY, sumValueX, sumY);
  sumY += 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...COL_TEXT);
  doc.text("Nettobetrag gesamt:", sumLabelX, sumY, { align: "right" });
  doc.text(formatEuro(gesamtNetto), sumValueX, sumY, { align: "right" });

  vervollstaendigeMehrseitigesDokument(doc, {
    footerSpalten,
    firmenname: FIRMA.name,
    fortsetzungsTitel: `Rechnungsübersicht ${uebersicht.titel ?? uebersicht.id} – Fortsetzung`,
  });

  return Buffer.from(doc.output("arraybuffer"));
}

// ─── Mahnung ────────────────────────────────────────────────────────────────

export interface MahnungAnsprechpartner {
  name: string;
  mobil?: string | null;
  email?: string | null;
}

/** Extrahiert den Ortsnamen aus einer "PLZ Ort"-Zeichenkette (z.B. "32549 Bad Oeynhausen" → "Bad Oeynhausen"). */
function extrahiereOrt(plzOrt: string): string {
  const match = /^\d{4,5}\s+(.+)$/.exec(plzOrt.trim());
  return match ? match[1] : plzOrt.trim();
}

/**
 * Generiert eine Mahnung/Zahlungserinnerung als PDF-Buffer — schlichter DIN-5008-Geschäftsbrief
 * (Absenderzeile + Fensterkuvert-Anschrift wie bei generiereRechnungPdf), kein Positions-Raster.
 * Stufe 1 nutzt bewusst einen freundlichen, unverbindlichen Ton ohne Mahngebühr-Erwähnung;
 * Stufe 2/3 sind bestimmter und weisen auf Mahngebühr/Verzugszinsen hin. Das "Ihr
 * Ansprechpartner"-Feld oben rechts ersetzt die sonst dort stehende Meta-Tabelle und zeigt den
 * Sachbearbeiter, der die Mahnung erzeugt (Name/Mobil/Mail), statt der allgemeinen Firmenzentrale.
 */
export async function generiereMahnungPdf(
  lieferungId: number,
  mahnstufe: 1 | 2 | 3,
  ansprechpartner?: MahnungAnsprechpartner,
): Promise<Buffer> {
  const lieferung = await prisma.lieferung.findUnique({
    where: { id: lieferungId },
    include: {
      kunde: true,
      positionen: { select: { menge: true, verkaufspreis: true, rabattProzent: true, mwstSatz: true, artikel: { select: { mwstSatz: true } } } },
    },
  });
  if (!lieferung) throw new Error(`Lieferung ${lieferungId} nicht gefunden`);
  if (!lieferung.rechnungNr) throw new Error(`Lieferung ${lieferungId} hat noch keine Rechnungsnummer`);

  const cfgSetting = await prisma.einstellung.findUnique({ where: { key: "system.mahnwesen" } });
  const cfg = parseMahnwesenConfig(cfgSetting?.value);

  const FIRMA = await ladeFirmaDaten();
  const footerSpalten = await ladeFooterSpalten(FIRMA);
  const logo = await ladeLogo();
  const doc = new jsPDF();
  zeichneFalzmarken(doc);
  const footerReserve = schaetzeFooterReserve(doc, footerSpalten);

  const COL_TEXT: [number, number, number] = [0, 0, 0];
  const COL_MUTED: [number, number, number] = [85, 85, 85];
  const COL_LABEL: [number, number, number] = [136, 136, 136];

  const k = lieferung.kunde;
  const rechnungDatum = lieferung.rechnungDatum ? new Date(lieferung.rechnungDatum) : new Date(lieferung.datum);
  const zahlungsziel = lieferung.zahlungsziel ?? 30;
  const faelligDatum = new Date(rechnungDatum.getTime() + zahlungsziel * 24 * 60 * 60 * 1000);
  const heute = new Date();
  heute.setHours(0, 0, 0, 0);
  const faelligOhneZeit = new Date(faelligDatum);
  faelligOhneZeit.setHours(0, 0, 0, 0);
  const tageUeberfaellig = Math.max(0, Math.floor((heute.getTime() - faelligOhneZeit.getTime()) / (24 * 60 * 60 * 1000)));

  const betrag = berechneLieferungBrutto({ positionen: lieferung.positionen });
  const gebuehr = mahngebuehr(cfg, mahnstufe);
  const zinsen = berechneVerzugszinsen(betrag, tageUeberfaellig, cfg.verzugszinssatz, mahnstufe);
  const gesamtforderung = betrag + gebuehr + zinsen;

  // ── Kopfbereich: Logo + Firmenname links, Titel + Ansprechpartner rechts ───────
  let logoBreiteMm = 0;
  if (logo) {
    try {
      const format = logo.format.toUpperCase() === "JPG" ? "JPEG" : logo.format.toUpperCase();
      doc.addImage(logo.dataUrl, format, 14, 14, 40, 20, undefined, "FAST");
      logoBreiteMm = 40;
    } catch (e) {
      Sentry.captureException(e);
    }
  }
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COL_TEXT);
  if (FIRMA.name) doc.text(FIRMA.name, 14, logoBreiteMm > 0 ? 40 : 20);

  // Kein großer Titel mehr oben rechts (stand vorher hier, doppelte sich mit dem Betreff
  // "${MAHNUNG_BETREFF[mahnstufe]} – Rechnung ..." weiter unten im Brieftext und wirkte neben
  // dem Ansprechpartner-Block zu dominant) — nur noch der schlanke Ansprechpartner-Block.
  if (ansprechpartner) {
    let apY = 20;
    const apLabelX = 122;
    const apValueX = 196;
    const apMaxWidth = apValueX - apLabelX - 2; // Lücke zwischen Label- und Wertspalte
    const drawAp = (label: string, value: string) => {
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...COL_MUTED);
      doc.text(label, apLabelX, apY, { align: "right" });
      // Lange Werte (v.a. E-Mail-Adressen) dürfen nicht über die Labelspalte hinaus nach links
      // laufen — Schriftgröße schrittweise verkleinern, bis der Wert in die Spaltenbreite passt.
      let valueFontSize = 8.5;
      doc.setFontSize(valueFontSize);
      while (valueFontSize > 6 && doc.getTextWidth(value) > apMaxWidth) {
        valueFontSize -= 0.5;
        doc.setFontSize(valueFontSize);
      }
      doc.setTextColor(...COL_TEXT);
      doc.text(value, apValueX, apY, { align: "right" });
      apY += 4;
    };
    drawAp("Ihr Ansprechpartner:", ansprechpartner.name);
    if (ansprechpartner.mobil?.trim()) drawAp("Mobil:", ansprechpartner.mobil.trim());
    if (ansprechpartner.email?.trim()) drawAp("Mail:", ansprechpartner.email.trim());
  }

  // ── Anschriftfeld nach DIN 5008 / Binect (Fensterkuvert) — wie generiereRechnungPdf,
  // aber etwas weiter unten angesetzt (mehr Abstand zum Kopfbereich) ──
  const ADRESS_X = 20;
  const absenderParts = [FIRMA.name, FIRMA.strasse, FIRMA.plzOrt].filter(Boolean);
  if (absenderParts.length > 0) {
    const absenderText = absenderParts.join(" · ");
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COL_LABEL);
    doc.text(absenderText, ADRESS_X, 55, { maxWidth: 85 });
    const lineWidth = Math.min(doc.getTextWidth(absenderText), 85);
    doc.setDrawColor(...COL_LABEL);
    doc.setLineWidth(0.25);
    doc.line(ADRESS_X, 56.5, ADRESS_X + lineWidth, 56.5);
  }

  let ey = 63;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COL_TEXT);
  doc.text(k.firma ?? k.name, ADRESS_X, ey);
  ey += 5;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COL_TEXT);
  if (k.firma) { doc.text(k.name, ADRESS_X, ey); ey += 5; }
  if (k.strasse) { doc.text(k.strasse, ADRESS_X, ey); ey += 5; }
  if (k.plz || k.ort) {
    doc.text([k.plz, k.ort].filter(Boolean).join(" "), ADRESS_X, ey);
    ey += 5;
  }

  // ── Ort/Datum + Betreff (unterhalb des Anschriftfelds, ab 95 mm) ───────────────
  ey = Math.max(ey + 8, 95);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COL_MUTED);
  const ortZeile = `${extrahiereOrt(FIRMA.plzOrt)}, ${formatDatum(heute)}`.replace(/^, /, "");
  doc.text(ortZeile, 196, ey, { align: "right" });
  ey += 8;

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COL_TEXT);
  doc.text(`${MAHNUNG_BETREFF[mahnstufe]} – Rechnung ${lieferung.rechnungNr}`, 14, ey);
  ey += 8;

  // ── Anrede + Brieftext (zentral aus lib/mahnwesen-config.ts, identisch zur E-Mail) ─────────
  const { anrede, absaetze } = mahnungTextBausteine(mahnstufe, lieferung.rechnungNr, formatDatum(rechnungDatum), k.firma);

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COL_TEXT);
  ey = sicherstellenPlatz(doc, ey, 8, footerReserve);
  doc.text(anrede, 14, ey);
  ey += 8;

  doc.setFontSize(10.5);
  for (const absatz of absaetze) {
    const zeilen = doc.splitTextToSize(absatz, 182) as string[];
    ey = sicherstellenPlatz(doc, ey, zeilen.length * 5 + 4, footerReserve);
    zeilen.forEach((zeile, i) => doc.text(zeile, 14, ey + i * 5));
    ey += zeilen.length * 5 + 4;
  }

  // ── Rechnungsdaten-Tabelle ──────────────────────────────────────────────────
  const head = [["Rechnungsnr.", "Rechnungsdatum", "Tage überfällig", "Betrag"]];
  const body: string[][] = [[lieferung.rechnungNr, formatDatum(rechnungDatum), `${tageUeberfaellig} Tage`, formatEuro(betrag)]];
  ey = sicherstellenPlatz(doc, ey, 4, footerReserve);
  autoTable(doc, {
    startY: ey,
    head,
    body,
    theme: "plain",
    margin: { top: AUTOTABLE_TOP_MARGIN_FORTSETZUNG, right: 14, bottom: footerReserve, left: 14 },
    headStyles: { fillColor: [245, 245, 245], textColor: [51, 51, 51], fontStyle: "bold", lineColor: [51, 51, 51], lineWidth: 0.3 },
    styles: { fontSize: 9, cellPadding: { top: 2, right: 3, bottom: 2, left: 3 }, lineColor: [221, 221, 221], lineWidth: 0.1, textColor: [0, 0, 0] },
    columnStyles: { 0: { cellWidth: 44 }, 1: { cellWidth: 44 }, 2: { cellWidth: 44 }, 3: { halign: "right", cellWidth: 50 } },
  });
  ey = (doc as JsPDFWithAutoTable).lastAutoTable.finalY + 4;

  if (gebuehr > 0 || zinsen > 0) {
    const sumLabelX = 140;
    const sumValueX = 196;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(68);
    if (gebuehr > 0) {
      doc.text("Mahngebühr:", sumLabelX, ey, { align: "right" });
      doc.setTextColor(...COL_TEXT);
      doc.text(formatEuro(gebuehr), sumValueX, ey, { align: "right" });
      ey += 5.5;
      doc.setTextColor(68);
    }
    if (zinsen > 0) {
      doc.text(`Verzugszinsen (${cfg.verzugszinssatz.toFixed(2)}% p.a.):`, sumLabelX, ey, { align: "right" });
      doc.setTextColor(...COL_TEXT);
      doc.text(formatEuro(zinsen), sumValueX, ey, { align: "right" });
      ey += 5.5;
    }
    doc.setDrawColor(34, 34, 34);
    doc.setLineWidth(0.4);
    doc.line(sumLabelX, ey, sumValueX, ey);
    ey += 5.5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...COL_TEXT);
    doc.text("Gesamtforderung:", sumLabelX, ey, { align: "right" });
    doc.text(formatEuro(gesamtforderung), sumValueX, ey, { align: "right" });
    ey += 8;
  } else {
    ey += 4;
  }

  // ── Zahlungsinformation ─────────────────────────────────────────────────────
  ey = sicherstellenPlatz(doc, ey, 10, footerReserve);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COL_TEXT);
  const kontoZeilen = FIRMA.iban
    ? doc.splitTextToSize(
        `Bitte überweisen Sie den Gesamtbetrag von ${formatEuro(gesamtforderung)} auf folgendes Konto: ${FIRMA.bank ? `${FIRMA.bank}, ` : ""}IBAN ${FIRMA.iban}${FIRMA.bic ? `, BIC ${FIRMA.bic}` : ""}.`,
        182,
      ) as string[]
    : (doc.splitTextToSize(`Bitte überweisen Sie den Gesamtbetrag von ${formatEuro(gesamtforderung)} auf unser bekanntes Konto.`, 182) as string[]);
  ey = sicherstellenPlatz(doc, ey, kontoZeilen.length * 5 + 2, footerReserve);
  kontoZeilen.forEach((zeile, i) => doc.text(zeile, 14, ey + i * 5));
  ey += kontoZeilen.length * 5 + 10;

  // ── Signatur ────────────────────────────────────────────────────────────────
  ey = sicherstellenPlatz(doc, ey, 14, footerReserve);
  doc.setFontSize(10.5);
  doc.setFont("helvetica", "normal");
  doc.text("Mit freundlichen Grüßen", 14, ey);
  ey += 6;
  doc.setFont("helvetica", "bold");
  doc.text(ansprechpartner?.name ?? FIRMA.name, 14, ey);

  vervollstaendigeMehrseitigesDokument(doc, {
    footerSpalten,
    firmenname: FIRMA.name,
    fortsetzungsTitel: `${MAHNUNG_BETREFF[mahnstufe]} ${lieferung.rechnungNr} – Fortsetzung`,
  });

  return Buffer.from(doc.output("arraybuffer"));
}
