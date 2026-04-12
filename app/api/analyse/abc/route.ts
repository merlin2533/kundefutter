import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const heute = new Date();
    const vor12Monaten = new Date(heute.getFullYear(), heute.getMonth() - 12, heute.getDate());

    type Row = { kundeId: number; name: string; firma: string | null; umsatz: number };

    const rows = await prisma.$queryRawUnsafe<Row[]>(
      `SELECT
        l.kundeId,
        k.name,
        k.firma,
        CAST(SUM(lp.menge * lp.verkaufspreis) AS REAL) as umsatz
      FROM Lieferung l
      JOIN Lieferposition lp ON lp.lieferungId = l.id
      JOIN Kunde k ON k.id = l.kundeId
      WHERE l.status = 'geliefert' AND l.datum >= ?
      GROUP BY l.kundeId, k.name, k.firma
      ORDER BY umsatz DESC`,
      vor12Monaten.toISOString()
    );

    const gesamt = rows.reduce((s, k) => s + k.umsatz, 0);

    let kumuliert = 0;
    const kunden = rows.map((k) => {
      const anteil = gesamt > 0 ? (k.umsatz / gesamt) * 100 : 0;
      kumuliert += anteil;
      let klasse: "A" | "B" | "C";
      if (kumuliert - anteil < 80) klasse = "A";
      else if (kumuliert - anteil < 95) klasse = "B";
      else klasse = "C";
      return {
        id: k.kundeId,
        kundeId: k.kundeId,
        name: k.name,
        firma: k.firma ?? null,
        umsatz: Math.round(k.umsatz * 100) / 100,
        anteil: Math.round(anteil * 100) / 100,
        klasse,
        kumuliert: Math.round(kumuliert * 100) / 100,
      };
    });

    const aKunden = kunden.filter((k) => k.klasse === "A");
    const bKunden = kunden.filter((k) => k.klasse === "B");
    const cKunden = kunden.filter((k) => k.klasse === "C");

    return NextResponse.json({
      kunden,
      gesamt: Math.round(gesamt * 100) / 100,
      aKunden: {
        anzahl: aKunden.length,
        umsatz: Math.round(aKunden.reduce((s, k) => s + k.umsatz, 0) * 100) / 100,
        anteil: Math.round(aKunden.reduce((s, k) => s + k.anteil, 0) * 100) / 100,
      },
      bKunden: {
        anzahl: bKunden.length,
        umsatz: Math.round(bKunden.reduce((s, k) => s + k.umsatz, 0) * 100) / 100,
        anteil: Math.round(bKunden.reduce((s, k) => s + k.anteil, 0) * 100) / 100,
      },
      cKunden: {
        anzahl: cKunden.length,
        umsatz: Math.round(cKunden.reduce((s, k) => s + k.umsatz, 0) * 100) / 100,
        anteil: Math.round(cKunden.reduce((s, k) => s + k.anteil, 0) * 100) / 100,
      },
    });
  } catch (e) {
    console.error("ABC-Analyse Fehler:", e);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
