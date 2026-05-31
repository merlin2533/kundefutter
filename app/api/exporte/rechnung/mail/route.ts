import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { liefposArtikelSelect } from "@/lib/artikel-select";
import { generiereRechnungPdfMitZugferd } from "@/lib/pdfGenerator";
import { sendEmail } from "@/lib/email";
import { rechnungEmail } from "@/lib/email-templates";
import { ladeFirmaDaten } from "@/lib/firma";
export const dynamic = "force-dynamic";


// POST /api/exporte/rechnung/mail
// Body: { lieferungId: number; empfaenger?: string }
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { lieferungId?: unknown; empfaenger?: unknown; cc?: unknown };
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

    // ── PDF mit eingebettetem ZUGFeRD XML generieren ───────────────────────────
    const pdfBuffer = await generiereRechnungPdfMitZugferd(lieferungId);

    const rechnungDatum = lieferung.rechnungDatum
      ? new Date(lieferung.rechnungDatum)
      : new Date(lieferung.datum);
    const zahlungsziel = lieferung.zahlungsziel ?? 30;
    const faelligAm = new Date(rechnungDatum.getTime() + zahlungsziel * 24 * 60 * 60 * 1000);

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
    });

    const ccAdresse = typeof body.cc === "string" && body.cc.trim() ? body.cc.trim() : undefined;

    await sendEmail({
      to: empfaenger,
      cc: ccAdresse,
      subject,
      text,
      html,
      fromName: firma.name,
      feature: "rechnung",
      attachments: [
        { filename: pdfFilename, content: pdfBuffer, contentType: "application/pdf" },
      ],
    });

    await prisma.kundeAktivitaet.create({
      data: {
        kundeId: lieferung.kundeId,
        typ: "email",
        betreff: `Rechnung ${lieferung.rechnungNr} versendet`,
        inhalt: `ZUGFeRD-PDF (Factur-X eingebettet) an ${empfaenger} verschickt.`,
        datum: new Date(),
        erledigt: true,
      },
    });

    const kundenname = lieferung.kunde.firma ?? lieferung.kunde.name;
    return NextResponse.json({ ok: true, empfaenger, kundenname });
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: `E-Mail-Versand fehlgeschlagen: ${msg}` }, { status: 500 });
  }
}
