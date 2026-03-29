import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";

  if (q.length < 2) {
    return NextResponse.json([]);
  }

  // Search by name, firma, ort, telefon (Kunde fields) or kontakt telefon/mobil
  const kunden = await prisma.kunde.findMany({
    where: {
      aktiv: true,
      OR: [
        { name: { contains: q } },
        { firma: { contains: q } },
        { ort: { contains: q } },
        { plz: { contains: q } },
        { kontakte: { some: { wert: { contains: q } } } },
      ],
    },
    include: {
      kontakte: true,
      bedarfe: {
        where: { aktiv: true },
        include: { artikel: { select: { id: true, name: true, einheit: true } } },
      },
    },
    take: 5,
    orderBy: { name: "asc" },
  });

  // For each kunde get last Lieferung + open invoices
  const results = await Promise.all(
    kunden.map(async (k) => {
      const [letzteLiferung, offeneRechnungenRaw] = await Promise.all([
        prisma.lieferung.findFirst({
          where: { kundeId: k.id },
          orderBy: { datum: "desc" },
          include: {
            positionen: {
              take: 3,
              include: { artikel: { select: { name: true } } },
            },
          },
        }),
        prisma.lieferung.findMany({
          where: {
            kundeId: k.id,
            status: "geliefert",
            bezahltAm: null,
            rechnungNr: { not: null },
          },
          select: { id: true, positionen: { select: { menge: true, verkaufspreis: true } } },
        }),
      ]);

      const offeneSumme = offeneRechnungenRaw.reduce((sum, l) => {
        const lSum = l.positionen.reduce((s, p) => s + p.menge * p.verkaufspreis, 0);
        return sum + lSum;
      }, 0);

      return {
        id: k.id,
        name: k.name,
        firma: k.firma,
        strasse: (k as Record<string, unknown>).strasse as string | null,
        plz: k.plz,
        ort: k.ort,
        kontakte: k.kontakte,
        letzteLiferung: letzteLiferung
          ? {
              datum: letzteLiferung.datum,
              artikel: letzteLiferung.positionen.map((p) => p.artikel.name),
            }
          : null,
        offeneRechnungen: {
          anzahl: offeneRechnungenRaw.length,
          summe: offeneSumme,
        },
        bedarfe: k.bedarfe.map((b) => ({
          id: b.id,
          menge: b.menge,
          intervallTage: b.intervallTage,
          artikel: b.artikel,
        })),
      };
    })
  );

  return NextResponse.json(results);
}
