import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/kampagnen/[id]/kunden
 * Returns customers assigned to this campaign with potential volume
 * (sum of their Bedarf for campaign articles)
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const nId = parseInt(id, 10);
  if (isNaN(nId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const kampagne = await prisma.kampagne.findUnique({
      where: { id: nId },
      include: {
        artikel: { select: { artikelId: true, sonderpreis: true } },
        kunden: {
          include: {
            kunde: {
              select: {
                id: true,
                name: true,
                firma: true,
                ort: true,
                kategorie: true,
                kontakte: { where: { typ: { in: ["telefon", "mobil"] } }, select: { wert: true, typ: true } },
                bedarfe: {
                  where: { aktiv: true },
                  include: { artikel: { select: { id: true, name: true, einheit: true } } },
                },
              },
            },
          },
          orderBy: { kunde: { name: "asc" } },
        },
      },
    });

    if (!kampagne) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    const kampagneArtikelIds = new Set(kampagne.artikel.map((a) => a.artikelId));

    // Enrich each customer with potential volume (matching Bedarf quantities)
    const result = kampagne.kunden.map((kk) => {
      const k = kk.kunde;
      const matchingBedarfe = k.bedarfe.filter((b) => kampagneArtikelIds.has(b.artikelId));
      const potenzialMenge = matchingBedarfe.reduce((sum, b) => sum + b.menge, 0);

      return {
        id: kk.id,
        kundeId: k.id,
        name: k.name,
        firma: k.firma,
        ort: k.ort,
        kategorie: k.kategorie,
        telefon: k.kontakte[0]?.wert ?? null,
        bedarfe: matchingBedarfe.map((b) => ({
          artikelId: b.artikelId,
          artikelName: b.artikel.name,
          einheit: b.artikel.einheit,
          menge: b.menge,
          intervallTage: b.intervallTage,
        })),
        potenzialMenge,
      };
    });

    // Sort by potential (highest first)
    result.sort((a, b) => b.potenzialMenge - a.potenzialMenge);

    return NextResponse.json(result);
  } catch (err) {
    console.error("Kampagnen kunden GET error:", err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
