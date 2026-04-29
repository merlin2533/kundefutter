import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const sr = await prisma.sammelrechnung.findUnique({
      where: { id: parseInt(id, 10) },
      include: {
        kunde: { select: { id: true, name: true, firma: true, strasse: true, plz: true, ort: true } },
        lieferungen: {
          include: {
            positionen: {
              include: { artikel: { select: { id: true, name: true, einheit: true, mwstSatz: true } } },
            },
          },
          orderBy: { datum: "asc" },
        },
      },
    });
    if (!sr) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    return NextResponse.json(sr);
  } catch (err) {
    console.error("Sammelrechnung GET [id]:", err);
    return NextResponse.json({ error: "Interner Fehler" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const body = await req.json();
    const updateData: Record<string, unknown> = {};
    if (body.notiz !== undefined) updateData.notiz = body.notiz;
    if (body.zahlungsziel !== undefined) updateData.zahlungsziel = body.zahlungsziel;
    if (body.bezahltAm !== undefined) updateData.bezahltAm = body.bezahltAm ? new Date(body.bezahltAm) : null;
    if (body.rechnungDatum !== undefined) updateData.rechnungDatum = body.rechnungDatum ? new Date(body.rechnungDatum) : null;

    const sr = await prisma.sammelrechnung.update({
      where: { id: parseInt(id, 10) },
      data: updateData,
      include: {
        kunde: { select: { id: true, name: true, firma: true } },
        lieferungen: {
          select: {
            id: true,
            datum: true,
            positionen: { select: { menge: true, verkaufspreis: true, rabattProzent: true } },
          },
        },
      },
    });
    return NextResponse.json(sr);
  } catch (err) {
    console.error("Sammelrechnung error:", err);
    const isDev = process.env.NODE_ENV === "development";
    const isNotFound = (err as { code?: string }).code === "P2025";
    const status = isNotFound ? 404 : 400;
    const message = isNotFound ? "Nicht gefunden" : (isDev && err instanceof Error ? err.message : "Interner Fehler");
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    // Lieferungen aus Sammelrechnung lösen
    await prisma.lieferung.updateMany({
      where: { sammelrechnungId: parseInt(id, 10) },
      data: { sammelrechnungId: null },
    });
    await prisma.sammelrechnung.delete({ where: { id: parseInt(id, 10) } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Sammelrechnung error:", err);
    const isDev = process.env.NODE_ENV === "development";
    const isNotFound = (err as { code?: string }).code === "P2025";
    const status = isNotFound ? 404 : 400;
    const message = isNotFound ? "Nicht gefunden" : (isDev && err instanceof Error ? err.message : "Interner Fehler");
    return NextResponse.json({ error: message }, { status });
  }
}
