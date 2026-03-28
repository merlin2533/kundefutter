import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { lagerStatus } from "@/lib/utils";

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
      _sum: { id: true },
      orderBy: { _sum: { id: "desc" } },
      take: 5,
    }),
    prisma.lieferung.count({
      where: {
        status: "geplant",
        datum: { lte: new Date(heute.getTime() + 14 * 24 * 60 * 60 * 1000) },
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

  const lagerAlarme = lagerArtikel.filter(
    (a) => lagerStatus(a.aktuellerBestand, a.mindestbestand) !== "gruen"
  ).length;

  // Top-Kunden mit Namen anreichern
  const topKundenMitNamen = await Promise.all(
    topKunden.map(async (k) => {
      const kunde = await prisma.kunde.findUnique({ where: { id: k.kundeId } });
      const lieferungen = await prisma.lieferung.findMany({
        where: { kundeId: k.kundeId, status: "geliefert", datum: { gte: monatsAnfang } },
        include: { positionen: true },
      });
      const umsatz = lieferungen.reduce(
        (s, l) => s + l.positionen.reduce((ss, p) => ss + p.menge * p.verkaufspreis, 0),
        0
      );
      return { kundeId: k.kundeId, name: kunde?.name ?? "?", umsatz };
    })
  );

  return NextResponse.json({
    kundenAktiv,
    offeneLieferungen,
    umsatzMonat: Math.round(umsatzMonat * 100) / 100,
    deckungsbeitragMonat: Math.round(deckungsbeitragMonat * 100) / 100,
    lagerAlarme,
    faelligNaechste14Tage,
    topKunden: topKundenMitNamen.sort((a, b) => b.umsatz - a.umsatz),
  });
}
