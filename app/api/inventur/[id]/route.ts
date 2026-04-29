import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  try {
    const inventur = await prisma.inventur.findUnique({
      where: { id: Number(id) },
      include: {
        positionen: {
          include: {
            artikel: {
              select: { id: true, name: true, einheit: true, artikelnummer: true, aktuellerBestand: true },
            },
          },
          orderBy: { artikel: { name: "asc" } },
        },
      },
    });

    if (!inventur) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }

    return NextResponse.json(inventur);
  } catch {
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  try {
    const inventur = await prisma.inventur.findUnique({
      where: { id: Number(id) },
      include: { positionen: true },
    });
    if (!inventur) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }

    // Option A: update positions
    if (body.positionen) {
      const updates = body.positionen as Array<{ id: number; istBestand: number; bemerkung?: string }>;

      await prisma.$transaction(
        updates.map((p) =>
          prisma.inventurPosition.update({
            where: { id: p.id },
            data: {
              istBestand: p.istBestand,
              differenz: p.istBestand - (inventur.positionen.find((pos) => pos.id === p.id)?.sollBestand ?? 0),
              bemerkung: p.bemerkung ?? null,
            },
          })
        )
      );

      const updated = await prisma.inventur.findUnique({
        where: { id: Number(id) },
        include: {
          positionen: {
            include: {
              artikel: {
                select: { id: true, name: true, einheit: true, artikelnummer: true, aktuellerBestand: true },
              },
            },
            orderBy: { artikel: { name: "asc" } },
          },
        },
      });
      return NextResponse.json(updated);
    }

    // Option B: close
    if (body.status === "ABGESCHLOSSEN" && !body.bucheKorrekturen) {
      const updated = await prisma.inventur.update({
        where: { id: Number(id) },
        data: { status: "ABGESCHLOSSEN" },
      });
      return NextResponse.json(updated);
    }

    // Option C: close + book corrections
    if (body.status === "ABGESCHLOSSEN" && body.bucheKorrekturen) {
      const datumStr = inventur.datum.toISOString().slice(0, 10);
      const grund = `Inventur ${datumStr}`;

      const positionenMitDiff = inventur.positionen.filter(
        (p) => p.differenz !== null && p.differenz !== 0
      );

      await prisma.$transaction(async (tx) => {
        const artikelList = await tx.artikel.findMany({
          where: { id: { in: positionenMitDiff.map((p) => p.artikelId) } },
          select: { id: true, aktuellerBestand: true },
        });
        const artikelMap = new Map(artikelList.map((a) => [a.id, a]));

        for (const pos of positionenMitDiff) {
          const artikel = artikelMap.get(pos.artikelId);
          if (!artikel) continue;
          const neuerBestand = artikel.aktuellerBestand + (pos.differenz ?? 0);
          await tx.artikel.update({
            where: { id: pos.artikelId },
            data: { aktuellerBestand: neuerBestand },
          });
          await tx.lagerbewegung.create({
            data: {
              artikelId: pos.artikelId,
              typ: "korrektur",
              menge: pos.differenz ?? 0,
              bestandNach: neuerBestand,
              notiz: grund,
            },
          });
        }

        await tx.inventur.update({
          where: { id: Number(id) },
          data: { status: "ABGESCHLOSSEN" },
        });
      });

      const updated = await prisma.inventur.findUnique({ where: { id: Number(id) } });
      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
  } catch (err) {
    console.error("Inventur PATCH error:", err);
    const isDev = process.env.NODE_ENV === "development";
    const message = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  try {
    const inventur = await prisma.inventur.findUnique({ where: { id: Number(id) } });
    if (!inventur) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }
    if (inventur.status !== "OFFEN") {
      return NextResponse.json({ error: "Nur offene Inventuren können gelöscht werden" }, { status: 400 });
    }

    await prisma.inventur.delete({ where: { id: Number(id) } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Fehler beim Löschen" }, { status: 500 });
  }
}
