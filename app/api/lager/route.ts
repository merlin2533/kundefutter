import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { lagerStatus, istLagerrelevant } from "@/lib/utils";
export const dynamic = "force-dynamic";


export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status"); // rot | gelb | gruen

  try {
    // Konfigurierbare deaktivierte Kategorien aus Einstellungen
    const einstellungNoTracking = await prisma.einstellung.findUnique({
      where: { key: "system.lager_no_tracking_kategorien" },
    });
    let extraKategorien: string[] = [];
    if (einstellungNoTracking?.value) {
      try { extraKategorien = JSON.parse(einstellungNoTracking.value); } catch { /* ignore */ }
    }

    const artikel = await prisma.artikel.findMany({
      where: { aktiv: true },
      include: { lieferanten: { include: { lieferant: true } } },
      orderBy: { name: "asc" },
      take: 1000,
    });

    const lager = artikel
      .filter((a) => istLagerrelevant(a.kategorie, a.lagerTracking, extraKategorien))
      .map((a) => {
        const s = lagerStatus(a.aktuellerBestand, a.mindestbestand);
        return { ...a, lagerStatus: s };
      });

    const gefiltert = status ? lager.filter((l) => l.lagerStatus === status) : lager;
    return NextResponse.json(gefiltert);
  } catch (e) {
    console.error("Lager GET error:", e);
    return NextResponse.json({ error: "Datenbankfehler beim Laden des Lagers" }, { status: 500 });
  }
}
