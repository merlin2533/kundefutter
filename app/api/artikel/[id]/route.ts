import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const artikel = await prisma.artikel.findUnique({
    where: { id: Number(id) },
    include: {
      lieferanten: { include: { lieferant: true } },
      kundePreise: { include: { kunde: true } },
      preisHistorie: { orderBy: { geaendertAm: "desc" }, take: 20 },
      bedarfe: { include: { kunde: true } },
      dokumente: true,
    },
  });
  if (!artikel) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  return NextResponse.json(artikel);
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const { lieferanten, ...data } = body;

  const artikel = await prisma.$transaction(async (tx) => {
    // Preishistorie eintragen wenn Preis geändert wurde
    const alt = await tx.artikel.findUnique({ where: { id: Number(id) } });
    if (alt && data.standardpreis !== undefined && alt.standardpreis !== data.standardpreis) {
      await tx.artikelPreisHistorie.create({
        data: {
          artikelId: Number(id),
          alterPreis: alt.standardpreis,
          neuerPreis: data.standardpreis,
        },
      });
    }

    return tx.artikel.update({
      where: { id: Number(id) },
      data: {
        ...data,
        ...(lieferanten !== undefined && {
          lieferanten: {
            deleteMany: {},
            create: lieferanten,
          },
        }),
      },
      include: {
        lieferanten: { include: { lieferant: true } },
        dokumente: true,
      },
    });
  });
  return NextResponse.json(artikel);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  await prisma.artikel.update({ where: { id: Number(id) }, data: { aktiv: false } });
  return NextResponse.json({ ok: true });
}
