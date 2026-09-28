import { NextRequest, NextResponse } from "next/server";
import { generiereKontraktPdf } from "@/lib/pdfGenerator";
import { prisma } from "@/lib/prisma";
import { getModulConfig, requireModul } from "@/lib/modul-config";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";

// GET /api/exporte/kontrakt?kontraktId=X — Liefervereinbarung als PDF herunterladen
export async function GET(req: NextRequest) {
  const modul = await getModulConfig();
  const denyModul = requireModul(modul, "kontrakte");
  if (denyModul) return denyModul;

  const { searchParams } = new URL(req.url);
  const kontraktId = Number(searchParams.get("kontraktId"));
  if (!Number.isInteger(kontraktId) || kontraktId <= 0) {
    return NextResponse.json({ error: "Ungültige kontraktId" }, { status: 400 });
  }

  try {
    const kontrakt = await prisma.kontrakt.findUnique({
      where: { id: kontraktId },
      select: { id: true, nummer: true },
    });
    if (!kontrakt) {
      return NextResponse.json({ error: "Kontrakt nicht gefunden" }, { status: 404 });
    }

    const pdfBuffer = await generiereKontraktPdf(kontraktId);
    const filename = `Kontrakt_${kontrakt.nummer.replace(/[^A-Za-z0-9\-_]/g, "_")}.pdf`;

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
