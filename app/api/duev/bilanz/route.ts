import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export async function GET(req: Request) {

  const { searchParams } = new URL(req.url);
  const jahr = parseInt(searchParams.get("jahr") ?? String(new Date().getFullYear()), 10);

  const von = new Date(jahr, 0, 1);
  const bis = new Date(jahr, 11, 31, 23, 59, 59);

  try {
    const positionen = await prisma.lieferposition.findMany({
      where: {
        lieferung: {
          datum: { gte: von, lte: bis },
          status: { not: "storniert" },
        },
        artikel: {
          OR: [
            { kategorie: { contains: "Duenger" } },
            { kategorie: { contains: "Dünger" } },
            { kategorie: { contains: "duenger" } },
          ],
        },
      },
      select: {
        menge: true,
        artikel: { select: { name: true, inhaltsstoffe: { select: { name: true, menge: true, einheit: true } } } },
        lieferung: {
          select: {
            kunde: { select: { id: true, name: true, firma: true, flaeche: true } },
          },
        },
      },
      take: 2000,
    });

    const kundenMap = new Map<
      number,
      { kundeId: number; kundeName: string; flaeche: number | null; n_kg: number; p_kg: number; k_kg: number }
    >();

    for (const pos of positionen) {
      const kunde = pos.lieferung.kunde;
      if (!kundenMap.has(kunde.id)) {
        kundenMap.set(kunde.id, {
          kundeId: kunde.id,
          kundeName: kunde.firma ?? kunde.name,
          flaeche: (kunde as unknown as { flaeche?: number | null }).flaeche ?? null,
          n_kg: 0,
          p_kg: 0,
          k_kg: 0,
        });
      }
      const entry = kundenMap.get(kunde.id)!;
      for (const stoff of pos.artikel.inhaltsstoffe) {
        const n = stoff.name.toUpperCase();
        const kg = (stoff.menge ?? 0) * pos.menge / 100; // assume % → kg/menge
        if (n.includes("STICKSTOFF") || n === "N") entry.n_kg += kg;
        if (n.includes("PHOSPHOR") || n === "P" || n === "P2O5") entry.p_kg += kg;
        if (n.includes("KALIUM") || n === "K" || n === "K2O") entry.k_kg += kg;
      }
    }

    const result = Array.from(kundenMap.values()).map((e) => ({
      ...e,
      n_kgPerHa: e.flaeche && e.flaeche > 0 ? Math.round((e.n_kg / e.flaeche) * 10) / 10 : null,
      grenzwertUeberschritten: e.flaeche && e.flaeche > 0 ? e.n_kg / e.flaeche > 170 : false,
    }));

    result.sort((a, b) => (b.n_kg - a.n_kg));

    return NextResponse.json({ jahr, daten: result });
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    return NextResponse.json(
      { error: isDev && err instanceof Error ? err.message : "Interner Fehler" },
      { status: 500 }
    );
  }
}
