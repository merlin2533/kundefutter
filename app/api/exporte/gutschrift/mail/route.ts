import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generiereGutschriftPdf } from "@/lib/pdfGenerator";
import { sendEmail } from "@/lib/email";
import { gutschriftEmail } from "@/lib/email-templates";
import { ladeFirmaDaten } from "@/lib/firma";
export const dynamic = "force-dynamic";

// POST /api/exporte/gutschrift/mail
// Body: { gutschriftId: number; empfaenger?: string }
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { gutschriftId?: unknown; empfaenger?: unknown };
    const gutschriftId = Number(body.gutschriftId);
    if (!Number.isInteger(gutschriftId) || gutschriftId <= 0) {
      return NextResponse.json({ error: "Ungültige gutschriftId" }, { status: 400 });
    }

    const gutschrift = await prisma.gutschrift.findUnique({
      where: { id: gutschriftId },
      include: {
        kunde: { include: { kontakte: true } },
        positionen: { include: { artikel: { select: { id: true, name: true, einheit: true, mwstSatz: true } } } },
      },
    });
    if (!gutschrift) {
      return NextResponse.json({ error: "Gutschrift nicht gefunden" }, { status: 404 });
    }

    const emailKontakt = gutschrift.kunde.kontakte.find(
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
    const pdfBuffer = await generiereGutschriftPdf(gutschriftId);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const positionen = gutschrift.positionen as any[];
    let nettoGesamt = 0;
    let mwstGesamt = 0;
    for (const p of positionen) {
      const netto = p.menge * p.preis;
      nettoGesamt += netto;
      const satz = p.artikel.mwstSatz ?? 19;
      mwstGesamt += netto * (satz / 100);
    }
    const bruttoBetrag = nettoGesamt + mwstGesamt;

    const pdfFilename = `Gutschrift_${gutschrift.nummer.replace(/[^A-Za-z0-9\-_]/g, "_")}.pdf`;

    const kontaktMitName = gutschrift.kunde.kontakte.find(
      (k: { vorname?: string | null; nachname?: string | null }) =>
        (k.vorname && k.vorname.trim()) || (k.nachname && k.nachname.trim()),
    );
    const kundenAnrede = kontaktMitName
      ? [kontaktMitName.vorname, kontaktMitName.nachname].filter(Boolean).join(" ").trim()
      : gutschrift.kunde.firma ?? gutschrift.kunde.name;

    const { subject, text, html } = gutschriftEmail({
      gutschriftNr: gutschrift.nummer,
      gutschriftDatum: new Date(gutschrift.datum),
      bruttoBetrag,
      kundenAnrede,
      firma,
      pdfFilename,
    });

    await sendEmail({
      to: empfaenger,
      subject,
      text,
      html,
      fromName: firma.name,
      attachments: [{ filename: pdfFilename, content: pdfBuffer, contentType: "application/pdf" }],
    });

    await prisma.kundeAktivitaet.create({
      data: {
        kundeId: gutschrift.kundeId,
        typ: "email",
        betreff: `Gutschrift ${gutschrift.nummer} versendet`,
        inhalt: `PDF an ${empfaenger} verschickt.`,
        datum: new Date(),
        erledigt: true,
      },
    });

    const kundenname = gutschrift.kunde.firma ?? gutschrift.kunde.name;
    return NextResponse.json({ ok: true, empfaenger, kundenname });
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: `E-Mail-Versand fehlgeschlagen: ${msg}` }, { status: 500 });
  }
}
