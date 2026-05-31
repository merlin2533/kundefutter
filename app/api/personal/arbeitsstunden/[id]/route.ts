import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession, SESSION_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";

const GUELTIGE_ARTEN = ["arbeit", "urlaub", "krank", "feiertag"];
type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, ctx: Ctx) {
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const body = await req.json();
    const { datum, stunden, art, notiz } = body;

    if (art !== undefined && !GUELTIGE_ARTEN.includes(art)) {
      return NextResponse.json({ error: "Ungültige Stundenart" }, { status: 400 });
    }

    const updated = await prisma.arbeitsstunde.update({
      where: { id: numId },
      data: {
        ...(datum !== undefined && { datum: new Date(datum) }),
        ...(stunden !== undefined && { stunden: parseFloat(stunden) }),
        ...(art !== undefined && { art }),
        ...(notiz !== undefined && { notiz: notiz || null }),
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    const e = err as { code?: string; message?: string };
    if (e.code === "P2025") return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    return NextResponse.json({ error: isDev ? (e.message ?? "Fehler") : "Interner Fehler" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    await prisma.arbeitsstunde.delete({ where: { id: numId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    const e = err as { code?: string; message?: string };
    if (e.code === "P2025") return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    return NextResponse.json({ error: isDev ? (e.message ?? "Fehler") : "Interner Fehler" }, { status: 500 });
  }
}
