import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const heute = new Date();
  heute.setHours(0, 0, 0, 0);

  // Alle gelieferten, unbezahlten Lieferungen laden
  const offene = await prisma.lieferung.findMany({
    where: { status: "geliefert", bezahltAm: null },
    include: {
      kunde: { select: { id: true, name: true, firma: true } },
      positionen: { select: { menge: true, verkaufspreis: true } },
    },
    orderBy: { datum: "asc" },
  });

  // Filtern: nur die wirklich überfälligen
  const ueberfaellig = offene.filter((l) => {
    const tage = l.zahlungsziel ?? 30;
    const faellig = new Date(l.datum.getTime() + tage * 24 * 60 * 60 * 1000);
    faellig.setHours(0, 0, 0, 0);
    return heute > faellig;
  });

  return NextResponse.json(ueberfaellig);
}
