import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession, SESSION_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";

const GUELTIGE_ARTEN = ["arbeit", "urlaub", "krank", "feiertag"];

export async function GET(req: NextRequest) {
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const mitarbeiterIdParam = searchParams.get("mitarbeiterId");
  const monatParam = searchParams.get("monat");
  const jahrParam = searchParams.get("jahr");
  const vonParam = searchParams.get("von");
  const bisParam = searchParams.get("bis");

  try {
    const where: Record<string, unknown> = {};

    if (mitarbeiterIdParam) {
      const id = parseInt(mitarbeiterIdParam, 10);
      if (!isNaN(id)) where.mitarbeiterId = id;
    }

    if (monatParam && jahrParam) {
      const monat = parseInt(monatParam, 10);
      const jahr = parseInt(jahrParam, 10);
      if (!isNaN(monat) && !isNaN(jahr)) {
        const start = new Date(jahr, monat - 1, 1);
        const end = new Date(jahr, monat, 0, 23, 59, 59, 999);
        where.datum = { gte: start, lte: end };
      }
    } else if (vonParam || bisParam) {
      where.datum = {
        ...(vonParam ? { gte: new Date(vonParam) } : {}),
        ...(bisParam ? { lte: new Date(bisParam) } : {}),
      };
    }

    const stunden = await prisma.arbeitsstunde.findMany({
      where,
      include: { mitarbeiter: { select: { id: true, vorname: true, nachname: true } } },
      orderBy: { datum: "desc" },
      take: 1000,
    });

    return NextResponse.json(stunden);
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
    const { mitarbeiterId, datum, stunden, art, notiz } = body;

    const maId = parseInt(mitarbeiterId, 10);
    if (isNaN(maId)) return NextResponse.json({ error: "Ungültige Mitarbeiter-ID" }, { status: 400 });

    if (!datum) return NextResponse.json({ error: "Datum ist erforderlich" }, { status: 400 });

    const std = parseFloat(stunden);
    if (isNaN(std) || std <= 0 || std > 24) {
      return NextResponse.json({ error: "Stunden müssen zwischen 0.5 und 24 liegen" }, { status: 400 });
    }

    const artVal = art ?? "arbeit";
    if (!GUELTIGE_ARTEN.includes(artVal)) {
      return NextResponse.json({ error: "Ungültige Stundenart" }, { status: 400 });
    }

    const eintrag = await prisma.arbeitsstunde.create({
      data: {
        mitarbeiterId: maId,
        datum: new Date(datum),
        stunden: std,
        art: artVal,
        notiz: notiz || null,
      },
      include: { mitarbeiter: { select: { id: true, vorname: true, nachname: true } } },
    });

    return NextResponse.json(eintrag, { status: 201 });
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    return NextResponse.json({ error: isDev && err instanceof Error ? err.message : "Interner Fehler" }, { status: 500 });
  }
}
