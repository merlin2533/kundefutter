import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const vorlage = await prisma.angebotVorlage.findUnique({
      where: { id: numId },
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
    });
    if (!vorlage) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    return NextResponse.json(vorlage);
  } catch (e) {
    console.error("AngebotVorlage GET error:", e);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const positionen = Array.isArray(b.positionen) ? b.positionen : undefined;

  const data: Record<string, unknown> = {};
  if (b.name !== undefined) data.name = String(b.name).trim();
  if (b.beschreibung !== undefined) data.beschreibung = b.beschreibung ? String(b.beschreibung) : null;
  if (b.notiz !== undefined) data.notiz = b.notiz ? String(b.notiz) : null;
  if (b.aktiv !== undefined) data.aktiv = Boolean(b.aktiv);

  if (data.name === "") return NextResponse.json({ error: "Name darf nicht leer sein" }, { status: 400 });

  try {
    const vorlage = await prisma.$transaction(async (tx) => {
      const existing = await tx.angebotVorlage.findUnique({ where: { id: numId } });
      if (!existing) throw new Error("P2025");

      if (positionen !== undefined) {
        await tx.angebotVorlagePosition.deleteMany({ where: { vorlageId: numId } });
        if (positionen.length > 0) {
          await tx.angebotVorlagePosition.createMany({
            data: positionen.map((p: Record<string, unknown>) => ({
              vorlageId: numId,
              artikelId: parseInt(String(p.artikelId), 10),
              menge: Number(p.menge) || 1,
              preis: Number(p.preis) || 0,
              rabatt: Number(p.rabatt) || 0,
              einheit: p.einheit != null ? String(p.einheit) : "kg",
              notiz: p.notiz != null ? String(p.notiz) : null,
            })),
          });
        }
      }

      return tx.angebotVorlage.update({
        where: { id: numId },
        data,
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
            orderBy: { id: "asc" },
          },
        },
      });
    });
    return NextResponse.json(vorlage);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("P2025") || msg === "P2025") {
      return NextResponse.json({ error: "Vorlage nicht gefunden" }, { status: 404 });
    }
    console.error("AngebotVorlage PUT error:", err);
    const isDev = process.env.NODE_ENV === "development";
    return NextResponse.json({ error: isDev ? msg : "Interner Fehler" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    await prisma.angebotVorlage.delete({ where: { id: numId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("P2025")) {
      return NextResponse.json({ error: "Vorlage nicht gefunden" }, { status: 404 });
    }
    console.error("AngebotVorlage DELETE error:", err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
