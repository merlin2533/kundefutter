import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { lagerStatus, addTage } from "@/lib/utils";

export async function GET() {
  const heute = new Date();
  const monatsAnfang = new Date(heute.getFullYear(), heute.getMonth(), 1);

  const [
    kundenAktiv,
    offeneLieferungen,
    geliefertDiesenMonat,
    lagerArtikel,
    topKunden,
    faelligNaechste14Tage,
    offeneRechnungenListe,
    alleBedarfe,
  ] = await Promise.all([
    prisma.kunde.count({ where: { aktiv: true } }),
    prisma.lieferung.count({ where: { status: "geplant" } }),
    prisma.lieferung.findMany({
      where: { status: "geliefert", datum: { gte: monatsAnfang } },
      include: { positionen: true },
    }),
    prisma.artikel.findMany({ where: { aktiv: true } }),
    prisma.lieferung.groupBy({
      by: ["kundeId"],
      where: { status: "geliefert", datum: { gte: monatsAnfang } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 5,
    }),
    prisma.lieferung.count({
      where: {
        status: "geplant",
        datum: { lte: new Date(heute.getTime() + 14 * 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.lieferung.findMany({
      where: { status: "geliefert", bezahltAm: null, rechnungNr: { not: null } },
      select: { datum: true, rechnungDatum: true, zahlungsziel: true },
    }),
    prisma.kundeBedarf.findMany({
      where: { aktiv: true },
      include: { artikel: true },
    }),
  ]);

  const umsatzMonat = geliefertDiesenMonat.reduce((sum, l) => {
    return sum + l.positionen.reduce((s, p) => s + p.menge * p.verkaufspreis, 0);
  }, 0);

  const deckungsbeitragMonat = geliefertDiesenMonat.reduce((sum, l) => {
    return (
      sum +
      l.positionen.reduce(
        (s, p) => s + p.menge * (p.verkaufspreis - p.einkaufspreis),
        0
      )
    );
  }, 0);

  const lagerAlarme = lagerArtikel.filter(
    (a) => lagerStatus(a.aktuellerBestand, a.mindestbestand) !== "gruen"
  ).length;

  const heuteStart = new Date(heute);
  heuteStart.setHours(0, 0, 0, 0);
  const offeneRechnungen = offeneRechnungenListe.length;
  const ueberfaelligeRechnungen = offeneRechnungenListe.filter((l) => {
    const tage = l.zahlungsziel ?? 30;
    const basisDatum = l.rechnungDatum ?? l.datum;
    const faellig = new Date(new Date(basisDatum).getTime() + tage * 24 * 60 * 60 * 1000);
    faellig.setHours(0, 0, 0, 0);
    return heuteStart > faellig;
  }).length;

  // Top-Kunden mit Namen anreichern (aus bereits geladenen Daten berechnen)
  const topKundenIds = topKunden.map((k) => k.kundeId);
  const topKundenEntities = await prisma.kunde.findMany({
    where: { id: { in: topKundenIds } },
    select: { id: true, name: true },
  });
  const kundeNameMap = new Map(topKundenEntities.map((k) => [k.id, k.name]));

  // Umsatz aus bereits geladenen geliefertDiesenMonat berechnen
  const kundeUmsatzMap = new Map<number, number>();
  for (const l of geliefertDiesenMonat) {
    if (!topKundenIds.includes(l.kundeId)) continue;
    const total = l.positionen.reduce((s, p) => s + p.menge * p.verkaufspreis, 0);
    kundeUmsatzMap.set(l.kundeId, (kundeUmsatzMap.get(l.kundeId) ?? 0) + total);
  }

  const topKundenMitNamen = topKunden.map((k) => ({
    kundeId: k.kundeId,
    name: kundeNameMap.get(k.kundeId) ?? "?",
    umsatz: kundeUmsatzMap.get(k.kundeId) ?? 0,
  }));

  // Wiederkehrend fällig: Bedarfe, deren nächstes Lieferdatum <= heute
  let wiederkehrendFaellig = 0;
  for (const bedarf of alleBedarfe) {
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
    if (naechstesDatum <= heute) {
      wiederkehrendFaellig++;
    }
  }

  // Markttrend aus Cache laden (letzte 2 Quartale für die 3 Hauptkategorien)
  const hauptCodes = [
    { code: "206000", label: "Futter" },
    { code: "203000", label: "Dünger" },
    { code: "201000", label: "Saatgut" },
  ];
  const alleMarktpreise = await prisma.marktpreisCache.findMany({
    where: {
      dataset: "apri_pi15_inq",
      produktCode: { in: hauptCodes.map((c) => c.code) },
      land: "DE",
    },
    orderBy: { zeitraum: "desc" },
  });
  const markttrend: { kategorie: string; aktuell: number; veraenderung: number }[] = [];
  for (const { code, label } of hauptCodes) {
    const recent = alleMarktpreise.filter((m) => m.produktCode === code).slice(0, 2);
    if (recent.length > 0) {
      const aktuell = recent[0].indexWert;
      const vorq = recent.length > 1 ? recent[1].indexWert : aktuell;
      const veraenderung = vorq !== 0 ? ((aktuell - vorq) / vorq) * 100 : 0;
      markttrend.push({
        kategorie: label,
        aktuell: Math.round(aktuell * 10) / 10,
        veraenderung: Math.round(veraenderung * 10) / 10,
      });
    }
  }

  return NextResponse.json({
    kundenAktiv,
    offeneLieferungen,
    umsatzMonat: Math.round(umsatzMonat * 100) / 100,
    deckungsbeitragMonat: Math.round(deckungsbeitragMonat * 100) / 100,
    lagerAlarme,
    faelligNaechste14Tage,
    offeneRechnungen,
    ueberfaelligeRechnungen,
    wiederkehrendFaellig,
    topKunden: topKundenMitNamen.sort((a, b) => b.umsatz - a.umsatz),
    markttrend,
  });
}
