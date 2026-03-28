import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { addTage, berechneVerkaufspreis } from "@/lib/utils";

// GET: Zeigt fällige wiederkehrende Lieferungen (nächste X Tage)
// ?tage=30  – Vorschau für die nächsten N Tage (default 30)
// ?nurFaellig=1 – nur überfällige (naechstesDatum <= heute)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tage = Number(searchParams.get("tage") ?? "30");
  const nurFaellig = searchParams.get("nurFaellig") === "1";
  const bis = nurFaellig ? new Date() : addTage(new Date(), tage);

  const bedarfe = await prisma.kundeBedarf.findMany({
    where: { aktiv: true },
    include: {
      kunde: true,
      artikel: true,
    },
  });

  const faellig = [];

  if (bedarfe.length > 0) {
    // Fix 9: single bulk query instead of N+1 per-bedarf DB queries
    const artikelIds = [...new Set(bedarfe.map((b) => b.artikelId))];
    const kundeIds = [...new Set(bedarfe.map((b) => b.kundeId))];

    const letzteLieferungen = await prisma.lieferposition.findMany({
      where: {
        artikelId: { in: artikelIds },
        lieferung: { kundeId: { in: kundeIds }, status: { not: "storniert" } },
      },
      select: { artikelId: true, lieferung: { select: { kundeId: true, datum: true } } },
      orderBy: { lieferung: { datum: "desc" } },
    });

    // Build map: "artikelId|kundeId" → latest datum
    const latestMap = new Map<string, Date>();
    for (const pos of letzteLieferungen) {
      const key = `${pos.artikelId}|${pos.lieferung.kundeId}`;
      if (!latestMap.has(key)) latestMap.set(key, new Date(pos.lieferung.datum));
    }

    for (const bedarf of bedarfe) {
      const letztesDatum = latestMap.get(`${bedarf.artikelId}|${bedarf.kundeId}`) ?? new Date(0);
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
  }

  faellig.sort((a, b) => a.naechstesDatum.getTime() - b.naechstesDatum.getTime());
  return NextResponse.json(faellig);
}

// POST: Legt aus Bedarfen automatisch geplante Lieferungen an
// Body: { bedarfIds: number[] }           – bestimmte Bedarfe anlegen
//       { alleAusloesen: true }           – alle fälligen Bedarfe anlegen
//       { ids: number[] }                 – Alias für bedarfIds
export async function POST(req: NextRequest) {
  const body = await req.json();

  let bedarfIds: number[] = body.bedarfIds ?? body.ids ?? [];

  // alleAusloesen: alle fälligen (ueberfaellig) Bedarfe ermitteln
  if (body.alleAusloesen) {
    const bedarfe = await prisma.kundeBedarf.findMany({
      where: { aktiv: true },
      include: { artikel: true },
    });

    const heute = new Date();
    const faelligeIds: number[] = [];

    if (bedarfe.length > 0) {
      // Fix 10 (alleAusloesen path): bulk query instead of N+1
      const artikelIds = [...new Set(bedarfe.map((b) => b.artikelId))];
      const kundeIds = [...new Set(bedarfe.map((b) => b.kundeId))];

      const letzteLieferungen = await prisma.lieferposition.findMany({
        where: {
          artikelId: { in: artikelIds },
          lieferung: { kundeId: { in: kundeIds }, status: { not: "storniert" } },
        },
        select: { artikelId: true, lieferung: { select: { kundeId: true, datum: true } } },
        orderBy: { lieferung: { datum: "desc" } },
      });

      const latestMap = new Map<string, Date>();
      for (const pos of letzteLieferungen) {
        const key = `${pos.artikelId}|${pos.lieferung.kundeId}`;
        if (!latestMap.has(key)) latestMap.set(key, new Date(pos.lieferung.datum));
      }

      for (const bedarf of bedarfe) {
        const letztesDatum = latestMap.get(`${bedarf.artikelId}|${bedarf.kundeId}`) ?? new Date(0);
        const naechstesDatum = addTage(new Date(letztesDatum), bedarf.intervallTage);
        if (naechstesDatum <= heute) {
          faelligeIds.push(bedarf.id);
        }
      }
    }

    bedarfIds = faelligeIds;
  }

  if (bedarfIds.length === 0) {
    return NextResponse.json({ ausgeloest: 0, lieferungen: [] });
  }

  // Fix 10: bulk lookups instead of per-bedarfId queries
  const bedarfeListe = await prisma.kundeBedarf.findMany({
    where: { id: { in: bedarfIds } },
    include: { artikel: true },
  });

  if (bedarfeListe.length === 0) {
    return NextResponse.json({ ausgeloest: 0, lieferungen: [] });
  }

  const artikelIds = [...new Set(bedarfeListe.map((b) => b.artikelId))];
  const kundeIds = [...new Set(bedarfeListe.map((b) => b.kundeId))];

  const [kundeArtikelPreise, artikelLieferanten] = await Promise.all([
    prisma.kundeArtikelPreis.findMany({
      where: { artikelId: { in: artikelIds }, kundeId: { in: kundeIds } },
    }),
    prisma.artikelLieferant.findMany({
      where: { artikelId: { in: artikelIds }, bevorzugt: true },
    }),
  ]);

  // Build maps for O(1) lookup
  const kundePreisMap = new Map<string, typeof kundeArtikelPreise[number]>();
  for (const kp of kundeArtikelPreise) {
    kundePreisMap.set(`${kp.kundeId}|${kp.artikelId}`, kp);
  }
  const lieferantMap = new Map<number, typeof artikelLieferanten[number]>();
  for (const al of artikelLieferanten) {
    if (!lieferantMap.has(al.artikelId)) lieferantMap.set(al.artikelId, al);
  }

  // Build a map from bedarfId to bedarf for ordered processing
  const bedarfMap = new Map(bedarfeListe.map((b) => [b.id, b]));

  const angelegt = [];

  for (const bedarfId of bedarfIds) {
    const bedarf = bedarfMap.get(bedarfId);
    if (!bedarf) continue;

    const kundePreis = kundePreisMap.get(`${bedarf.kundeId}|${bedarf.artikelId}`) ?? null;
    const bevorzugterLieferant = lieferantMap.get(bedarf.artikelId) ?? null;

    const lieferung = await prisma.lieferung.create({
      data: {
        kundeId: bedarf.kundeId,
        datum: new Date(),
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

  return NextResponse.json(
    { ausgeloest: angelegt.length, lieferungen: angelegt.map((l) => l.id) },
    { status: 201 }
  );
}
