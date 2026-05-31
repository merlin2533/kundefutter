import { NextRequest, NextResponse } from "next/server";
import { generiereGutschriftPdf } from "@/lib/pdfGenerator";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

// GET /api/exporte/gutschrift?gutschriftId=X — Gutschrift als PDF herunterladen
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const gutschriftId = Number(searchParams.get("gutschriftId"));
  if (!Number.isInteger(gutschriftId) || gutschriftId <= 0) {
    return NextResponse.json({ error: "Ungültige gutschriftId" }, { status: 400 });
  }

  try {
    const gutschrift = await prisma.gutschrift.findUnique({
      where: { id: gutschriftId },
      select: { id: true, nummer: true },
    });
    if (!gutschrift) {
      return NextResponse.json({ error: "Gutschrift nicht gefunden" }, { status: 404 });
    }

    const pdfBuffer = await generiereGutschriftPdf(gutschriftId);
    const filename = `Gutschrift_${gutschrift.nummer.replace(/[^A-Za-z0-9\-_]/g, "_")}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdfBuffer.length),
      },
    });
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: `PDF-Generierung fehlgeschlagen: ${msg}` }, { status: 500 });
  }
}
