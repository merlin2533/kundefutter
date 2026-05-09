import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { kundeId, artikelId, menge } = body as {
      kundeId?: unknown;
      artikelId?: unknown;
      menge?: unknown;
    };

    const kId = parseInt(String(kundeId), 10);
    const aId = parseInt(String(artikelId), 10);

    if (isNaN(kId) || isNaN(aId)) {
      return NextResponse.json({ error: "kundeId und artikelId sind Pflichtfelder." }, { status: 400 });
    }

    const mengeZahl = menge !== undefined && menge !== null ? parseFloat(String(menge)) : null;

    const vor90Tage = new Date(Date.now() - 90 * 86_400_000);

    // Alle Lieferpreise für diesen Artikel an alle Kunden (letzte 90 Tage)
    const marktPositionen = await prisma.lieferposition.findMany({
      where: {
        artikelId: aId,
        lieferung: {
          datum: { gte: vor90Tage },
          status: { not: "storniert" },
        },
      },
      select: {
        verkaufspreis: true,
        lieferung: { select: { kundeId: true } },
      },
      take: 500,
    });

    const preise = marktPositionen
      .map((p) => p.verkaufspreis)
      .filter((p) => p > 0);

    const kundenPreise = marktPositionen
      .filter((p) => p.lieferung.kundeId === kId)
      .map((p) => p.verkaufspreis)
      .filter((p) => p > 0);

    if (preise.length === 0) {
      // Fallback: Standardpreis des Artikels
      const artikel = await prisma.artikel.findUnique({
        where: { id: aId },
        select: { standardpreis: true },
      });
      if (!artikel) {
        return NextResponse.json({ error: "Artikel nicht gefunden." }, { status: 404 });
      }
      const sp = artikel.standardpreis;
      return NextResponse.json({
        empfohlenVon: Math.round(sp * 0.95 * 100) / 100,
        empfohlenBis: Math.round(sp * 1.05 * 100) / 100,
        durchschnitt: sp,
        kundenDurchschnitt: null,
        hinweis: "Keine historischen Verkaufsdaten vorhanden. Empfehlung basiert auf Standardpreis.",
      });
    }

    const min = Math.min(...preise);
    const max = Math.max(...preise);
    const avg = preise.reduce((s, p) => s + p, 0) / preise.length;
    const kundenAvg = kundenPreise.length > 0
      ? kundenPreise.reduce((s, p) => s + p, 0) / kundenPreise.length
      : null;

    // Empfehlung: ±5% um den (kundenspez.) Durchschnitt, begrenzt auf min/max
    const basis = kundenAvg ?? avg;
    const empfVon = Math.max(min, Math.round(basis * 0.95 * 100) / 100);
    const empfBis = Math.min(max, Math.round(basis * 1.05 * 100) / 100);

    let hinweis = `Basierend auf ${preise.length} Verkauf${preise.length !== 1 ? "en" : ""} der letzten 90 Tage`;
    if (kundenAvg !== null && kundenPreise.length > 0) {
      hinweis += ` (inkl. ${kundenPreise.length} bei diesem Kunden)`;
    }
    if (mengeZahl !== null && !isNaN(mengeZahl) && mengeZahl > 0) {
      hinweis += `. Menge: ${mengeZahl.toLocaleString("de-DE")}`;
    }
    hinweis += ".";

    return NextResponse.json({
      empfohlenVon: empfVon,
      empfohlenBis: empfBis,
      durchschnitt: Math.round(avg * 100) / 100,
      kundenDurchschnitt: kundenAvg !== null ? Math.round(kundenAvg * 100) / 100 : null,
      hinweis,
    });
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
