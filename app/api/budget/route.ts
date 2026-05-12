import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const jahrParam = searchParams.get("jahr");
  const jahr = jahrParam ? parseInt(jahrParam, 10) : new Date().getFullYear();
  if (isNaN(jahr)) return NextResponse.json({ error: "Ungültiges Jahr" }, { status: 400 });

  const startOfYear = new Date(`${jahr}-01-01T00:00:00.000Z`);
  const endOfYear = new Date(`${jahr}-12-31T23:59:59.999Z`);

  try {
    // Load all Umsatzziele for the year
    const ziele = await prisma.umsatzziel.findMany({
      where: { jahr },
      orderBy: [{ monat: "asc" }, { kategorie: "asc" }],
    });

    // Aggregate Ist-Umsatz per month and per category
    const lieferpositionen = await prisma.lieferposition.findMany({
      where: {
        lieferung: {
          datum: { gte: startOfYear, lte: endOfYear },
          status: { not: "storniert" },
        },
      },
      select: {
        verkaufspreis: true,
        menge: true,
        lieferung: { select: { datum: true } },
        artikel: { select: { kategorie: true } },
      },
      take: 50000,
    });

    // Calculate totals
    const istGesamt = lieferpositionen.reduce(
      (sum, p) => sum + p.verkaufspreis * p.menge,
      0
    );

    // Monthly ist values
    const monatlicheIst: Record<number, number> = {};
    for (let m = 1; m <= 12; m++) monatlicheIst[m] = 0;
    for (const p of lieferpositionen) {
      const monat = new Date(p.lieferung.datum).getUTCMonth() + 1;
      monatlicheIst[monat] = (monatlicheIst[monat] ?? 0) + p.verkaufspreis * p.menge;
    }

    // Category ist values
    const kategorieIst: Record<string, number> = {};
    for (const p of lieferpositionen) {
      const kat = p.artikel.kategorie ?? "Sonstiges";
      kategorieIst[kat] = (kategorieIst[kat] ?? 0) + p.verkaufspreis * p.menge;
    }

    // Build ziele with ist-values
    const zieleMitIst = ziele.map((z) => {
      let istBetrag = 0;
      if (z.monat !== null && z.kategorie === null) {
        istBetrag = monatlicheIst[z.monat] ?? 0;
      } else if (z.monat === null && z.kategorie !== null) {
        istBetrag = kategorieIst[z.kategorie] ?? 0;
      } else if (z.monat === null && z.kategorie === null) {
        istBetrag = istGesamt;
      } else if (z.monat !== null && z.kategorie !== null) {
        // Specific month + category
        istBetrag = lieferpositionen
          .filter((p) => {
            const monat = new Date(p.lieferung.datum).getUTCMonth() + 1;
            return monat === z.monat && p.artikel.kategorie === z.kategorie;
          })
          .reduce((sum, p) => sum + p.verkaufspreis * p.menge, 0);
      }
      const erreichungProzent = z.zielBetrag > 0 ? (istBetrag / z.zielBetrag) * 100 : null;
      return { ...z, istBetrag, erreichungProzent };
    });

    // Find Gesamtziel
    const gesamtZiel = ziele.find((z) => z.monat === null && z.kategorie === null);
    const gesamt = {
      zielBetrag: gesamtZiel?.zielBetrag ?? 0,
      istBetrag: istGesamt,
      erreichungProzent:
        gesamtZiel && gesamtZiel.zielBetrag > 0
          ? (istGesamt / gesamtZiel.zielBetrag) * 100
          : null,
    };

    // Monthly overview
    const monatsUebersicht = Array.from({ length: 12 }, (_, i) => {
      const monat = i + 1;
      const ziel = ziele.find((z) => z.monat === monat && z.kategorie === null);
      return {
        monat,
        istBetrag: monatlicheIst[monat] ?? 0,
        zielBetrag: ziel?.zielBetrag ?? 0,
      };
    });

    return NextResponse.json({ ziele: zieleMitIst, gesamt, monatsUebersicht });
  } catch (err) {
    console.error("Budget GET error:", err);
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: {
    jahr?: unknown;
    monat?: unknown;
    kategorie?: unknown;
    zielBetrag?: unknown;
    notiz?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const jahr = parseInt(String(body.jahr), 10);
  if (isNaN(jahr) || jahr < 2000 || jahr > 2100) {
    return NextResponse.json({ error: "Ungültiges Jahr" }, { status: 400 });
  }
  const zielBetrag = Number(body.zielBetrag);
  if (isNaN(zielBetrag) || zielBetrag < 0) {
    return NextResponse.json({ error: "Ungültiger zielBetrag" }, { status: 400 });
  }

  const monat =
    body.monat != null && body.monat !== "" ? parseInt(String(body.monat), 10) : null;
  if (monat !== null && (isNaN(monat) || monat < 1 || monat > 12)) {
    return NextResponse.json({ error: "Ungültiger Monat" }, { status: 400 });
  }
  const kategorie =
    body.kategorie != null && body.kategorie !== "" ? String(body.kategorie) : null;
  const notiz = body.notiz ? String(body.notiz) : null;

  try {
    const ziel = await prisma.umsatzziel.upsert({
      where: {
        jahr_monat_kategorie: {
          jahr,
          monat: monat ?? -1, // prisma needs exact value; use workaround below
          kategorie: kategorie ?? "",
        },
      },
      update: { zielBetrag, notiz },
      create: { jahr, monat, kategorie, zielBetrag, notiz },
    });
    return NextResponse.json(ziel, { status: 201 });
  } catch {
    // Fallback: try create then update
    try {
      const existing = await prisma.umsatzziel.findFirst({
        where: {
          jahr,
          monat: monat ?? null,
          kategorie: kategorie ?? null,
        },
      });
      let ziel;
      if (existing) {
        ziel = await prisma.umsatzziel.update({
          where: { id: existing.id },
          data: { zielBetrag, notiz },
        });
      } else {
        ziel = await prisma.umsatzziel.create({
          data: { jahr, monat, kategorie, zielBetrag, notiz },
        });
      }
      return NextResponse.json(ziel, { status: 201 });
    } catch (err2) {
      console.error("Budget POST error:", err2);
      const isDev = process.env.NODE_ENV === "development";
      const msg = isDev && err2 instanceof Error ? err2.message : "Interner Fehler";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }
}
