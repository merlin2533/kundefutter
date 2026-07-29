import { NextRequest, NextResponse } from "next/server";
import { generiereRechnungsuebersichtPdf } from "@/lib/pdfGenerator";
import { prisma } from "@/lib/prisma";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";

// GET /api/exporte/rechnungsuebersicht?id=X — Rechnungsübersicht als PDF herunterladen
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Ungültige id" }, { status: 400 });
  }

  try {
    const uebersicht = await prisma.rechnungsuebersicht.findUnique({
      where: { id },
      select: { id: true, titel: true, createdAt: true },
    });
    if (!uebersicht) {
      return NextResponse.json({ error: "Rechnungsübersicht nicht gefunden" }, { status: 404 });
    }

    const pdfBuffer = await generiereRechnungsuebersichtPdf(id);
    const datumSlug = uebersicht.createdAt.toISOString().slice(0, 10);
    const titelSlug = (uebersicht.titel ?? `Uebersicht-${uebersicht.id}`).replace(/[^A-Za-z0-9\-_]/g, "_");
    const filename = `Rechnungsuebersicht_${titelSlug}_${datumSlug}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    Sentry.captureException(err);
    console.error("Rechnungsuebersicht-Export error:", err);
    return NextResponse.json({ error: "Fehler beim PDF-Export" }, { status: 500 });
  }
}
