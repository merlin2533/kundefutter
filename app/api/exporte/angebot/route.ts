import { NextRequest, NextResponse } from "next/server";
import { generiereAngebotPdf } from "@/lib/pdfGenerator";
import { prisma } from "@/lib/prisma";
import { Sentry } from "@/lib/sentry";
import { isNextcloudKonfiguriert, uploadPdfToKundeOrdner } from "@/lib/nextcloud";
export const dynamic = "force-dynamic";

// GET /api/exporte/angebot?angebotId=X — Angebot als PDF herunterladen
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const angebotId = Number(searchParams.get("angebotId"));
  if (!Number.isInteger(angebotId) || angebotId <= 0) {
    return NextResponse.json({ error: "Ungültige angebotId" }, { status: 400 });
  }

  try {
    const angebot = await prisma.angebot.findUnique({
      where: { id: angebotId },
      select: { id: true, nummer: true, kundeId: true, kunde: { select: { name: true } } },
    });
    if (!angebot) {
      return NextResponse.json({ error: "Angebot nicht gefunden" }, { status: 404 });
    }

    const pdfBuffer = await generiereAngebotPdf(angebotId);
    const filename = `Angebot_${angebot.nummer.replace(/[^A-Za-z0-9\-_]/g, "_")}.pdf`;

    // Fire-and-forget: Angebot in den Kunden-Ordner spiegeln
    isNextcloudKonfiguriert()
      .then(async (ok) => {
        if (!ok) return;
        await uploadPdfToKundeOrdner(angebot.kundeId, angebot.kunde.name, "Angebote", filename, pdfBuffer);
      })
      .catch((e: unknown) => {
        Sentry.captureException(e);
        console.warn("[nextcloud] Angebot-Upload fehlgeschlagen:", e instanceof Error ? e.message : e);
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
