import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loadKategorieTaxonomie } from "@/lib/artikel-kategorie";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";

export interface UnregistrierteUnterkategorie {
  wert: string;
  anzahl: number;
}

// GET — je Kategorie die Unterkategorie-Werte, die auf Artikeln tatsächlich verwendet werden,
// aber NICHT in den unter /einstellungen/stammdaten konfigurierten Unterkategorien stehen (z.B.
// "Einzelkomponenten" statt des registrierten "Einzelkomponente" — meist aus einem Import, der
// die Unterkategorie ungeprüft übernimmt, statt über das eingeschränkte <select> auf
// /artikel/neu zu laufen). Grundlage für das manuelle "Zusammenführen"-Werkzeug in den
// Stammdaten — bewusst KEINE automatische Erkennung von Duplikaten (z.B. Singular/Plural), das
// wäre unzuverlässig und würde legitime, nur noch nicht registrierte Werte fälschlich anfassen.
export async function GET() {
  try {
    const { kategorien, unterkategorienByKat } = await loadKategorieTaxonomie();

    const grouped = await prisma.artikel.groupBy({
      by: ["kategorie", "unterkategorie"],
      _count: { _all: true },
      where: { unterkategorie: { not: null } },
    });

    const result: Record<string, UnregistrierteUnterkategorie[]> = {};
    for (const g of grouped) {
      if (!g.unterkategorie) continue;
      if (!kategorien.includes(g.kategorie)) continue; // eigene Baustelle (Kategorien bereinigen)
      const registriert = unterkategorienByKat[g.kategorie] ?? [];
      if (registriert.includes(g.unterkategorie)) continue;
      if (!result[g.kategorie]) result[g.kategorie] = [];
      result[g.kategorie].push({ wert: g.unterkategorie, anzahl: g._count._all });
    }
    for (const kat of Object.keys(result)) {
      result[kat].sort((a, b) => b.anzahl - a.anzahl);
    }

    return NextResponse.json(result);
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
