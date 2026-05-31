import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { mahnungEmail } from "@/lib/email-templates";
import { ladeFirmaDaten } from "@/lib/firma";
import { liefposArtikelSelect } from "@/lib/artikel-select";
export const dynamic = "force-dynamic";

// POST /api/exporte/mahnung/mail
// Body: { lieferungId: number; mahnstufe?: number; empfaenger?: string }
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { lieferungId?: unknown; mahnstufe?: unknown; empfaenger?: unknown; cc?: unknown };
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

    const mahnstufe = typeof body.mahnstufe === "number" && body.mahnstufe > 0 ? body.mahnstufe : 1;
    const firma = await ladeFirmaDaten();

    // Offenen Betrag berechnen
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
    const offenerBetrag = nettoGesamt + mwstGesamt;

    const rechnungDatum = lieferung.rechnungDatum
      ? new Date(lieferung.rechnungDatum)
      : new Date(lieferung.datum);
    const zahlungsziel = lieferung.zahlungsziel ?? 30;
    const faelligAm = new Date(rechnungDatum.getTime() + zahlungsziel * 24 * 60 * 60 * 1000);

    const kontaktMitName = lieferung.kunde.kontakte.find(
      (k: { vorname?: string | null; nachname?: string | null }) =>
        (k.vorname && k.vorname.trim()) || (k.nachname && k.nachname.trim()),
    );
    const kundenAnrede = kontaktMitName
      ? [kontaktMitName.vorname, kontaktMitName.nachname].filter(Boolean).join(" ").trim()
      : lieferung.kunde.firma ?? lieferung.kunde.name;

    const { subject, text, html } = mahnungEmail({
      rechnungNr: lieferung.rechnungNr,
      rechnungDatum,
      faelligAm,
      offenerBetrag,
      mahnstufe,
      kundenAnrede,
      firma,
    });

    const ccAdresse = typeof body.cc === "string" && body.cc.trim() ? body.cc.trim() : undefined;

    await sendEmail({
      to: empfaenger,
      cc: ccAdresse,
      subject,
      text,
      html,
      fromName: firma.name,
      feature: "mahnung",
    });

    const stufenText = mahnstufe === 1 ? "Zahlungserinnerung" : `Mahnung (Stufe ${mahnstufe})`;
    await prisma.kundeAktivitaet.create({
      data: {
        kundeId: lieferung.kundeId,
        typ: "email",
        betreff: `${stufenText}: Rechnung ${lieferung.rechnungNr}`,
        inhalt: `Mahnungs-E-Mail an ${empfaenger} verschickt.`,
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
