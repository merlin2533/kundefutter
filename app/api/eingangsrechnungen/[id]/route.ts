import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const GUELTIGE_STATUS = ["OFFEN", "BEZAHLT", "STORNIERT"];

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const nId = parseInt(id, 10);
  if (isNaN(nId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const record = await prisma.eingangsRechnung.findUnique({
      where: { id: nId },
      include: {
        lieferant: { select: { id: true, name: true, email: true, telefon: true, ort: true } },
      },
    });
    if (!record) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    return NextResponse.json(record);
  } catch (err) {
    console.error("EingangsRechnungen GET [id] error:", err);
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

  if (body.aktion === "bezahlen") {
    data.status = "BEZAHLT";
  } else {
    if (body.status !== undefined) {
      if (!GUELTIGE_STATUS.includes(body.status)) return NextResponse.json({ error: "Ungültiger Status" }, { status: 400 });
      data.status = body.status;
    }
    if (body.nummer !== undefined) data.nummer = body.nummer || null;
    if (body.datum !== undefined) data.datum = new Date(body.datum);
    if (body.faelligAm !== undefined) data.faelligAm = body.faelligAm ? new Date(body.faelligAm) : null;
    if (body.betrag !== undefined) data.betrag = Number(body.betrag);
    if (body.mwst !== undefined) data.mwst = Number(body.mwst);
    if (body.belegpfad !== undefined) data.belegpfad = body.belegpfad || null;
    if (body.notiz !== undefined) data.notiz = body.notiz || null;
  }

  try {
    const record = await prisma.eingangsRechnung.update({
      where: { id: nId },
      data,
      include: {
        lieferant: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(record);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "P2025") return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    console.error("EingangsRechnungen PUT error:", err);
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
    const record = await prisma.eingangsRechnung.findUnique({ where: { id: nId }, select: { status: true } });
    if (!record) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    if (record.status !== "OFFEN") {
      return NextResponse.json({ error: "Nur Rechnungen mit Status OFFEN können gelöscht werden" }, { status: 400 });
    }
    await prisma.eingangsRechnung.delete({ where: { id: nId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "P2025") return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    console.error("EingangsRechnungen DELETE error:", err);
    return NextResponse.json({ error: "Interner Fehler" }, { status: 500 });
  }
}
