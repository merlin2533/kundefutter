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
        artikel: { select: { id: true, name: true, artikelnummer: true, einheit: true, chargePflicht: true, standardpreis: true } },
        kunde: { select: { id: true, name: true, firma: true } },
        lieferung: { select: { id: true, datum: true } },
        wareineingangPos: { select: { id: true, chargeNr: true, menge: true, wareneingang: { select: { datum: true } } } },
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 500,
    });

    // Fetch customer-specific prices for positions that have a customer + article
    const kundenPreisPairs = positionen
      .filter((p) => p.kundeId != null)
      .map((p) => ({ kundeId: p.kundeId!, artikelId: p.artikelId }));

    const kundenPreise = kundenPreisPairs.length > 0
      ? await prisma.kundeArtikelPreis.findMany({
          where: { OR: kundenPreisPairs },
          select: { kundeId: true, artikelId: true, preis: true, rabatt: true },
        })
      : [];

    const kundenPreisMap = new Map(
      kundenPreise.map((kp) => [`${kp.kundeId}-${kp.artikelId}`, kp])
    );

    const result = positionen.map((p) => {
      const kp = p.kundeId ? kundenPreisMap.get(`${p.kundeId}-${p.artikelId}`) : undefined;
      return {
        ...p,
        kundenpreis: kp ? kp.preis * (1 - kp.rabatt / 100) : null,
      };
    });

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
