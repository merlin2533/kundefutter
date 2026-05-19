import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

// GET /api/artikel/[id]/chargen
// Liefert alle bekannten Chargennummern für diesen Artikel aus Wareneingängen,
// sortiert nach jüngstem Wareneingang. Wird im Lieferungs-Formular als Dropdown
// (datalist) angeboten.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const artikelId = parseInt(id, 10);
  if (isNaN(artikelId)) {
    return NextResponse.json({ error: "Ungültige Artikel-ID" }, { status: 400 });
  }

  try {
    const rows = await prisma.wareineingangPosition.findMany({
      where: { artikelId, chargeNr: { not: null } },
      select: {
        chargeNr: true,
        menge: true,
        mhd: true,
        wareneingang: { select: { datum: true, lieferant: { select: { name: true } } } },
      },
      take: 2000,
      orderBy: { id: "desc" },
    });

    const map = new Map<
      string,
      {
        chargeNr: string;
        letzterWareneingang: Date;
        anzahlWareneingaenge: number;
        summeMenge: number;
        mhd: Date | null;
        lieferant: string | null;
      }
    >();
    for (const r of rows) {
      if (!r.chargeNr) continue;
      const datum = r.wareneingang.datum;
      const lieferantName = r.wareneingang.lieferant?.name ?? null;
      const existing = map.get(r.chargeNr);
      if (existing) {
        existing.anzahlWareneingaenge += 1;
        existing.summeMenge += r.menge;
        if (datum > existing.letzterWareneingang) {
          existing.letzterWareneingang = datum;
          existing.lieferant = lieferantName;
          existing.mhd = r.mhd;
        }
      } else {
        map.set(r.chargeNr, {
          chargeNr: r.chargeNr,
          letzterWareneingang: datum,
          anzahlWareneingaenge: 1,
          summeMenge: r.menge,
          mhd: r.mhd,
          lieferant: lieferantName,
        });
      }
    }

    const chargen = Array.from(map.values()).sort(
      (a, b) => b.letzterWareneingang.getTime() - a.letzterWareneingang.getTime()
    );

    return NextResponse.json({ chargen });
  } catch (e) {
    const isDev = process.env.NODE_ENV === "development";
    console.error("Artikel-Chargen GET error:", e);
    const msg = isDev && e instanceof Error ? e.message : "Datenbankfehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
