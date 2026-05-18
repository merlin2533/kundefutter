import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
export const dynamic = "force-dynamic";

// GET /api/einstellungen/portal — alle Kunden mit Portal-Zugang-Status
export async function GET() {
  try {
    const zugaenge = await prisma.kundePortalZugang.findMany({
      include: {
        kunde: { select: { id: true, name: true, firma: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return NextResponse.json(zugaenge);
  } catch {
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

// POST /api/einstellungen/portal — neuen Zugang erstellen
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const kundeId = parseInt(String(body.kundeId), 10);
    if (isNaN(kundeId)) return NextResponse.json({ error: "kundeId erforderlich" }, { status: 400 });

    const { benutzername, passwort } = body as { benutzername?: string; passwort?: string };
    if (!benutzername?.trim()) return NextResponse.json({ error: "Benutzername erforderlich" }, { status: 400 });
    if (!passwort || passwort.length < 6) return NextResponse.json({ error: "Passwort mind. 6 Zeichen" }, { status: 400 });

    const kunde = await prisma.kunde.findUnique({ where: { id: kundeId } });
    if (!kunde) return NextResponse.json({ error: "Kunde nicht gefunden" }, { status: 404 });

    const passwortHash = await bcrypt.hash(passwort, 10);

    const zugang = await prisma.kundePortalZugang.create({
      data: {
        kundeId,
        benutzername: benutzername.trim(),
        passwortHash,
        aktiv: true,
      },
      include: { kunde: { select: { id: true, name: true, firma: true } } },
    });

    return NextResponse.json(zugang, { status: 201 });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "P2002") return NextResponse.json({ error: "Benutzername bereits vergeben" }, { status: 409 });
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PUT /api/einstellungen/portal?id=X — Zugang bearbeiten (aktiv, Passwort-Reset)
export async function PUT(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = parseInt(searchParams.get("id") ?? "", 10);
  if (isNaN(id)) return NextResponse.json({ error: "id fehlt" }, { status: 400 });

  try {
    const body = await req.json();
    const data: Record<string, unknown> = {};

    if (body.aktiv !== undefined) data.aktiv = Boolean(body.aktiv);
    if (body.passwort) {
      if (String(body.passwort).length < 6) {
        return NextResponse.json({ error: "Passwort mind. 6 Zeichen" }, { status: 400 });
      }
      data.passwortHash = await bcrypt.hash(String(body.passwort), 10);
    }

    const zugang = await prisma.kundePortalZugang.update({
      where: { id },
      data,
      include: { kunde: { select: { id: true, name: true, firma: true } } },
    });

    return NextResponse.json(zugang);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "P2025") return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

// DELETE /api/einstellungen/portal?id=X
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = parseInt(searchParams.get("id") ?? "", 10);
  if (isNaN(id)) return NextResponse.json({ error: "id fehlt" }, { status: 400 });

  try {
    await prisma.kundePortalZugang.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "P2025") return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
