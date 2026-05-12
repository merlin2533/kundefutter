import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const aktiv = searchParams.get("aktiv");

  const where: Record<string, unknown> = {};
  if (aktiv !== null) where.aktiv = aktiv === "true";

  try {
    const list = await prisma.kampagne.findMany({
      where,
      include: {
        artikel: {
          include: {
            artikel: { select: { id: true, name: true, artikelnummer: true, einheit: true, standardpreis: true } },
          },
        },
      },
      orderBy: { bis: "desc" },
      take: 200,
    });
    return NextResponse.json(list);
  } catch (err) {
    console.error("Kampagnen GET error:", err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  if (!body.name) return NextResponse.json({ error: "name erforderlich" }, { status: 400 });
  if (!body.von) return NextResponse.json({ error: "von erforderlich" }, { status: 400 });
  if (!body.bis) return NextResponse.json({ error: "bis erforderlich" }, { status: 400 });

  const artikelRaw = Array.isArray(body.artikel) ? body.artikel : [];

  try {
    const kampagne = await prisma.kampagne.create({
      data: {
        name: String(body.name),
        beschreibung: body.beschreibung ? String(body.beschreibung) : null,
        von: new Date(body.von),
        bis: new Date(body.bis),
        rabattProzent: body.rabattProzent != null ? Number(body.rabattProzent) : null,
        aktiv: body.aktiv !== undefined ? Boolean(body.aktiv) : true,
        artikel: {
          create: artikelRaw
            .filter((a: { artikelId?: unknown }) => a.artikelId)
            .map((a: { artikelId: unknown; sonderpreis?: unknown }) => ({
              artikelId: parseInt(String(a.artikelId), 10),
              sonderpreis: a.sonderpreis != null ? Number(a.sonderpreis) : null,
            })),
        },
      },
      include: {
        artikel: {
          include: {
            artikel: { select: { id: true, name: true, artikelnummer: true, einheit: true, standardpreis: true } },
          },
        },
      },
    });
    return NextResponse.json(kampagne, { status: 201 });
  } catch (err) {
    console.error("Kampagnen POST error:", err);
    const isDev = process.env.NODE_ENV === "development";
    const message = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
