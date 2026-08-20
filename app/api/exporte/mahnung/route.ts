import { NextRequest, NextResponse } from "next/server";
import { generiereMahnungPdf } from "@/lib/pdfGenerator";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { Sentry } from "@/lib/sentry";
import { isNextcloudKonfiguriert, uploadPdfToKundeOrdner } from "@/lib/nextcloud";
export const dynamic = "force-dynamic";

// GET /api/exporte/mahnung?lieferungId=X&mahnstufe=1|2|3 — Mahnung als PDF herunterladen
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lieferungId = Number(searchParams.get("lieferungId"));
  if (!Number.isInteger(lieferungId) || lieferungId <= 0) {
    return NextResponse.json({ error: "Ungültige lieferungId" }, { status: 400 });
  }
  const mahnstufeRaw = Number(searchParams.get("mahnstufe"));
  const mahnstufe = ([1, 2, 3] as const).includes(mahnstufeRaw as 1 | 2 | 3) ? (mahnstufeRaw as 1 | 2 | 3) : 1;

  try {
    const lieferung = await prisma.lieferung.findUnique({
      where: { id: lieferungId },
      select: { id: true, rechnungNr: true, kundeId: true, kunde: { select: { name: true } } },
    });
    if (!lieferung) {
      return NextResponse.json({ error: "Lieferung nicht gefunden" }, { status: 404 });
    }
    if (!lieferung.rechnungNr) {
      return NextResponse.json({ error: "Lieferung hat noch keine Rechnungsnummer" }, { status: 400 });
    }

    // Ansprechpartner = aktuell angemeldeter Benutzer (Sachbearbeiter, der die Mahnung erzeugt),
    // nicht die allgemeine Firmenzentrale — erscheint oben rechts auf dem Brief.
    const me = await getCurrentUser();
    const ansprechpartner = me
      ? await prisma.benutzer.findUnique({ where: { id: me.id }, select: { name: true, mobil: true, email: true } })
      : null;

    const pdfBuffer = await generiereMahnungPdf(lieferungId, mahnstufe, ansprechpartner ?? undefined);
    const filename = `Mahnung_${lieferung.rechnungNr.replace(/[^A-Za-z0-9\-_]/g, "_")}.pdf`;

    // Fire-and-forget: Mahnung in den Kunden-Ordner spiegeln
    isNextcloudKonfiguriert()
      .then(async (ok) => {
        if (!ok) return;
        await uploadPdfToKundeOrdner(lieferung.kundeId, lieferung.kunde.name, "Mahnungen", filename, pdfBuffer);
      })
      .catch((e: unknown) => {
        Sentry.captureException(e);
        console.warn("[nextcloud] Mahnung-Upload fehlgeschlagen:", e instanceof Error ? e.message : e);
      });

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdfBuffer.length),
      },
    });
  } catch (err) {
    Sentry.captureException(err);
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: `PDF-Generierung fehlgeschlagen: ${msg}` }, { status: 500 });
  }
}
