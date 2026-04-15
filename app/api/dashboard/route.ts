import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { lagerStatus, addTage } from "@/lib/utils";

export async function GET() {
  try {
  const heute = new Date();
  const monatsAnfang = new Date(heute.getFullYear(), heute.getMonth(), 1);
  const vorMonatAnfang = new Date(heute.getFullYear(), heute.getMonth() - 1, 1);
  const vorMonatEnde = new Date(heute.getFullYear(), heute.getMonth(), 0, 23, 59, 59, 999);

  const vor90Tagen = new Date(heute.getTime() - 90 * 24 * 60 * 60 * 1000);

  const [
    kundenAktiv,
    offeneLieferungen,
    geliefertDiesenMonat,
    geliefertVormonat,
    lagerArtikel,
    topKunden,
    faelligNaechste14Tage,
    offeneRechnungenListe,
    alleBedarfe,
    wiedervorlagenRaw,
    aktivKunden,
    letzteAktivitaetenRaw,
    letzteAngeboteRaw,
    letzteAufgabenErledigtRaw,
    lieferungenOhneRechnungRaw,
  ] = await Promise.all([
    prisma.kunde.count({ where: { aktiv: true } }),
    prisma.lieferung.count({ where: { status: "geplant" } }),
    prisma.lieferung.findMany({
      where: { status: "geliefert", datum: { gte: monatsAnfang } },
      include: { positionen: true },
    }),
    prisma.lieferung.findMany({
      where: { status: "geliefert", datum: { gte: vorMonatAnfang, lte: vorMonatEnde } },
      include: { positionen: { select: { menge: true, verkaufspreis: true, einkaufspreis: true } } },
    }),
    // Nur kritische Artikel laden (Bestand <= Mindestbestand ODER <= 0),
    // nicht alle aktiven Artikel. Spart RAM + Query-Zeit bei großem Katalog.
    prisma.$queryRawUnsafe<
      { id: number; name: string; aktuellerBestand: number; mindestbestand: number; einheit: string }[]
    >(
      `SELECT "id", "name", "aktuellerBestand", "mindestbestand", "einheit"
      FROM "Artikel"
      WHERE "aktiv" = 1
        AND ("aktuellerBestand" <= 0 OR "aktuellerBestand" < "mindestbestand")
      ORDER BY
        CASE WHEN "aktuellerBestand" <= 0 THEN 0 ELSE 1 END,
        "aktuellerBestand" ASC
      LIMIT 20`
    ),
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
      select: {
        id: true,
        datum: true,
        rechnungNr: true,
        rechnungDatum: true,
        zahlungsziel: true,
        kundeId: true,
        kunde: { select: { id: true, name: true, firma: true } },
        positionen: { select: { menge: true, verkaufspreis: true } },
      },
      take: 100,
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
      where: {
        aktiv: true,
        lieferungen: { some: {} },
      },
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
      orderBy: { name: "asc" },
      take: 200,
    }),
    prisma.kundeAktivitaet.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        typ: true,
        betreff: true,
        createdAt: true,
        kunde: { select: { id: true, name: true, firma: true } },
      },
    }),
    prisma.angebot.findMany({
      orderBy: { erstellt: "desc" },
      take: 10,
      select: {
        id: true,
        nummer: true,
        erstellt: true,
        status: true,
        kunde: { select: { id: true, name: true, firma: true } },
      },
    }),
    prisma.aufgabe.findMany({
      where: { erledigt: true },
      orderBy: { erledigtAm: "desc" },
      take: 10,
      select: {
        id: true,
        betreff: true,
        erledigtAm: true,
        typ: true,
        kundeId: true,
        kunde: { select: { id: true, name: true, firma: true } },
      },
    }),
    // Gelieferte Lieferungen ohne Rechnung (weder Sammelrechnung noch eigene Rechnungsnr.)
    prisma.lieferung.findMany({
      where: { status: "geliefert", sammelrechnungId: null, rechnungNr: null },
      select: {
        id: true,
        datum: true,
        kundeId: true,
        kunde: { select: { id: true, name: true, firma: true } },
        positionen: { select: { menge: true, verkaufspreis: true } },
      },
      orderBy: { datum: "asc" },
      take: 20,
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

  // lagerArtikel enthält bereits nur kritische Artikel (DB-seitig gefiltert + sortiert).
  const lagerAlarmArtikel = lagerArtikel
    .map((a) => ({
      id: a.id,
      name: a.name,
      aktuellerBestand: a.aktuellerBestand,
      mindestbestand: a.mindestbestand,
      einheit: a.einheit,
      status: lagerStatus(a.aktuellerBestand, a.mindestbestand) as "rot" | "gelb",
    }))
    .slice(0, 10);

  const lagerAlarme = lagerAlarmArtikel.length;

  const offeneRechnungen = offeneRechnungenListe.length;

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

  // Umsatz + Deckungsbeitrag Vormonat
  const umsatzVormonat = geliefertVormonat.reduce((sum, l) => {
    return sum + l.positionen.reduce((s, p) => s + p.menge * p.verkaufspreis, 0);
  }, 0);

  const deckungsbeitragVormonat = geliefertVormonat.reduce((sum, l) => {
    return sum + l.positionen.reduce((s, p) => s + p.menge * (p.verkaufspreis - p.einkaufspreis), 0);
  }, 0);

  // Fällige Rechnungen: berechne Betrag und Überfälligkeit je Rechnung
  const heuteStart = new Date(heute);
  heuteStart.setHours(0, 0, 0, 0);
  const faelligeRechnungenMitDetails = offeneRechnungenListe.map((l) => {
    const tage = l.zahlungsziel ?? 30;
    const basisDatum = l.rechnungDatum ?? l.datum;
    const faelligDatum = new Date(new Date(basisDatum).getTime() + tage * 24 * 60 * 60 * 1000);
    faelligDatum.setHours(0, 0, 0, 0);
    const ueberfaelligTage = Math.max(0, Math.floor((heuteStart.getTime() - faelligDatum.getTime()) / (24 * 60 * 60 * 1000)));
    const betrag = l.positionen.reduce((s, p) => s + p.menge * p.verkaufspreis, 0);
    return {
      id: l.id,
      rechnungNr: l.rechnungNr,
      kundeId: l.kundeId,
      kundeName: l.kunde ? (l.kunde.firma ?? l.kunde.name) : "?",
      betrag: Math.round(betrag * 100) / 100,
      faelligAm: faelligDatum.toISOString(),
      ueberfaelligTage,
    };
  });

  const faelligeRechnungenSumme = faelligeRechnungenMitDetails.reduce((s, r) => s + r.betrag, 0);
  const ueberfaelligeRechnungen = faelligeRechnungenMitDetails.filter((r) => r.ueberfaelligTage > 0).length;
  const faelligeRechnungen = faelligeRechnungenMitDetails
    .sort((a, b) => b.ueberfaelligTage - a.ueberfaelligTage)
    .slice(0, 5);

  // Lager-Kritisch: Top 5 kritischste Artikel (rot zuerst, dann gelb)
  const lagerKritisch = lagerAlarmArtikel.slice(0, 5);

  // Letzte Aktivitäten Timeline: kombiniere CRM, Lieferungen, Angebote, erledigte Aufgaben
  type TimelineEntry = {
    id: string;
    zeitpunkt: string;
    typ: "crm" | "lieferung" | "angebot" | "aufgabe";
    icon: string;
    titel: string;
    kundeName?: string;
    kundeId?: number;
    link?: string;
  };

  const timeline: TimelineEntry[] = [];

  // CRM-Aktivitäten
  for (const a of letzteAktivitaetenRaw) {
    timeline.push({
      id: `crm-${a.id}`,
      zeitpunkt: a.createdAt.toISOString(),
      typ: "crm",
      icon: a.typ === "besuch" ? "👤" : a.typ === "anruf" ? "📞" : a.typ === "email" ? "✉️" : "💬",
      titel: a.betreff,
      kundeName: a.kunde ? (a.kunde.firma ?? a.kunde.name) : undefined,
      kundeId: a.kunde?.id,
      link: a.kunde ? `/kunden/${a.kunde.id}?tab=CRM` : "/crm",
    });
  }

  // Neue Lieferungen (letzten 10)
  const letzteNeuereLieferungen = await prisma.lieferung.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      createdAt: true,
      status: true,
      kunde: { select: { id: true, name: true, firma: true } },
    },
  });
  for (const l of letzteNeuereLieferungen) {
    timeline.push({
      id: `lieferung-${l.id}`,
      zeitpunkt: l.createdAt.toISOString(),
      typ: "lieferung",
      icon: "📦",
      titel: `Lieferung ${l.status === "geliefert" ? "geliefert" : "geplant"}`,
      kundeName: l.kunde ? (l.kunde.firma ?? l.kunde.name) : undefined,
      kundeId: l.kunde?.id,
      link: `/lieferungen/${l.id}`,
    });
  }

  // Neue Angebote
  for (const a of letzteAngeboteRaw) {
    timeline.push({
      id: `angebot-${a.id}`,
      zeitpunkt: a.erstellt.toISOString(),
      typ: "angebot",
      icon: "📝",
      titel: `Angebot ${a.nummer}`,
      kundeName: a.kunde ? (a.kunde.firma ?? a.kunde.name) : undefined,
      kundeId: a.kunde?.id,
      link: `/angebote/${a.id}`,
    });
  }

  // Erledigte Aufgaben
  for (const a of letzteAufgabenErledigtRaw) {
    if (!a.erledigtAm) continue;
    timeline.push({
      id: `aufgabe-${a.id}`,
      zeitpunkt: a.erledigtAm.toISOString(),
      typ: "aufgabe",
      icon: "✅",
      titel: a.betreff,
      kundeName: a.kunde ? (a.kunde.firma ?? a.kunde.name) : undefined,
      kundeId: a.kundeId ?? undefined,
      link: a.kundeId ? `/kunden/${a.kundeId}?tab=Aufgaben` : "/aufgaben",
    });
  }

  // Chronologisch absteigend sortieren, Top 10
  const letzteAktivitaeten = timeline
    .sort((a, b) => new Date(b.zeitpunkt).getTime() - new Date(a.zeitpunkt).getTime())
    .slice(0, 10);

  const lieferungenOhneRechnung = lieferungenOhneRechnungRaw.map((l) => ({
    id: l.id,
    datum: l.datum.toISOString(),
    kundeId: l.kundeId,
    kundeName: l.kunde ? (l.kunde.firma ?? l.kunde.name) : "?",
    betrag: Math.round(l.positionen.reduce((s, p) => s + p.menge * p.verkaufspreis, 0) * 100) / 100,
    tageOhneRechnung: Math.floor((heute.getTime() - new Date(l.datum).getTime()) / (24 * 60 * 60 * 1000)),
  }));

  // Kein Kontakt (90+ Tage, mindestens 1 Lieferung)
  const keinKontakt = aktivKunden
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

  // Offene/unzugeordnete Bankbuchungen (Kontoumsatz-Tabelle kann noch fehlen)
  let unzugeordneteUmsaetze = 0;
  try {
    unzugeordneteUmsaetze = await (prisma as unknown as { kontoumsatz: { count: (args: { where: { zugeordnet: boolean } }) => Promise<number> } }).kontoumsatz.count({ where: { zugeordnet: false } });
  } catch {
    // Tabelle existiert noch nicht — ignorieren
    unzugeordneteUmsaetze = 0;
  }

  return NextResponse.json({
    kundenAktiv,
    offeneLieferungen,
    umsatzMonat: Math.round(umsatzMonat * 100) / 100,
    umsatzVormonat: Math.round(umsatzVormonat * 100) / 100,
    deckungsbeitragMonat: Math.round(deckungsbeitragMonat * 100) / 100,
    deckungsbeitragVormonat: Math.round(deckungsbeitragVormonat * 100) / 100,
    lagerAlarme,
    artikelAlarme: lagerAlarmArtikel,
    lagerKritisch,
    faelligNaechste14Tage,
    offeneRechnungen,
    ueberfaelligeRechnungen,
    faelligeRechnungen,
    faelligeRechnungenSumme: Math.round(faelligeRechnungenSumme * 100) / 100,
    wiederkehrendFaellig,
    topKunden: topKundenMitNamen.sort((a, b) => b.umsatz - a.umsatz),
    markttrend,
    wiedervorlagen,
    keinKontakt,
    letzteAktivitaeten,
    lieferungenOhneRechnung,
    unzugeordneteUmsaetze,
  });
  } catch (e) {
    console.error("Dashboard API error:", e);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
