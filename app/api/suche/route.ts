import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { umlautSchreibweisen } from "@/lib/utils";
import { Sentry } from "@/lib/sentry";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2)
    return NextResponse.json({ kunden: [], artikel: [], lieferungen: [], angebote: [], aufgaben: [], ausgaben: [], chargen: [] });

  const takeParam = parseInt(req.nextUrl.searchParams.get("take") ?? "5", 10);
  const take = isNaN(takeParam) || takeParam < 1 ? 5 : Math.min(takeParam, 100);

  // Chargennummern stehen auf jeder Saatgut-Rechnung — Suche danach soll direkt zur
  // "Wer hat bekommen?"-Ansicht des betroffenen Artikels führen (ArtikelKundenUebersicht).
  const chargenPromise = prisma.lieferposition
    .findMany({
      where: { chargeNr: { contains: q } },
      select: {
        chargeNr: true,
        menge: true,
        artikel: { select: { id: true, name: true, einheit: true } },
        lieferung: {
          select: {
            id: true,
            datum: true,
            status: true,
            kunde: { select: { id: true, name: true, firma: true } },
          },
        },
      },
      orderBy: { lieferung: { datum: "desc" } },
      take,
    })
    .then((rows) =>
      rows.map((p) => ({
        artikelId: p.artikel.id,
        artikelName: p.artikel.name,
        einheit: p.artikel.einheit,
        chargeNr: p.chargeNr as string,
        menge: p.menge,
        lieferungId: p.lieferung.id,
        datum: p.lieferung.datum,
        status: p.lieferung.status,
        kundeId: p.lieferung.kunde.id,
        kundeName: p.lieferung.kunde.firma || p.lieferung.kunde.name,
      }))
    );

  const lieferungenPromise = prisma.lieferung.findMany({
    where: {
      OR: [
        { rechnungNr: { contains: q } },
        { kunde: { name: { contains: q } } },
        { kunde: { firma: { contains: q } } },
      ],
    },
    select: {
      id: true,
      datum: true,
      status: true,
      rechnungNr: true,
      rechnungVersendetAm: true,
      lieferscheinVersendetAm: true,
      kunde: { select: { name: true, firma: true } },
    },
    orderBy: { datum: "desc" },
    take,
  });

  const angebotePromise = prisma.angebot.findMany({
    where: {
      OR: [
        { nummer: { contains: q } },
        { kunde: { name: { contains: q } } },
        { kunde: { firma: { contains: q } } },
      ],
    },
    select: {
      id: true,
      nummer: true,
      status: true,
      gueltigBis: true,
      kunde: { select: { name: true, firma: true } },
    },
    orderBy: { datum: "desc" },
    take,
  });

  const ausgabenPromise = prisma.ausgabe.findMany({
    where: {
      OR: [
        { beschreibung: { contains: q } },
        { belegNr: { contains: q } },
        { kategorie: { contains: q } },
      ],
    },
    select: { id: true, beschreibung: true, kategorie: true, betragNetto: true, datum: true, buchungstyp: true },
    take: 5,
    orderBy: { datum: "desc" },
  });

  const aufgabenPromise = prisma.aufgabe.findMany({
    where: {
      OR: [
        { betreff: { contains: q } },
        { beschreibung: { contains: q } },
      ],
    },
    select: {
      id: true,
      betreff: true,
      faelligAm: true,
      erledigt: true,
      kundeId: true,
    },
    orderBy: { faelligAm: "asc" },
    take,
  });

  // Try FTS5 for Kunden and Artikel; fall back to contains if tables don't exist yet
  try {
    const ftsQuery = q + "*";

    const [kundenFts, artikelFts, lieferungen, angebote, aufgaben, ausgaben, chargen] = await Promise.all([
      prisma.$queryRawUnsafe<
        { id: number; name: string; firma: string | null; plz: string | null; ort: string | null }[]
      >(
        `SELECT k.id, k.name, k.firma, k.plz, k.ort
         FROM kunden_fts f
         JOIN Kunde k ON k.id = f.rowid
         WHERE kunden_fts MATCH ? AND k.aktiv = 1
         ORDER BY rank
         LIMIT ${take}`,
        ftsQuery
      ),
      prisma.$queryRawUnsafe<
        { id: number; name: string; artikelnummer: string; kategorie: string }[]
      >(
        `SELECT a.id, a.name, a.artikelnummer, a.kategorie
         FROM artikel_fts f
         JOIN Artikel a ON a.id = f.rowid
         WHERE artikel_fts MATCH ? AND a.aktiv = 1
         ORDER BY rank
         LIMIT ${take}`,
        ftsQuery
      ),
      lieferungenPromise,
      angebotePromise,
      aufgabenPromise,
      ausgabenPromise,
      chargenPromise,
    ]);

    return NextResponse.json({ kunden: kundenFts, artikel: artikelFts, lieferungen, angebote, aufgaben, ausgaben, chargen });
  } catch (err) {
    Sentry.captureException(err);
    // FTS5 tables not available yet — fall back to original contains-based search
    const [kunden, artikel, lieferungen, angebote, aufgaben, ausgaben, chargen] = await Promise.all([
      prisma.kunde.findMany({
        where: {
          aktiv: true,
          OR: [
            { name: { contains: q } },
            { firma: { contains: q } },
            { plz: { contains: q } },
          ],
        },
        select: { id: true, name: true, firma: true, plz: true, ort: true },
        take,
      }),
      prisma.artikel.findMany({
        where: {
          aktiv: true,
          // Umlaut-Schreibweisen abdecken (siehe umlautSchreibweisen()) — dieser Fallback-Pfad
          // greift nur, wenn die FTS5-Abfrage oben scheitert, hat aber denselben SQLite-LIKE-
          // Umlaut-Bug wie /api/artikel.
          OR: umlautSchreibweisen(q).flatMap((s) => [
            { name: { contains: s } },
            { artikelnummer: { contains: s } },
            { kategorie: { contains: s } },
            { inhaltsstoffe: { some: { name: { contains: s } } } },
          ]),
        },
        select: { id: true, name: true, artikelnummer: true, kategorie: true },
        take,
      }),
      lieferungenPromise,
      angebotePromise,
      aufgabenPromise,
      ausgabenPromise,
      chargenPromise,
    ]);

    return NextResponse.json({ kunden, artikel, lieferungen, angebote, aufgaben, ausgaben, chargen });
  }
}
