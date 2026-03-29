import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditChanges } from "@/lib/audit";

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

  if (data.mwstSatz !== undefined) data.mwstSatz = Number(data.mwstSatz);

  let altSnapshot: Record<string, unknown> | null = null;
  const artikel = await prisma.$transaction(async (tx) => {
    const alt = await tx.artikel.findUnique({ where: { id: Number(id) } });
    if (!alt) throw new Error("Nicht gefunden");
    altSnapshot = alt as Record<string, unknown>;

    if (data.standardpreis !== undefined && alt.standardpreis !== data.standardpreis) {
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
  if (altSnapshot) {
    void auditChanges(
      "Artikel",
      Number(id),
      altSnapshot,
      artikel as Record<string, unknown>,
      ["name", "standardpreis", "mindestbestand"]
    );
  }
  return NextResponse.json(artikel);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  await prisma.artikel.update({ where: { id: Number(id) }, data: { aktiv: false } });
  return NextResponse.json({ ok: true });
}
