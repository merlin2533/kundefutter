import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/lager/chargen?charge=X
// Returns wareneingaenge and lieferungen containing the given charge number.
// Note: WareineingangPosition does not have chargeNr in the schema,
// so we only search Lieferposition.chargeNr directly, and return
// Wareneingaenge as an empty array unless chargeNr is added later.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const charge = searchParams.get("charge")?.trim();
  if (!charge) {
    return NextResponse.json({ error: "charge Parameter fehlt" }, { status: 400 });
  }

  // Search Lieferposition.chargeNr
  const lieferpositionen = await prisma.lieferposition.findMany({
    where: { chargeNr: { contains: charge } },
    include: {
      lieferung: {
        include: {
          kunde: { select: { id: true, name: true, firma: true } },
        },
      },
      artikel: { select: { id: true, name: true, einheit: true } },
    },
  });

  const lieferungen = lieferpositionen.map((pos) => ({
    lieferpositionId: pos.id,
    chargeNr: pos.chargeNr,
    datum: pos.lieferung.datum,
    lieferungId: pos.lieferung.id,
    status: pos.lieferung.status,
    kunde: pos.lieferung.kunde,
    artikel: pos.artikel,
    menge: pos.menge,
  }));

  // WareineingangPosition has no chargeNr field in current schema — return empty
  const wareneingaenge: unknown[] = [];

  return NextResponse.json({ wareneingaenge, lieferungen });
}
