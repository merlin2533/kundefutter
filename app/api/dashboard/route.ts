import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { lagerStatus, addTage } from "@/lib/utils";

export async function GET() {
  const heute = new Date();
  const monatsAnfang = new Date(heute.getFullYear(), heute.getMonth(), 1);

  const vor90Tagen = new Date(heute.getTime() - 90 * 24 * 60 * 60 * 1000);

  const [
    kundenAktiv,
    offeneLieferungen,
    geliefertDiesenMonat,
    lagerArtikel,
    topKunden,
    faelligNaechste14Tage,
    offeneRechnungenListe,
    alleBedarfe,
    wiedervorlagenRaw,
    aktivKunden,
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
    prisma.kundeAktivitaet.findMany({
      where: { erledigt: false, faelligAm: { lte: heute } },
      include: { kunde: { select: { id: true, name: true, firma: true } } },
      orderBy: { faelligAm: "asc" },
      take: 10,
    }),
    prisma.kunde.findMany({
      where: { aktiv: true },
      select: {
        id: true,
        name: true,
        firma: true,
        aktivitaeten: {
          select: { datum: true },
          orderBy: { datum: "desc" },
          take: 1,
        },
        lieferungen: {
          select: { id: true },
          take: 1,
        },
      },
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

  const lagerAlarmArtikel = lagerArtikel
    .filter((a) => lagerStatus(a.aktuellerBestand, a.mindestbestand) !== "gruen")
    .map((a) => ({
      id: a.id,
      name: a.name,
      aktuellerBestand: a.aktuellerBestand,
      mindestbestand: a.mindestbestand,
      einheit: a.einheit,
      status: lagerStatus(a.aktuellerBestand, a.mindestbestand) as "rot" | "gelb",
    }))
    .sort((a, b) => {
      if (a.status === b.status) return 0;
      return a.status === "rot" ? -1 : 1;
    })
    .slice(0, 10);

  const lagerAlarme = lagerAlarmArtikel.length;

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

  // Wiederkehrend fällig: single bulk query instead of N+1
  let wiederkehrendFaellig = 0;
  if (alleBedarfe.length > 0) {
    const artikelIds = [...new Set(alleBedarfe.map((b) => b.artikelId))];
    const kundeIds = [...new Set(alleBedarfe.map((b) => b.kundeId))];
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
    for (const bedarf of alleBedarfe) {
      const letztesDatum = latestMap.get(`${bedarf.artikelId}|${bedarf.kundeId}`) ?? new Date(0);
      if (addTage(letztesDatum, bedarf.intervallTage) <= heute) wiederkehrendFaellig++;
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

  // Wiedervorlagen
  const wiedervorlagen = wiedervorlagenRaw.map((a) => ({
    id: a.id,
    betreff: a.betreff,
    typ: a.typ,
    faelligAm: a.faelligAm ? a.faelligAm.toISOString() : null,
    kundeId: a.kundeId,
    kundeName: a.kunde ? (a.kunde.firma ?? a.kunde.name) : null,
  }));

  // Kein Kontakt (90+ Tage, mindestens 1 Lieferung)
  const keinKontakt = aktivKunden
    .filter((k) => k.lieferungen.length > 0)
    .map((k) => ({
      id: k.id,
      name: k.name,
      firma: k.firma,
      letzterKontakt:
        k.aktivitaeten.length > 0 ? k.aktivitaeten[0].datum.toISOString() : null,
    }))
    .filter((k) => {
      if (!k.letzterKontakt) return true;
      return new Date(k.letzterKontakt) < vor90Tagen;
    })
    .sort((a, b) => {
      if (!a.letzterKontakt) return -1;
      if (!b.letzterKontakt) return 1;
      return new Date(a.letzterKontakt).getTime() - new Date(b.letzterKontakt).getTime();
    })
    .slice(0, 8);

  return NextResponse.json({
    kundenAktiv,
    offeneLieferungen,
    umsatzMonat: Math.round(umsatzMonat * 100) / 100,
    deckungsbeitragMonat: Math.round(deckungsbeitragMonat * 100) / 100,
    lagerAlarme,
    artikelAlarme: lagerAlarmArtikel,
    faelligNaechste14Tage,
    offeneRechnungen,
    ueberfaelligeRechnungen,
    wiederkehrendFaellig,
    topKunden: topKundenMitNamen.sort((a, b) => b.umsatz - a.umsatz),
    markttrend,
    wiedervorlagen,
    keinKontakt,
  });
}
