import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession, SESSION_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";

const GUELTIGE_STATUS = ["OFFEN", "ABGERECHNET", "AUSGEZAHLT"];

export async function GET(req: NextRequest) {
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const mitarbeiterIdParam = searchParams.get("mitarbeiterId");
  const monatParam = searchParams.get("monat");
  const jahrParam = searchParams.get("jahr");
  const statusParam = searchParams.get("status");

  try {
    const where: Record<string, unknown> = {};
    if (mitarbeiterIdParam) {
      const id = parseInt(mitarbeiterIdParam, 10);
      if (!isNaN(id)) where.mitarbeiterId = id;
    }
    if (monatParam) {
      const m = parseInt(monatParam, 10);
      if (!isNaN(m)) where.monat = m;
    }
    if (jahrParam) {
      const j = parseInt(jahrParam, 10);
      if (!isNaN(j)) where.jahr = j;
    }
    if (statusParam && GUELTIGE_STATUS.includes(statusParam)) where.status = statusParam;

    const abrechnungen = await prisma.gehaltsabrechnung.findMany({
      where,
      include: {
        mitarbeiter: { select: { id: true, vorname: true, nachname: true, typ: true } },
      },
      orderBy: [{ jahr: "desc" }, { monat: "desc" }, { mitarbeiter: { nachname: "asc" } }],
      take: 500,
    });

    return NextResponse.json(abrechnungen);
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    return NextResponse.json({ error: isDev && err instanceof Error ? err.message : "Interner Fehler" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { mitarbeiterId, monat, jahr, brutto, netto, abzuege, notiz, aktion } = body;

    const maId = parseInt(mitarbeiterId, 10);
    if (isNaN(maId)) return NextResponse.json({ error: "Ungültige Mitarbeiter-ID" }, { status: 400 });

    const monatVal = parseInt(monat, 10);
    const jahrVal = parseInt(jahr, 10);
    if (isNaN(monatVal) || monatVal < 1 || monatVal > 12) {
      return NextResponse.json({ error: "Ungültiger Monat (1-12)" }, { status: 400 });
    }
    if (isNaN(jahrVal) || jahrVal < 2000 || jahrVal > 2100) {
      return NextResponse.json({ error: "Ungültiges Jahr" }, { status: 400 });
    }

    let bruttoVal: number;
    let nettoVal: number;
    let abzuegeVal: number;
    let stundenGesamt: number | null = null;

    if (aktion === "abrechnen") {
      const ma = await prisma.mitarbeiter.findUnique({ where: { id: maId } });
      if (!ma) return NextResponse.json({ error: "Mitarbeiter nicht gefunden" }, { status: 404 });

      let berechnetesBrutto = 0;
      if (ma.typ === "festgehalt") {
        berechnetesBrutto = ma.grundgehalt ?? 0;
      } else if (ma.typ === "minijob") {
        berechnetesBrutto = ma.minijobPauschale ?? 0;
      } else if (ma.typ === "stundenbasis") {
        const result = await prisma.arbeitsstunde.aggregate({
          where: {
            mitarbeiterId: maId,
            art: "arbeit",
            datum: { gte: new Date(jahrVal, monatVal - 1, 1), lt: new Date(jahrVal, monatVal, 1) },
          },
          _sum: { stunden: true },
        });
        stundenGesamt = result._sum.stunden ?? 0;
        berechnetesBrutto = Math.round((ma.stundenlohn ?? 0) * stundenGesamt * 100) / 100;
      }

      bruttoVal = brutto != null ? parseFloat(brutto) : berechnetesBrutto;
      nettoVal = netto != null ? parseFloat(netto) : bruttoVal;
      abzuegeVal = abzuege != null ? parseFloat(abzuege) : 0;
    } else {
      bruttoVal = parseFloat(brutto);
      nettoVal = netto != null ? parseFloat(netto) : bruttoVal;
      abzuegeVal = abzuege != null ? parseFloat(abzuege) : 0;
      if (isNaN(bruttoVal) || bruttoVal < 0) {
        return NextResponse.json({ error: "Ungültiger Bruttobetrag" }, { status: 400 });
      }
      if (isNaN(nettoVal)) nettoVal = bruttoVal;
    }

    try {
      const abrechnung = await prisma.gehaltsabrechnung.create({
        data: {
          mitarbeiterId: maId,
          monat: monatVal,
          jahr: jahrVal,
          stundenGesamt,
          brutto: bruttoVal,
          netto: nettoVal,
          abzuege: abzuegeVal,
          notiz: notiz || null,
          status: "OFFEN",
        },
        include: { mitarbeiter: { select: { id: true, vorname: true, nachname: true, typ: true } } },
      });
      return NextResponse.json(abrechnung, { status: 201 });
    } catch (createErr) {
      const e = createErr as { code?: string };
      if (e.code === "P2002") {
        return NextResponse.json(
          { error: `Abrechnung für ${monatVal}/${jahrVal} existiert bereits für diesen Mitarbeiter` },
          { status: 409 }
        );
      }
      throw createErr;
    }
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    return NextResponse.json({ error: isDev && err instanceof Error ? err.message : "Interner Fehler" }, { status: 500 });
  }
}
