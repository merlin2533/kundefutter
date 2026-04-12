import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generiereLieferscheinPdf } from "@/lib/pdfGenerator";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lieferungId = Number(searchParams.get("lieferungId"));

  if (!Number.isInteger(lieferungId) || lieferungId <= 0) {
    return NextResponse.json({ error: "lieferungId fehlt oder ungültig" }, { status: 400 });
  }

  try {
    const lieferung = await prisma.lieferung.findUnique({ where: { id: lieferungId } });
    if (!lieferung) {
      return NextResponse.json({ error: "Lieferung nicht gefunden" }, { status: 404 });
    }

    const pdfBuffer = await generiereLieferscheinPdf(lieferungId);
    const filename = `lieferschein-${lieferungId}-${new Date().toISOString().slice(0, 10)}.pdf`;

    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Fehler beim Erstellen des Lieferscheins" }, { status: 500 });
  }
}
