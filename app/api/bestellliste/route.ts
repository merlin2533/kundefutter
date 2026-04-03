import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/bestellliste?status=offen&lieferantId=X
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status"); // offen | bestellt | geliefert | alle
  const lieferantId = searchParams.get("lieferantId");

  const where: Record<string, unknown> = {};
  if (lieferantId) where.lieferantId = parseInt(lieferantId, 10);
  if (status && status !== "alle") where.status = status;
  else if (!status) where.status = { in: ["offen", "bestellt"] }; // default: aktive

  try {
    const positionen = await prisma.bestellposition.findMany({
      where,
      include: {
        lieferant: { select: { id: true, name: true, email: true, telefon: true } },
        artikel: { select: { id: true, name: true, artikelnummer: true, einheit: true } },
        kunde: { select: { id: true, name: true, firma: true } },
        lieferung: { select: { id: true, datum: true } },
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 500,
    });
    return NextResponse.json(positionen);
  } catch {
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
