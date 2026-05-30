import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const nId = parseInt(id, 10);
  if (isNaN(nId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const record = await prisma.kampagne.findUnique({
      where: { id: nId },
      include: {
        artikel: {
          include: {
            artikel: { select: { id: true, name: true, artikelnummer: true, einheit: true, standardpreis: true, kategorie: true } },
          },
        },
        kunden: {
          include: {
            kunde: { select: { id: true, name: true, firma: true, ort: true, kategorie: true } },
          },
          orderBy: { kunde: { name: "asc" } },
        },
        _count: { select: { kunden: true } },
      },
    });
    if (!record) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    return NextResponse.json(record);
  } catch (err) {
    console.error("Kampagnen GET [id] error:", err);
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
  if (body.name !== undefined) data.name = String(body.name);
  if (body.beschreibung !== undefined) data.beschreibung = body.beschreibung || null;
  if (body.von !== undefined) data.von = new Date(body.von);
  if (body.bis !== undefined) data.bis = new Date(body.bis);
  if (body.rabattProzent !== undefined) data.rabattProzent = body.rabattProzent != null ? Number(body.rabattProzent) : null;
  if (body.aktiv !== undefined) data.aktiv = Boolean(body.aktiv);
  if (body.zielgruppeKriterien !== undefined) {
    data.zielgruppeKriterien = body.zielgruppeKriterien ? JSON.stringify(body.zielgruppeKriterien) : null;
  }

  try {
    // Handle artikel update if provided
    if (Array.isArray(body.artikel)) {
      await prisma.kampagneArtikel.deleteMany({ where: { kampagneId: nId } });
      data.artikel = {
        create: body.artikel
          .filter((a: { artikelId?: unknown }) => a.artikelId)
          .map((a: { artikelId: unknown; sonderpreis?: unknown }) => ({
            artikelId: parseInt(String(a.artikelId), 10),
            sonderpreis: a.sonderpreis != null ? Number(a.sonderpreis) : null,
          })),
      };
    }

    // Handle kunden update if provided
    if (Array.isArray(body.kunden)) {
      await prisma.kampagneKunde.deleteMany({ where: { kampagneId: nId } });
      data.kunden = {
        create: body.kunden
          .filter((k: { kundeId?: unknown }) => k.kundeId)
          .map((k: { kundeId: unknown }) => ({
            kundeId: parseInt(String(k.kundeId), 10),
          })),
      };
    }

    const record = await prisma.kampagne.update({
      where: { id: nId },
      data,
      include: {
        artikel: {
          include: {
            artikel: { select: { id: true, name: true, artikelnummer: true, einheit: true, standardpreis: true } },
          },
        },
        kunden: {
          include: {
            kunde: { select: { id: true, name: true, firma: true, ort: true, kategorie: true } },
          },
          orderBy: { kunde: { name: "asc" } },
        },
        _count: { select: { kunden: true } },
      },
    });
    return NextResponse.json(record);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "P2025") return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    console.error("Kampagnen PUT error:", err);
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
    await prisma.kampagne.delete({ where: { id: nId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "P2025") return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    console.error("Kampagnen DELETE error:", err);
    return NextResponse.json({ error: "Interner Fehler" }, { status: 500 });
  }
}
