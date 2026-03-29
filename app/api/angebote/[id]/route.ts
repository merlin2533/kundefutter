import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Params) {
  const { id } = await ctx.params;
  const angebot = await prisma.angebot.findUnique({
    where: { id: Number(id) },
    include: {
      kunde: { include: { kontakte: true } },
      positionen: { include: { artikel: true } },
    },
  });
  if (!angebot) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  return NextResponse.json(angebot);
}

export async function PUT(req: NextRequest, ctx: Params) {
  const { id } = await ctx.params;
  const body = await req.json();
  const { aktion, status, notiz, gueltigBis } = body;

  try {
    // Sonderaktion: Angebot annehmen → Lieferung erstellen
    if (aktion === "annehmen") {
      const result = await prisma.$transaction(async (tx) => {
        const angebot = await tx.angebot.findUnique({
          where: { id: Number(id) },
          include: { positionen: true },
        });
        if (!angebot) throw new Error("Angebot nicht gefunden");
        if (angebot.status !== "OFFEN") {
          throw new Error(`Angebot hat Status "${angebot.status}" und kann nicht angenommen werden`);
        }

        const lieferung = await tx.lieferung.create({
          data: {
            kundeId: angebot.kundeId,
            notiz: `Aus Angebot ${angebot.nummer} übernommen${angebot.notiz ? `: ${angebot.notiz}` : ""}`,
            positionen: {
              create: angebot.positionen.map((pos) => ({
                artikelId: pos.artikelId,
                menge: pos.menge,
                verkaufspreis: pos.preis * (1 - pos.rabatt / 100),
                einkaufspreis: 0,
                rabattProzent: pos.rabatt,
              })),
            },
          },
        });

        const updated = await tx.angebot.update({
          where: { id: Number(id) },
          data: { status: "ANGENOMMEN", notiz: `Lieferung ${lieferung.id} erstellt. ${angebot.notiz ?? ""}`.trim() },
          include: {
            kunde: { include: { kontakte: true } },
            positionen: { include: { artikel: true } },
          },
        });

        return { angebot: updated, lieferungId: lieferung.id };
      });

      return NextResponse.json(result);
    }

    // Normales Update
    const VALID_STATUS = ["OFFEN", "ANGENOMMEN", "ABGELEHNT", "ABGELAUFEN"];
    const updateData: Record<string, unknown> = {};
    if (status !== undefined) {
      if (!VALID_STATUS.includes(status)) throw new Error(`Ungültiger Status: ${status}`);
      updateData.status = status;
    }
    if (notiz !== undefined) updateData.notiz = notiz;
    if (gueltigBis !== undefined) updateData.gueltigBis = gueltigBis ? new Date(gueltigBis) : null;

    const updated = await prisma.angebot.update({
      where: { id: Number(id) },
      data: updateData,
      include: {
        kunde: { include: { kontakte: true } },
        positionen: { include: { artikel: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Params) {
  const { id } = await ctx.params;
  try {
    await prisma.angebot.delete({ where: { id: Number(id) } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
