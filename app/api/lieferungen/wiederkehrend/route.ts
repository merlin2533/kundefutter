import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { addTage, berechneVerkaufspreis } from "@/lib/utils";

// GET: Zeigt fällige wiederkehrende Lieferungen (nächste X Tage)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tage = Number(searchParams.get("tage") ?? "30");
  const bis = addTage(new Date(), tage);

  const bedarfe = await prisma.kundeBedarf.findMany({
    where: { aktiv: true },
    include: {
      kunde: true,
      artikel: true,
    },
  });

  const faellig = [];

  for (const bedarf of bedarfe) {
    // Letzte Lieferung dieses Artikels an diesen Kunden ermitteln
    const letztePos = await prisma.lieferposition.findFirst({
      where: {
        artikelId: bedarf.artikelId,
        lieferung: {
          kundeId: bedarf.kundeId,
          status: { not: "storniert" },
        },
      },
      orderBy: { lieferung: { datum: "desc" } },
      include: { lieferung: true },
    });

    const letztesDatum = letztePos?.lieferung?.datum ?? new Date(0);
    const naechstesDatum = addTage(new Date(letztesDatum), bedarf.intervallTage);

    if (naechstesDatum <= bis) {
      faellig.push({
        bedarf,
        letztesDatum,
        naechstesDatum,
        ueberfaellig: naechstesDatum < new Date(),
      });
    }
  }

  faellig.sort((a, b) => a.naechstesDatum.getTime() - b.naechstesDatum.getTime());
  return NextResponse.json(faellig);
}

// POST: Legt aus Bedarfen automatisch geplante Lieferungen an
export async function POST(req: NextRequest) {
  const { bedarfIds } = await req.json();

  const angelegt = [];

  for (const bedarfId of bedarfIds) {
    const bedarf = await prisma.kundeBedarf.findUnique({
      where: { id: bedarfId },
      include: { artikel: true },
    });
    if (!bedarf) continue;

    const kundePreis = await prisma.kundeArtikelPreis.findUnique({
      where: { kundeId_artikelId: { kundeId: bedarf.kundeId, artikelId: bedarf.artikelId } },
    });
    const bevorzugterLieferant = await prisma.artikelLieferant.findFirst({
      where: { artikelId: bedarf.artikelId, bevorzugt: true },
    });

    const lieferung = await prisma.lieferung.create({
      data: {
        kundeId: bedarf.kundeId,
        wiederkehrend: true,
        notiz: `Automatisch angelegt aus Bedarf (Intervall: ${bedarf.intervallTage} Tage)`,
        positionen: {
          create: [{
            artikelId: bedarf.artikelId,
            menge: bedarf.menge,
            verkaufspreis: berechneVerkaufspreis(bedarf.artikel, kundePreis),
            einkaufspreis: bevorzugterLieferant?.einkaufspreis ?? 0,
          }],
        },
      },
      include: {
        kunde: true,
        positionen: { include: { artikel: true } },
      },
    });
    angelegt.push(lieferung);
  }

  return NextResponse.json(angelegt, { status: 201 });
}
