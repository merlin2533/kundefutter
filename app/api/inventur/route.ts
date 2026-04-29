import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const inventuren = await prisma.inventur.findMany({
      orderBy: { datum: "desc" },
      include: {
        _count: { select: { positionen: true } },
      },
      take: 100,
    });
    return NextResponse.json(inventuren);
  } catch {
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const { bezeichnung } = body as { bezeichnung?: string };

  try {
    const aktivArtikel = await prisma.artikel.findMany({
      where: { aktiv: true },
      orderBy: { name: "asc" },
      take: 5000,
    });

    const inventur = await prisma.inventur.create({
      data: {
        bezeichnung: bezeichnung?.trim() || null,
        positionen: {
          create: aktivArtikel.map((a) => ({
            artikelId: a.id,
            sollBestand: a.aktuellerBestand,
          })),
        },
      },
      include: {
        _count: { select: { positionen: true } },
      },
    });

    return NextResponse.json(inventur, { status: 201 });
  } catch (err) {
    console.error("Inventur POST error:", err);
    const isDev = process.env.NODE_ENV === "development";
    const message = isDev && err instanceof Error ? err.message : "Inventur konnte nicht angelegt werden";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
