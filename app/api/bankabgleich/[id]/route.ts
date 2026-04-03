import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, ctx: Ctx) {
  const { id: idStr } = await ctx.params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const body = await req.json();
    const { lieferungId, sammelrechnungId, ausgabeId } = body as {
      lieferungId?: number | null;
      sammelrechnungId?: number | null;
      ausgabeId?: number | null;
    };

    const umsatz = await prisma.kontoumsatz.findUnique({ where: { id } });
    if (!umsatz) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    const updateData: Record<string, unknown> = { zugeordnet: true };
    if (lieferungId !== undefined) updateData.lieferungId = lieferungId ?? null;
    if (sammelrechnungId !== undefined) updateData.sammelrechnungId = sammelrechnungId ?? null;
    if (ausgabeId !== undefined) updateData.ausgabeId = ausgabeId ?? null;

    const aktualisiert = await prisma.kontoumsatz.update({
      where: { id },
      data: updateData,
    });

    // Falls lieferungId gesetzt: Lieferung.bezahltAm auf buchungsdatum setzen (wenn noch null)
    if (lieferungId) {
      await prisma.lieferung.updateMany({
        where: { id: lieferungId, bezahltAm: null },
        data: { bezahltAm: umsatz.buchungsdatum },
      });
    }

    // Falls sammelrechnungId gesetzt: Sammelrechnung.bezahltAm setzen
    if (sammelrechnungId) {
      await prisma.sammelrechnung.updateMany({
        where: { id: sammelrechnungId, bezahltAm: null },
        data: { bezahltAm: umsatz.buchungsdatum },
      });
    }

    // Falls ausgabeId gesetzt: Ausgabe.bezahltAm setzen
    if (ausgabeId) {
      await prisma.ausgabe.updateMany({
        where: { id: ausgabeId, bezahltAm: null },
        data: { bezahltAm: umsatz.buchungsdatum },
      });
    }

    return NextResponse.json(aktualisiert);
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "P2025") return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    console.error(err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id: idStr } = await ctx.params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const aktualisiert = await prisma.kontoumsatz.update({
      where: { id },
      data: {
        zugeordnet: false,
        lieferungId: null,
        sammelrechnungId: null,
        ausgabeId: null,
      },
    });
    return NextResponse.json(aktualisiert);
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "P2025") return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    console.error(err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
