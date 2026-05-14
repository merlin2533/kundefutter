import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

// GET /api/statistik/aging — Offene-Posten-Aging (Stichtagsbezogen)
export async function GET() {
  try {
    const heute = new Date();
    const heuteIso = heute.toISOString();

    type PosRow = {
      lieferungId: number;
      kundeId: number;
      name: string;
      firma: string | null;
      rechnungNr: string;
      rechnungDatum: string | null;
      datum: string;
      zahlungsziel: number | null;
      summe: number | null;
    };

    // Alle offenen Rechnungen mit Betrag je Lieferung
    const zeilen = await prisma.$queryRawUnsafe<PosRow[]>(
      `SELECT
         l.id            AS lieferungId,
         l.kundeId,
         k.name,
         k.firma,
         l.rechnungNr,
         l.rechnungDatum,
         l.datum,
         l.zahlungsziel,
         CAST(SUM(lp.menge * lp.verkaufspreis) AS REAL) AS summe
       FROM Lieferung l
       JOIN Kunde k ON k.id = l.kundeId
       JOIN Lieferposition lp ON lp.lieferungId = l.id
       WHERE l.status = 'geliefert'
         AND l.bezahltAm IS NULL
         AND l.rechnungNr IS NOT NULL
       GROUP BY l.id, l.kundeId, k.name, k.firma,
                l.rechnungNr, l.rechnungDatum, l.datum, l.zahlungsziel
       ORDER BY l.datum ASC
       LIMIT 500`
    );

    const r2 = (n: number | null | undefined) => Math.round((n ?? 0) * 100) / 100;

    // Fälligkeit und Überfälligkeitstage je Lieferung berechnen
    type Pos = {
      lieferungId: number;
      kundeId: number;
      name: string;
      firma: string | null;
      rechnungNr: string;
      summe: number;
      ueberfaelligTage: number;
    };

    const positionen: Pos[] = zeilen.map((z) => {
      const basisDatum = z.rechnungDatum ? new Date(z.rechnungDatum) : new Date(z.datum);
      const ziel = z.zahlungsziel ?? 30;
      const faelligkeit = new Date(basisDatum.getTime() + ziel * 24 * 60 * 60 * 1000);
      const ueberfaelligTage = Math.floor(
        (heute.getTime() - faelligkeit.getTime()) / (1000 * 60 * 60 * 24)
      );
      return {
        lieferungId: z.lieferungId,
        kundeId: z.kundeId,
        name: z.name,
        firma: z.firma,
        rechnungNr: z.rechnungNr,
        summe: r2(z.summe),
        ueberfaelligTage,
      };
    });

    // Buckets
    const buckets = [
      { label: "Nicht fällig", min: -Infinity, max: 0 },
      { label: "1–30 Tage", min: 1, max: 30 },
      { label: "31–60 Tage", min: 31, max: 60 },
      { label: "61–90 Tage", min: 61, max: 90 },
      { label: "über 90 Tage", min: 91, max: Infinity },
    ].map(({ label, min, max }) => {
      const gruppe = positionen.filter(
        (p) => p.ueberfaelligTage >= min && p.ueberfaelligTage <= max
      );
      return {
        label,
        anzahl: gruppe.length,
        summe: r2(gruppe.reduce((s, p) => s + p.summe, 0)),
      };
    });

    // Je Kunde aggregieren
    type KundeMap = {
      kundeId: number;
      name: string;
      firma: string | null;
      offen: number;
      aeltesteTage: number;
    };
    const kundeMap = new Map<number, KundeMap>();
    for (const p of positionen) {
      const prev = kundeMap.get(p.kundeId);
      if (prev) {
        prev.offen = r2(prev.offen + p.summe);
        prev.aeltesteTage = Math.max(prev.aeltesteTage, p.ueberfaelligTage);
      } else {
        kundeMap.set(p.kundeId, {
          kundeId: p.kundeId,
          name: p.name,
          firma: p.firma,
          offen: p.summe,
          aeltesteTage: p.ueberfaelligTage,
        });
      }
    }
    const kunden = Array.from(kundeMap.values())
      .sort((a, b) => b.offen - a.offen)
      .slice(0, 200);

    const gesamtOffen = r2(positionen.reduce((s, p) => s + p.summe, 0));
    const ueberfaelligTageGesamt = positionen
      .filter((p) => p.ueberfaelligTage > 0)
      .map((p) => p.ueberfaelligTage);
    const durchschnittTage =
      ueberfaelligTageGesamt.length > 0
        ? Math.round(
            ueberfaelligTageGesamt.reduce((s, t) => s + t, 0) /
              ueberfaelligTageGesamt.length
          )
        : 0;

    return NextResponse.json({
      stichtag: heuteIso,
      buckets,
      kunden,
      summe: {
        offen: gesamtOffen,
        anzahl: positionen.length,
        durchschnittUeberfaelligTage: durchschnittTage,
      },
    });
  } catch (e) {
    console.error("Statistik/Aging API Fehler:", e);
    const isDev = process.env.NODE_ENV === "development";
    const msg =
      isDev && e instanceof Error ? e.message : "Datenbankfehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
