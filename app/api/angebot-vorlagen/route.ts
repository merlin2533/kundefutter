import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const vorlagen = await prisma.angebotVorlage.findMany({
      include: {
        positionen: {
          include: {
            artikel: {
              select: {
                id: true,
                name: true,
                artikelnummer: true,
                einheit: true,
                standardpreis: true,
                kategorie: true,
              },
            },
          },
          orderBy: { id: "asc" },
        },
      },
      orderBy: [{ aktiv: "desc" }, { name: "asc" }],
      take: 500,
    });
    return NextResponse.json(vorlagen);
  } catch (e) {
    console.error("AngebotVorlagen GET error:", e);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const name = b.name != null ? String(b.name).trim() : "";
  if (!name) return NextResponse.json({ error: "Name ist erforderlich" }, { status: 400 });

  const beschreibung = b.beschreibung != null ? String(b.beschreibung) : null;
  const notiz = b.notiz != null ? String(b.notiz) : null;
  const positionen = Array.isArray(b.positionen) ? b.positionen : [];

  try {
    const vorlage = await prisma.angebotVorlage.create({
      data: {
        name,
        beschreibung,
        notiz,
        positionen: {
          create: positionen.map((p: Record<string, unknown>) => ({
            artikelId: parseInt(String(p.artikelId), 10),
            menge: Number(p.menge) || 1,
            preis: Number(p.preis) || 0,
            rabatt: Number(p.rabatt) || 0,
            einheit: p.einheit != null ? String(p.einheit) : "kg",
            notiz: p.notiz != null ? String(p.notiz) : null,
          })),
        },
      },
      include: {
        positionen: {
          include: {
            artikel: {
              select: {
                id: true,
                name: true,
                artikelnummer: true,
                einheit: true,
                standardpreis: true,
              },
            },
          },
        },
      },
    });
    return NextResponse.json(vorlage, { status: 201 });
  } catch (err) {
    console.error("AngebotVorlage POST error:", err);
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
