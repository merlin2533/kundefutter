import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const kundeIdStr = searchParams.get("kundeId");
  const vonStr = searchParams.get("von");
  const bisStr = searchParams.get("bis");
  const artikelIdStr = searchParams.get("artikelId");

  try {
    const where: Record<string, unknown> = {};
    if (kundeIdStr) {
      const kundeId = parseInt(kundeIdStr, 10);
      if (!isNaN(kundeId)) where.kundeId = kundeId;
    }
    if (artikelIdStr) {
      const artikelId = parseInt(artikelIdStr, 10);
      if (!isNaN(artikelId)) where.artikelId = artikelId;
    }
    if (vonStr || bisStr) {
      const datumFilter: Record<string, Date> = {};
      if (vonStr) { const d = new Date(vonStr); d.setHours(0, 0, 0, 0); datumFilter.gte = d; }
      if (bisStr) { const d = new Date(bisStr); d.setHours(23, 59, 59, 999); datumFilter.lte = d; }
      where.datum = datumFilter;
    }

    const anlieferungen = await prisma.anlieferung.findMany({
      where,
      include: {
        kunde: { select: { id: true, name: true, firma: true } },
        artikel: { select: { id: true, name: true, einheit: true } },
        gutschrift: { select: { id: true, nummer: true, status: true } },
      },
      orderBy: { datum: "desc" },
      take: 500,
    });

    return NextResponse.json(anlieferungen);
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    return NextResponse.json(
      { error: isDev && err instanceof Error ? err.message : "Interner Fehler" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { kundeId, artikelId, datum, menge, einheit, feuchte, qualitaet, preisProEinheit, notiz } = body;

    if (!kundeId || !artikelId || menge == null) {
      return NextResponse.json({ error: "kundeId, artikelId und menge sind Pflichtfelder" }, { status: 400 });
    }

    const kId = parseInt(String(kundeId), 10);
    const aId = parseInt(String(artikelId), 10);
    if (isNaN(kId) || isNaN(aId)) {
      return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });
    }

    // Autonummer ANL-YYYY-NNNN with transaction to avoid race condition
    const anlieferung = await prisma.$transaction(async (tx) => {
      const year = new Date().getFullYear();
      const prefix = `ANL-${year}-`;
      const setting = await tx.einstellung.findFirst({ where: { key: "letzte_anlieferungsnummer" } });
      let letzteNummer = 0;
      if (setting?.value) {
        const match = setting.value.match(/ANL-\d{4}-(\d+)/);
        if (match) letzteNummer = parseInt(match[1], 10);
      }
      const naechste = letzteNummer + 1;
      const nummer = `${prefix}${String(naechste).padStart(4, "0")}`;

      await tx.einstellung.upsert({
        where: { key: "letzte_anlieferungsnummer" },
        create: { key: "letzte_anlieferungsnummer", value: nummer },
        update: { value: nummer },
      });

      const gesamtBetrag =
        preisProEinheit != null && menge != null
          ? Math.round(parseFloat(String(preisProEinheit)) * parseFloat(String(menge)) * 100) / 100
          : null;

      return tx.anlieferung.create({
        data: {
          nummer,
          datum: datum ? new Date(datum) : new Date(),
          kundeId: kId,
          artikelId: aId,
          menge: parseFloat(String(menge)),
          einheit: einheit ?? "t",
          feuchte: feuchte != null ? parseFloat(String(feuchte)) : null,
          qualitaet: qualitaet ?? null,
          preisProEinheit: preisProEinheit != null ? parseFloat(String(preisProEinheit)) : null,
          gesamtBetrag,
          notiz: notiz ?? null,
        },
        include: {
          kunde: { select: { id: true, name: true, firma: true } },
          artikel: { select: { id: true, name: true, einheit: true } },
        },
      });
    });

    return NextResponse.json(anlieferung, { status: 201 });
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    return NextResponse.json(
      { error: isDev && err instanceof Error ? err.message : "Interner Fehler" },
      { status: 500 }
    );
  }
}
