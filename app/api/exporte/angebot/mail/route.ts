import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generiereAngebotPdf } from "@/lib/pdfGenerator";
import { sendEmail } from "@/lib/email";
import { angebotEmail } from "@/lib/email-templates";
import { ladeFirmaDaten } from "@/lib/firma";
export const dynamic = "force-dynamic";

// POST /api/exporte/angebot/mail
// Body: { angebotId: number; empfaenger?: string }
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { angebotId?: unknown; empfaenger?: unknown };
    const angebotId = Number(body.angebotId);
    if (!Number.isInteger(angebotId) || angebotId <= 0) {
      return NextResponse.json({ error: "Ungültige angebotId" }, { status: 400 });
    }

    const angebot = await prisma.angebot.findUnique({
      where: { id: angebotId },
      include: {
        kunde: { include: { kontakte: true } },
        positionen: { include: { artikel: { select: { id: true, name: true, einheit: true, mwstSatz: true } } } },
      },
    });
    if (!angebot) {
      return NextResponse.json({ error: "Angebot nicht gefunden" }, { status: 404 });
    }

    const emailKontakt = angebot.kunde.kontakte.find(
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
    const pdfBuffer = await generiereAngebotPdf(angebotId);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const positionen = angebot.positionen as any[];
    let nettoGesamt = 0;
    let mwstGesamt = 0;
    for (const p of positionen) {
      const netto = p.menge * p.preis * (1 - (p.rabatt ?? 0) / 100);
      nettoGesamt += netto;
      const satz = p.artikel.mwstSatz ?? 19;
      mwstGesamt += netto * (satz / 100);
    }
    const bruttoBetrag = nettoGesamt + mwstGesamt;

    const pdfFilename = `Angebot_${angebot.nummer.replace(/[^A-Za-z0-9\-_]/g, "_")}.pdf`;

    const kontaktMitName = angebot.kunde.kontakte.find(
      (k: { vorname?: string | null; nachname?: string | null }) =>
        (k.vorname && k.vorname.trim()) || (k.nachname && k.nachname.trim()),
    );
    const kundenAnrede = kontaktMitName
      ? [kontaktMitName.vorname, kontaktMitName.nachname].filter(Boolean).join(" ").trim()
      : angebot.kunde.firma ?? angebot.kunde.name;

    const { subject, text, html } = angebotEmail({
      angebotNr: angebot.nummer,
      angebotDatum: new Date(angebot.datum),
      gueltigBis: angebot.gueltigBis ? new Date(angebot.gueltigBis) : null,
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
        kundeId: angebot.kundeId,
        typ: "email",
        betreff: `Angebot ${angebot.nummer} versendet`,
        inhalt: `PDF an ${empfaenger} verschickt.`,
        datum: new Date(),
        erledigt: true,
      },
    });

    const kundenname = angebot.kunde.firma ?? angebot.kunde.name;
    return NextResponse.json({ ok: true, empfaenger, kundenname });
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: `E-Mail-Versand fehlgeschlagen: ${msg}` }, { status: 500 });
  }
}
