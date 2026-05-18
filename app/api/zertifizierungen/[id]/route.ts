import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

const TYPEN_WHITELIST = new Set([
  "QS", "GlobalGAP", "Bio/Öko", "Cross-Compliance", "Ernte-Plus", "DLG", "Sonstige",
]);

const STATUS_WHITELIST = new Set(["aktiv", "abgelaufen", "gesperrt"]);

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id: idStr } = await ctx.params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const z = await prisma.zertifizierung.findUnique({
      where: { id },
      include: { kunde: { select: { id: true, name: true, firma: true } } },
    });
    if (!z) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    return NextResponse.json(z);
  } catch {
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const { id: idStr } = await ctx.params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const body = await req.json();
    const data: Record<string, unknown> = {};

    if (body.typ !== undefined) {
      if (!TYPEN_WHITELIST.has(body.typ)) {
        return NextResponse.json({ error: "Ungültiger Typ" }, { status: 400 });
      }
      data.typ = body.typ;
    }
    if (body.nummer !== undefined) data.nummer = body.nummer?.trim() || null;
    if (body.ausstellerOrg !== undefined) data.ausstellerOrg = body.ausstellerOrg?.trim() || null;
    if (body.ausstellungsdatum !== undefined) {
      data.ausstellungsdatum = body.ausstellungsdatum ? new Date(body.ausstellungsdatum) : null;
    }
    if (body.ablaufdatum !== undefined) {
      const ablaufdatum = body.ablaufdatum ? new Date(body.ablaufdatum) : null;
      data.ablaufdatum = ablaufdatum;
      // Auto-update status
      const now = new Date();
      if (ablaufdatum && ablaufdatum < now) {
        data.status = "abgelaufen";
      } else if (ablaufdatum) {
        data.status = "aktiv";
      }
    }
    if (body.status !== undefined) {
      if (!STATUS_WHITELIST.has(body.status)) {
        return NextResponse.json({ error: "Ungültiger Status" }, { status: 400 });
      }
      data.status = body.status;
    }
    if (body.notiz !== undefined) data.notiz = body.notiz?.trim() || null;
    if (body.belegpfad !== undefined) data.belegpfad = body.belegpfad || null;
    if (body.belegname !== undefined) data.belegname = body.belegname || null;

    const z = await prisma.zertifizierung.update({
      where: { id },
      data,
      include: { kunde: { select: { id: true, name: true, firma: true } } },
    });

    return NextResponse.json(z);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "P2025") return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id: idStr } = await ctx.params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    await prisma.zertifizierung.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "P2025") return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
