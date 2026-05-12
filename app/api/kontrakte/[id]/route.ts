import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const GUELTIGE_STATUS = ["AKTIV", "ABGESCHLOSSEN", "STORNIERT"];

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const nId = parseInt(id, 10);
  if (isNaN(nId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const record = await prisma.kontrakt.findUnique({
      where: { id: nId },
      include: {
        kunde: { select: { id: true, name: true, firma: true, ort: true } },
        positionen: {
          include: {
            artikel: { select: { id: true, name: true, artikelnummer: true, einheit: true, standardpreis: true } },
          },
        },
      },
    });
    if (!record) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    return NextResponse.json(record);
  } catch (err) {
    console.error("Kontrakte GET [id] error:", err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const nId = parseInt(id, 10);
  if (isNaN(nId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (body.status !== undefined) {
    if (!GUELTIGE_STATUS.includes(body.status)) return NextResponse.json({ error: "Ungültiger Status" }, { status: 400 });
    data.status = body.status;
  }
  if (body.notiz !== undefined) data.notiz = body.notiz || null;
  if (body.gueltigVon !== undefined) data.gueltigVon = new Date(body.gueltigVon);
  if (body.gueltigBis !== undefined) data.gueltigBis = new Date(body.gueltigBis);

  try {
    const record = await prisma.kontrakt.update({
      where: { id: nId },
      data,
      include: {
        kunde: { select: { id: true, name: true, firma: true } },
        positionen: {
          include: { artikel: { select: { id: true, name: true, artikelnummer: true, einheit: true } } },
        },
      },
    });
    return NextResponse.json(record);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "P2025") return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    console.error("Kontrakte PUT error:", err);
    const isDev = process.env.NODE_ENV === "development";
    const message = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const nId = parseInt(id, 10);
  if (isNaN(nId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const record = await prisma.kontrakt.findUnique({ where: { id: nId }, select: { status: true } });
    if (!record) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    if (record.status !== "AKTIV") {
      return NextResponse.json({ error: "Nur aktive Kontrakte können gelöscht werden" }, { status: 400 });
    }
    await prisma.kontrakt.delete({ where: { id: nId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "P2025") return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    console.error("Kontrakte DELETE error:", err);
    return NextResponse.json({ error: "Interner Fehler" }, { status: 500 });
  }
}
