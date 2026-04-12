import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { naechsteRechnungsnummer } from "@/lib/utils";
import { generiereRechnungPdf } from "@/lib/pdfGenerator";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lieferungId = Number(searchParams.get("lieferungId"));
  if (!Number.isInteger(lieferungId) || lieferungId <= 0) {
    return NextResponse.json({ error: "Ungültige lieferungId" }, { status: 400 });
  }

  try {
    // Rechnungsnummer ggf. automatisch vergeben (transaktionssicher)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lieferung = await prisma.$transaction(async (tx: any) => {
      const l = await tx.lieferung.findUnique({ where: { id: lieferungId } });
      if (!l) return null;
      if (!l.rechnungNr) {
        const einstellung = await tx.einstellung.findUnique({ where: { key: "letzte_rechnungsnummer" } });
        const rechnungNr = naechsteRechnungsnummer(einstellung?.value ?? null);
        await tx.einstellung.upsert({
          where: { key: "letzte_rechnungsnummer" },
          update: { value: rechnungNr },
          create: { key: "letzte_rechnungsnummer", value: rechnungNr },
        });
        return tx.lieferung.update({
          where: { id: lieferungId },
          data: { rechnungNr, rechnungDatum: new Date() },
        });
      }
      return l;
    });

    if (!lieferung) {
      return NextResponse.json({ error: "Lieferung nicht gefunden" }, { status: 404 });
    }

    const pdfBuffer = await generiereRechnungPdf(lieferungId);
    const filename = `rechnung-${lieferung.rechnungNr?.replace(/[^A-Za-z0-9\-_]/g, "-")}-${new Date().toISOString().slice(0, 10)}.pdf`;

    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Fehler beim Erstellen der Rechnung" }, { status: 500 });
  }
}
