import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/kampagnen/fuer-kunde?kundeId=X
 * Returns active campaigns relevant to a customer (they are a member of),
 * enriched with potential article quantities from their Bedarf.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const kundeId = searchParams.get("kundeId");
  if (!kundeId) return NextResponse.json({ error: "kundeId erforderlich" }, { status: 400 });

  const kId = parseInt(kundeId, 10);
  if (isNaN(kId)) return NextResponse.json({ error: "Ungültige kundeId" }, { status: 400 });

  const now = new Date();

  try {
    // Active campaigns where this customer is a member
    const kampagnen = await prisma.kampagne.findMany({
      where: {
        aktiv: true,
        von: { lte: now },
        bis: { gte: now },
        kunden: { some: { kundeId: kId } },
      },
      include: {
        artikel: {
          include: {
            artikel: { select: { id: true, name: true, einheit: true, standardpreis: true, aktuellerBestand: true, mindestbestand: true } },
          },
        },
      },
      orderBy: { bis: "asc" },
      take: 20,
    });

    if (kampagnen.length === 0) return NextResponse.json([]);

    // Load customer's Bedarf for potential calculation
    const bedarfe = await prisma.kundeBedarf.findMany({
      where: { kundeId: kId, aktiv: true },
      select: { artikelId: true, menge: true, intervallTage: true },
    });
    const bedarfMap = new Map(bedarfe.map((b) => [b.artikelId, b]));

    const result = kampagnen.map((k) => {
      const artikelMitPotenzial = k.artikel.map((ka) => {
        const bedarf = bedarfMap.get(ka.artikelId);
        return {
          artikelId: ka.artikelId,
          artikelName: ka.artikel?.name ?? "",
          einheit: ka.artikel?.einheit ?? "",
          standardpreis: ka.artikel?.standardpreis ?? 0,
          sonderpreis: ka.sonderpreis,
          aktuellerBestand: ka.artikel?.aktuellerBestand ?? 0,
          mindestbestand: ka.artikel?.mindestbestand ?? 0,
          bedarfMenge: bedarf?.menge ?? null,
          bedarfIntervallTage: bedarf?.intervallTage ?? null,
        };
      });

      return {
        id: k.id,
        name: k.name,
        beschreibung: k.beschreibung,
        von: k.von,
        bis: k.bis,
        rabattProzent: k.rabattProzent,
        artikel: artikelMitPotenzial,
      };
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("Kampagnen fuer-kunde GET error:", err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
