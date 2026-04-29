import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { liefposArtikelSelect, artikelSafeSelect } from "@/lib/artikel-select";
import { generiereRechnungPdf } from "@/lib/pdfGenerator";
import { generateZugferdXml, ZugferdData } from "@/lib/zugferd-xml";
import { sendEmail } from "@/lib/email";
import { rechnungEmail } from "@/lib/email-templates";
import { ladeFirmaDaten } from "@/lib/firma";

// POST /api/exporte/rechnung/mail
// Body: { lieferungId: number; empfaenger?: string }
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { lieferungId?: unknown; empfaenger?: unknown };
    const lieferungId = Number(body.lieferungId);
    if (!Number.isInteger(lieferungId) || lieferungId <= 0) {
      return NextResponse.json({ error: "Ungültige lieferungId" }, { status: 400 });
    }

    const lieferung = await prisma.lieferung.findUnique({
      where: { id: lieferungId },
      include: {
        kunde: { include: { kontakte: true } },
        positionen: { include: { artikel: { select: liefposArtikelSelect } } },
      },
    });
    if (!lieferung) {
      return NextResponse.json({ error: "Lieferung nicht gefunden" }, { status: 404 });
    }
    if (!lieferung.rechnungNr) {
      return NextResponse.json({ error: "Lieferung hat noch keine Rechnungsnummer" }, { status: 400 });
    }

    const emailKontakt = lieferung.kunde.kontakte.find(
      (k: { typ: string; wert: string }) => k.typ === "email",
    );
    const empfaenger =
      typeof body.empfaenger === "string" && body.empfaenger.trim()
        ? body.empfaenger.trim()
        : emailKontakt?.wert ?? "";

    if (!empfaenger) {
      return NextResponse.json(
        { error: "Keine E-Mail-Adresse für diesen Kunden hinterlegt und keine Empfänger-Adresse angegeben." },
        { status: 422 },
      );
    }

    const firma = await ladeFirmaDaten();

    // ── PDF + ZUGFeRD XML generieren ───────────────────────────────────────────
    const pdfBuffer = await generiereRechnungPdf(lieferungId);

    const firmaEinstellungen = await prisma.einstellung.findMany({
      where: { key: { startsWith: "firma." } },
    });
    const firmaCfg: Record<string, string> = {};
    for (const e of firmaEinstellungen) firmaCfg[e.key] = e.value;

    const rechnungDatum = lieferung.rechnungDatum
      ? new Date(lieferung.rechnungDatum)
      : new Date(lieferung.datum);
    const zahlungsziel = lieferung.zahlungsziel ?? 30;
    const faelligAm = new Date(rechnungDatum.getTime() + zahlungsziel * 24 * 60 * 60 * 1000);

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
        mwstSatz: p.artikel.mwstSatz ?? 19,
        rabattProzent: p.rabattProzent ?? 0,
      })),
    };
    const zugferdXml = generateZugferdXml(zugferdData);

    // ── Bruttobetrag berechnen (für Mail-Übersicht) ─────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const positionen = lieferung.positionen as any[];
    let nettoGesamt = 0;
    let mwstGesamt = 0;
    for (const p of positionen) {
      const netto = p.menge * p.verkaufspreis * (1 - (p.rabattProzent ?? 0) / 100);
      nettoGesamt += netto;
      const satz = p.artikel.mwstSatz ?? 19;
      mwstGesamt += netto * (satz / 100);
    }
    const bruttoBetrag = nettoGesamt + mwstGesamt;

    const pdfFilename = `Rechnung_${lieferung.rechnungNr.replace(/[^A-Za-z0-9\-_]/g, "_")}.pdf`;
    const xmlFilename = `RE-${lieferung.rechnungNr.replace(/[^A-Za-z0-9\-_]/g, "_")}.xml`;

    // ── Kunden-Anrede aus erstem Email-Kontakt mit Vor-/Nachname ableiten ──────
    const kontaktMitName = lieferung.kunde.kontakte.find(
      (k: { vorname?: string | null; nachname?: string | null }) =>
        (k.vorname && k.vorname.trim()) || (k.nachname && k.nachname.trim()),
    );
    const kundenAnrede = kontaktMitName
      ? [kontaktMitName.vorname, kontaktMitName.nachname].filter(Boolean).join(" ").trim()
      : lieferung.kunde.firma ?? lieferung.kunde.name;

    const { subject, text, html } = rechnungEmail({
      rechnungNr: lieferung.rechnungNr,
      rechnungDatum,
      faelligAm,
      bruttoBetrag,
      kundenAnrede,
      firma,
      pdfFilename,
      xmlFilename,
    });

    await sendEmail({
      to: empfaenger,
      subject,
      text,
      html,
      fromName: firma.name,
      attachments: [
        { filename: pdfFilename, content: pdfBuffer, contentType: "application/pdf" },
        { filename: xmlFilename, content: Buffer.from(zugferdXml, "utf-8"), contentType: "application/xml" },
      ],
    });

    await prisma.kundeAktivitaet.create({
      data: {
        kundeId: lieferung.kundeId,
        typ: "email",
        betreff: `Rechnung ${lieferung.rechnungNr} versendet`,
        inhalt: `PDF + ZUGFeRD XML an ${empfaenger} verschickt.`,
        datum: new Date(),
        erledigt: true,
      },
    });

    const kundenname = lieferung.kunde.firma ?? lieferung.kunde.name;
    return NextResponse.json({ ok: true, empfaenger, kundenname });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
    return NextResponse.json({ error: `E-Mail-Versand fehlgeschlagen: ${msg}` }, { status: 500 });
  }
}
