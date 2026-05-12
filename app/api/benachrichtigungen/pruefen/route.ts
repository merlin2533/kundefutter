import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

// Prüft alle relevanten Daten und erzeugt neue Benachrichtigungen (idempotent).
// Eine Benachrichtigung wird nicht doppelt erstellt wenn typ+kundeId/artikelId heute schon existiert.

async function existiertHeuteSchon(typ: string, kundeId: number | null, artikelId: number | null): Promise<boolean> {
  const tagBeginn = new Date();
  tagBeginn.setHours(0, 0, 0, 0);

  const count = await prisma.benachrichtigung.count({
    where: {
      typ,
      kundeId: kundeId ?? undefined,
      artikelId: artikelId ?? undefined,
      createdAt: { gte: tagBeginn },
    },
  });
  return count > 0;
}

export async function POST() {
  try {
    const heute = new Date();
    const neunzigTageVonHeute = new Date(heute.getTime() + 90 * 24 * 60 * 60 * 1000);
    const vierzehnTageVorHeute = new Date(heute.getTime() - 14 * 24 * 60 * 60 * 1000);

    let erstellt = 0;

    // 1. Sachkunde läuft ab (< 90 Tage)
    const kundenMitSachkunde = await prisma.kunde.findMany({
      where: {
        sachkundeGueltigBis: {
          lte: neunzigTageVonHeute,
          gte: heute,
        },
        aktiv: true,
      },
      select: { id: true, name: true, firma: true, sachkundeGueltigBis: true },
      take: 100,
    });

    for (const kunde of kundenMitSachkunde) {
      if (await existiertHeuteSchon("sachkunde", kunde.id, null)) continue;
      const restTage = Math.ceil(
        (new Date(kunde.sachkundeGueltigBis!).getTime() - heute.getTime()) / (24 * 60 * 60 * 1000)
      );
      const prio = restTage <= 30 ? "kritisch" : restTage <= 60 ? "warnung" : "info";
      await prisma.benachrichtigung.create({
        data: {
          typ: "sachkunde",
          titel: `Sachkunde läuft ab: ${kunde.firma ?? kunde.name}`,
          text: `Die Sachkunde läuft in ${restTage} Tagen ab (${new Date(kunde.sachkundeGueltigBis!).toLocaleDateString("de-DE")}).`,
          prioritaet: prio,
          kundeId: kunde.id,
          link: `/kunden/${kunde.id}`,
        },
      });
      erstellt++;
    }

    // 2. Kreditlimit überschritten
    const kundenMitKreditlimit = await prisma.kunde.findMany({
      where: { kreditlimit: { not: null }, aktiv: true },
      select: { id: true, name: true, firma: true, kreditlimit: true },
      take: 200,
    });

    for (const kunde of kundenMitKreditlimit) {
      if (await existiertHeuteSchon("kreditlimit", kunde.id, null)) continue;

      // Offener Betrag: gelieferte Lieferungen ohne bezahltAm
      const result = await prisma.$queryRawUnsafe<{ summe: number }[]>(
        `SELECT COALESCE(SUM(lp.menge * lp.verkaufspreis), 0) as summe
         FROM "Lieferposition" lp
         JOIN "Lieferung" l ON l.id = lp."lieferungId"
         WHERE l."kundeId" = ? AND l.status = 'geliefert' AND l."bezahltAm" IS NULL`,
        kunde.id
      );

      const offenerBetrag = result[0]?.summe ?? 0;
      if (offenerBetrag > (kunde.kreditlimit ?? 0)) {
        await prisma.benachrichtigung.create({
          data: {
            typ: "kreditlimit",
            titel: `Kreditlimit überschritten: ${kunde.firma ?? kunde.name}`,
            text: `Offener Betrag ${offenerBetrag.toFixed(2)} € überschreitet Kreditlimit von ${(kunde.kreditlimit ?? 0).toFixed(2)} €.`,
            prioritaet: "kritisch",
            kundeId: kunde.id,
            link: `/kunden/${kunde.id}`,
          },
        });
        erstellt++;
      }
    }

    // 3. Lagerbestand unter Minimum
    const artikelUnterMin = await prisma.$queryRawUnsafe<
      { id: number; name: string; aktuellerBestand: number; mindestbestand: number }[]
    >(
      `SELECT id, name, aktuellerBestand, mindestbestand
       FROM "Artikel"
       WHERE aktiv = 1 AND aktuellerBestand < mindestbestand
       LIMIT 100`
    );

    for (const artikel of artikelUnterMin) {
      if (await existiertHeuteSchon("lagerbestand", null, artikel.id)) continue;
      const prio = artikel.aktuellerBestand <= 0 ? "kritisch" : "warnung";
      await prisma.benachrichtigung.create({
        data: {
          typ: "lagerbestand",
          titel: `Lagerbestand niedrig: ${artikel.name}`,
          text:
            artikel.aktuellerBestand <= 0
              ? `Kein Lagerbestand mehr vorhanden (Mindestbestand: ${artikel.mindestbestand}).`
              : `Bestand ${artikel.aktuellerBestand} liegt unter Mindestbestand ${artikel.mindestbestand}.`,
          prioritaet: prio,
          artikelId: artikel.id,
          link: `/artikel/${artikel.id}`,
        },
      });
      erstellt++;
    }

    // 4. Überfällige Rechnungen (> 14 Tage)
    const ueberfaelligeLieferungen = await prisma.lieferung.findMany({
      where: {
        rechnungNr: { not: null },
        bezahltAm: null,
        rechnungDatum: { lt: vierzehnTageVorHeute },
        status: "geliefert",
      },
      select: {
        id: true,
        kundeId: true,
        rechnungNr: true,
        rechnungDatum: true,
        zahlungsziel: true,
        kunde: { select: { id: true, name: true, firma: true } },
      },
      take: 200,
    });

    // Aggregiere pro Kunde
    const kundeRechnungMap = new Map<number, { anzahl: number; kundeName: string }>();
    for (const lief of ueberfaelligeLieferungen) {
      const entry = kundeRechnungMap.get(lief.kundeId) ?? { anzahl: 0, kundeName: lief.kunde ? (lief.kunde.firma ?? lief.kunde.name) : "?" };
      entry.anzahl++;
      kundeRechnungMap.set(lief.kundeId, entry);
    }

    for (const [kundeId, { anzahl, kundeName }] of kundeRechnungMap) {
      if (await existiertHeuteSchon("rechnung_faellig", kundeId, null)) continue;
      await prisma.benachrichtigung.create({
        data: {
          typ: "rechnung_faellig",
          titel: `Überfällige Rechnungen: ${kundeName}`,
          text: `${anzahl} Rechnung${anzahl > 1 ? "en" : ""} seit über 14 Tagen unbezahlt.`,
          prioritaet: "warnung",
          kundeId,
          link: `/kunden/${kundeId}`,
        },
      });
      erstellt++;
    }

    return NextResponse.json({ erstellt, geprüft: true });
  } catch (e) {
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && e instanceof Error ? e.message : "Interner Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
