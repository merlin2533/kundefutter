import { NextRequest, NextResponse } from "next/server";
import { generiereBestellungPdf } from "@/lib/pdfGenerator";
import { prisma } from "@/lib/prisma";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";

// GET /api/exporte/bestellung?bestellungId=X — Lieferantenbestellung als PDF herunterladen
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const bestellungId = Number(searchParams.get("bestellungId"));
  if (!Number.isInteger(bestellungId) || bestellungId <= 0) {
    return NextResponse.json({ error: "Ungültige bestellungId" }, { status: 400 });
  }

  try {
    const bestellung = await prisma.bestellung.findUnique({
      where: { id: bestellungId },
      select: { id: true, nummer: true },
    });
    if (!bestellung) {
      return NextResponse.json({ error: "Bestellung nicht gefunden" }, { status: 404 });
    }

    const pdfBuffer = await generiereBestellungPdf(bestellungId);
    const filename = `Bestellung_${bestellung.nummer.replace(/[^A-Za-z0-9\-_]/g, "_")}.pdf`;

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
