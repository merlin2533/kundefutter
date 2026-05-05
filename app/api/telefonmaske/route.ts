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

  try {
    const kundeIds = kunden.map((k) => k.id);

    const [alleLetzteLieferungen, alleOffenenLieferungen] = await Promise.all([
      prisma.lieferung.findMany({
        where: { kundeId: { in: kundeIds }, status: { not: "storniert" } },
        orderBy: { datum: "desc" },
        take: kundeIds.length * 5,
        include: {
          positionen: {
            take: 3,
            include: { artikel: { select: { name: true } } },
          },
        },
      }),
      prisma.lieferung.findMany({
        where: {
          kundeId: { in: kundeIds },
          status: "geliefert",
          bezahltAm: null,
          rechnungNr: { not: null },
        },
        select: { id: true, kundeId: true, positionen: { select: { menge: true, verkaufspreis: true } } },
      }),
    ]);

    // Letzte Lieferung je Kunde ermitteln (Liste ist bereits nach datum desc sortiert)
    const letzteProKunde = new Map<number, typeof alleLetzteLieferungen[0]>();
    for (const l of alleLetzteLieferungen) {
      if (!letzteProKunde.has(l.kundeId)) letzteProKunde.set(l.kundeId, l);
    }

    // Offene Rechnungen je Kunde gruppieren
    const offeneProKunde = new Map<number, typeof alleOffenenLieferungen>();
    for (const l of alleOffenenLieferungen) {
      const list = offeneProKunde.get(l.kundeId) ?? [];
      list.push(l);
      offeneProKunde.set(l.kundeId, list);
    }

    const results = kunden.map((k) => {
      const letzteLiferung = letzteProKunde.get(k.id) ?? null;
      const offeneRechnungenRaw = offeneProKunde.get(k.id) ?? [];
      const offeneSumme = offeneRechnungenRaw.reduce((sum, l) => {
        return sum + l.positionen.reduce((s, p) => s + p.menge * p.verkaufspreis, 0);
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
    });

    return NextResponse.json(results);
  } catch (e) {
    console.error("Telefonmaske GET error:", e);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
