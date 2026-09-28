import { prisma } from "@/lib/prisma";
import { addTage, berechneVerkaufspreis } from "@/lib/utils";
import { liefposArtikelSelect } from "@/lib/artikel-select";
import { ladeStandardZahlungsziel } from "@/lib/lieferung";

export interface FaelligerBedarf {
  bedarf: Awaited<ReturnType<typeof ladeAktiveBedarfeMitArtikel>>[number];
  letztesDatum: Date;
  naechstesDatum: Date;
  ueberfaellig: boolean;
}

async function ladeAktiveBedarfeMitArtikel() {
  return prisma.kundeBedarf.findMany({
    where: { aktiv: true },
    include: { kunde: true, artikel: { select: liefposArtikelSelect } },
  });
}

// Einzige Quelle der Wahrheit für "welche Bedarfe sind bis wann fällig" — genutzt von der
// Vorschau (GET /api/lieferungen/wiederkehrend), dem manuellen "alle fälligen auslösen"
// (POST .../wiederkehrend {alleAusloesen:true}) UND dem Cron-Job, damit alle drei denselben
// Fälligkeits-Begriff nutzen und nie auseinanderlaufen.
export async function ermittleFaelligeBedarfe(bis: Date): Promise<FaelligerBedarf[]> {
  const bedarfe = await ladeAktiveBedarfeMitArtikel();
  const faellig: FaelligerBedarf[] = [];
  if (bedarfe.length === 0) return faellig;

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
    if (naechstesDatum <= bis) {
      faellig.push({ bedarf, letztesDatum, naechstesDatum, ueberfaellig: naechstesDatum < new Date() });
    }
  }

  return faellig;
}

// Legt für die übergebenen KundeBedarf-IDs je eine geplante Lieferung an (dieselbe Logik wie
// zuvor inline in POST /api/lieferungen/wiederkehrend) — genutzt von der API-Route UND dem
// neuen Cron-Job.
export async function erstelleWiederkehrendeLieferungen(bedarfIds: number[]): Promise<number[]> {
  if (bedarfIds.length === 0) return [];

  const bedarfeListe = await prisma.kundeBedarf.findMany({
    where: { id: { in: bedarfIds } },
    include: { artikel: { select: liefposArtikelSelect } },
  });
  if (bedarfeListe.length === 0) return [];

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

  const kundePreisMap = new Map<string, (typeof kundeArtikelPreise)[number]>();
  for (const kp of kundeArtikelPreise) kundePreisMap.set(`${kp.kundeId}|${kp.artikelId}`, kp);
  const lieferantMap = new Map<number, (typeof artikelLieferanten)[number]>();
  for (const al of artikelLieferanten) {
    if (!lieferantMap.has(al.artikelId)) lieferantMap.set(al.artikelId, al);
  }

  const bedarfMap = new Map(bedarfeListe.map((b) => [b.id, b]));
  const zahlungsziel = await ladeStandardZahlungsziel();
  const angelegtIds: number[] = [];

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
        zahlungsziel,
        positionen: {
          create: [{
            artikelId: bedarf.artikelId,
            menge: bedarf.menge,
            verkaufspreis: berechneVerkaufspreis(bedarf.artikel, kundePreis),
            einkaufspreis: bevorzugterLieferant?.einkaufspreis ?? 0,
            verpackungsart: bedarf.artikel.verpackungsart ?? null,
          }],
        },
      },
      select: { id: true },
    });
    angelegtIds.push(lieferung.id);
  }

  return angelegtIds;
}
