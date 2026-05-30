import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const lieferant = await prisma.lieferant.findUnique({
      where: { id: Number(id) },
      include: {
        artikelZuordnungen: { include: { artikel: true } },
        wareneingaenge: {
          include: { positionen: { include: { artikel: true } } },
          orderBy: { datum: "desc" },
          take: 20,
        },
      },
    });
    if (!lieferant) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    return NextResponse.json(lieferant);
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
    const { name, ansprechpartner, email, telefon, strasse, plz, ort, notizen, aktiv, frachtkosten, mindestbestellwert } = body;
    const lieferant = await prisma.lieferant.update({
      where: { id: Number(id) },
      data: {
        ...(name !== undefined && { name }),
        ...(ansprechpartner !== undefined && { ansprechpartner }),
        ...(email !== undefined && { email }),
        ...(telefon !== undefined && { telefon }),
        ...(strasse !== undefined && { strasse }),
        ...(plz !== undefined && { plz }),
        ...(ort !== undefined && { ort }),
        ...(notizen !== undefined && { notizen }),
        ...(aktiv !== undefined && { aktiv }),
        ...(frachtkosten != null && { frachtkosten: Number(frachtkosten) }),
        ...(mindestbestellwert != null && { mindestbestellwert: Number(mindestbestellwert) }),
      },
    });
    return NextResponse.json(lieferant);
  } catch (e) {
    if ((e as { code?: string })?.code === "P2025") {
      return NextResponse.json({ error: "Lieferant nicht gefunden" }, { status: 404 });
    }
    const isDev = process.env.NODE_ENV === "development";
    return NextResponse.json({ error: isDev && e instanceof Error ? e.message : "Fehler beim Speichern" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    await prisma.lieferant.update({ where: { id: Number(id) }, data: { aktiv: false } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Lieferant nicht gefunden" }, { status: 404 });
  }
}
