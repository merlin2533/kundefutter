import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { liefposArtikelSelect } from "@/lib/artikel-select";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const gutschrift = await prisma.gutschrift.findUnique({
      where: { id: Number(id) },
      include: {
        kunde: true,
        lieferung: {
          include: { positionen: { include: { artikel: { select: liefposArtikelSelect } } } },
        },
        positionen: { include: { artikel: { select: liefposArtikelSelect } } },
      },
    });
    if (!gutschrift) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }
    return NextResponse.json(gutschrift);
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
    const existing = await prisma.gutschrift.findUnique({
      where: { id: Number(id) },
    });
    if (!existing) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }
    if (existing.status !== "OFFEN") {
      return NextResponse.json(
        { error: "Nur Gutschriften mit Status OFFEN können bearbeitet werden" },
        { status: 400 }
      );
    }

    const ERLAUBTE_STATUS = ["OFFEN", "VERBUCHT", "STORNIERT"];
    if (body.status && !ERLAUBTE_STATUS.includes(body.status)) {
      return NextResponse.json({ error: "Ungültiger Status" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (body.status !== undefined) updateData.status = body.status;
    if (body.notiz !== undefined) updateData.notiz = body.notiz;
    if (body.grund !== undefined) updateData.grund = body.grund;
    if (body.datum !== undefined) updateData.datum = new Date(body.datum);

    const updated = await prisma.gutschrift.update({
      where: { id: Number(id) },
      data: updateData,
      include: {
        kunde: true,
        lieferung: true,
        positionen: { include: { artikel: { select: liefposArtikelSelect } } },
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("Gutschrift error:", err);
    const isDev = process.env.NODE_ENV === "development";
    const message = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  try {
    const existing = await prisma.gutschrift.findUnique({
      where: { id: Number(id) },
    });
    if (!existing) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }
    if (existing.status !== "OFFEN") {
      return NextResponse.json(
        { error: "Nur Gutschriften mit Status OFFEN können gelöscht werden" },
        { status: 400 }
      );
    }

    await prisma.gutschrift.delete({ where: { id: Number(id) } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Gutschrift error:", err);
    const isDev = process.env.NODE_ENV === "development";
    const message = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
