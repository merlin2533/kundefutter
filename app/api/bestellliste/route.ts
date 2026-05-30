import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";


// GET /api/bestellliste?status=offen&lieferantId=X
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status"); // offen | bestellt | geliefert | alle
  const lieferantId = searchParams.get("lieferantId");

  const where: Record<string, unknown> = {};
  if (lieferantId) {
    const id = parseInt(lieferantId, 10);
    if (isNaN(id)) return NextResponse.json({ error: "Ungültige lieferantId" }, { status: 400 });
    where.lieferantId = id;
  }
  if (status === "aktiv" || !status) where.status = { in: ["offen", "bestellt", "teilgeliefert"] };
  else if (status !== "alle") where.status = status;

  try {
    const positionen = await prisma.bestellposition.findMany({
      where,
      include: {
        lieferant: { select: { id: true, name: true, email: true, telefon: true } },
        artikel: { select: { id: true, name: true, artikelnummer: true, einheit: true, chargePflicht: true } },
        kunde: { select: { id: true, name: true, firma: true } },
        lieferung: { select: { id: true, datum: true } },
        wareineingangPos: { select: { id: true, chargeNr: true, menge: true, wareneingang: { select: { datum: true } } } },
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 500,
    });
    return NextResponse.json(positionen);
  } catch {
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
