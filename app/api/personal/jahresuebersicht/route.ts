import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const jahrStr = searchParams.get("jahr");
  const jahr = jahrStr ? parseInt(jahrStr, 10) : new Date().getFullYear();

  if (isNaN(jahr)) return NextResponse.json({ error: "Ungültiges Jahr" }, { status: 400 });

  try {
    const abrechnungen = await prisma.gehaltsabrechnung.findMany({
      where: { jahr },
      select: {
        id: true,
        mitarbeiterId: true,
        monat: true,
        brutto: true,
        netto: true,
        abzuege: true,
        status: true,
        mitarbeiter: {
          select: { id: true, vorname: true, nachname: true, typ: true, kostenstelle: true },
        },
      },
      orderBy: [{ mitarbeiterId: "asc" }, { monat: "asc" }],
      take: 2000,
    });

    return NextResponse.json(abrechnungen);
  } catch {
    return NextResponse.json({ error: "Fehler beim Laden" }, { status: 500 });
  }
}
