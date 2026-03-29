import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);
  const vor30Tagen = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    offeneAufgaben,
    faelligeAnrufe,
    heutigeTouren,
    offeneLieferungenCount,
  ] = await Promise.all([
    prisma.aufgabe.findMany({
      where: {
        erledigt: false,
        faelligAm: { lte: now },
      },
      include: { kunde: { select: { id: true, name: true, firma: true } } },
      orderBy: [{ prioritaet: "desc" }, { faelligAm: "asc" }],
      take: 50,
    }),
    prisma.kundeAktivitaet.findMany({
      where: {
        erledigt: false,
        typ: "anruf",
        faelligAm: { lte: now },
      },
      include: { kunde: { select: { id: true, name: true, firma: true } } },
      orderBy: { faelligAm: "asc" },
      take: 50,
    }),
    prisma.lieferung.findMany({
      where: {
        datum: { gte: todayStart, lte: todayEnd },
        status: { in: ["geplant", "geliefert"] },
      },
      include: { kunde: { select: { id: true, name: true, firma: true } } },
      orderBy: { datum: "asc" },
    }),
    prisma.lieferung.count({
      where: { status: "geplant" },
    }),
  ]);

  // Kunden without contact in 30 days (aktiv=true, has at least 1 Lieferung)
  // Find last aktivitaet per kunde and filter those > 30 days ago
  const kunden = await prisma.kunde.findMany({
    where: { aktiv: true },
    select: {
      id: true,
      name: true,
      firma: true,
      aktivitaeten: {
        orderBy: { datum: "desc" },
        take: 1,
        select: { datum: true },
      },
      lieferungen: {
        take: 1,
        select: { id: true },
      },
    },
    take: 200,
  });

  const keinKontakt30 = kunden
    .filter((k) => {
      // must have at least 1 Lieferung
      if (k.lieferungen.length === 0) return false;
      const letzte = k.aktivitaeten[0];
      if (!letzte) return true; // never contacted
      return new Date(letzte.datum) < vor30Tagen;
    })
    .slice(0, 10)
    .map((k) => ({
      id: k.id,
      name: k.name,
      firma: k.firma,
      letzteAktivitaet: k.aktivitaeten[0]?.datum ?? null,
    }));

  return NextResponse.json({
    offeneAufgaben,
    faelligeAnrufe,
    keinKontakt30,
    heutigeTouren,
    offeneLieferungen: offeneLieferungenCount,
  });
}
