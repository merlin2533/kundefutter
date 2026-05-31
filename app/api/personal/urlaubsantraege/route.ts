import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession, SESSION_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const mitarbeiterIdParam = searchParams.get("mitarbeiterId");
  const status = searchParams.get("status");
  const jahrParam = searchParams.get("jahr");

  try {
    const where: Record<string, unknown> = {};
    if (mitarbeiterIdParam) {
      const id = parseInt(mitarbeiterIdParam, 10);
      if (!isNaN(id)) where.mitarbeiterId = id;
    }
    if (status) where.status = status;
    if (jahrParam) {
      const jahr = parseInt(jahrParam, 10);
      if (!isNaN(jahr)) {
        where.von = { gte: new Date(jahr, 0, 1) };
        where.bis = { lte: new Date(jahr, 11, 31, 23, 59, 59) };
      }
    }

    const antraege = await prisma.urlaubsantrag.findMany({
      where,
      include: { mitarbeiter: { select: { id: true, vorname: true, nachname: true } } },
      orderBy: { von: "desc" },
      take: 500,
    });

    return NextResponse.json(antraege);
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
    const { mitarbeiterId, von, bis, tage, notiz } = body;

    const maId = parseInt(mitarbeiterId, 10);
    if (isNaN(maId)) return NextResponse.json({ error: "Ungültige Mitarbeiter-ID" }, { status: 400 });
    if (!von || !bis) return NextResponse.json({ error: "Von und Bis sind erforderlich" }, { status: 400 });

    const tageVal = parseFloat(tage ?? "1");
    if (isNaN(tageVal) || tageVal <= 0) {
      return NextResponse.json({ error: "Ungültige Anzahl Tage" }, { status: 400 });
    }

    const antrag = await prisma.urlaubsantrag.create({
      data: {
        mitarbeiterId: maId,
        von: new Date(von),
        bis: new Date(bis),
        tage: tageVal,
        status: "BEANTRAGT",
        notiz: notiz || null,
      },
      include: { mitarbeiter: { select: { id: true, vorname: true, nachname: true } } },
    });

    return NextResponse.json(antrag, { status: 201 });
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    return NextResponse.json({ error: isDev && err instanceof Error ? err.message : "Interner Fehler" }, { status: 500 });
  }
}
