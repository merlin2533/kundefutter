import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { requireVollePersonalRechte } from "@/lib/permissions";
import { Sentry } from "@/lib/sentry";
import { getModulConfig, requireModul } from "@/lib/modul-config";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, ctx: Ctx) {
  const modul = await getModulConfig();
  const denyModul = requireModul(modul, "personal");
  if (denyModul) return denyModul;
  const me = await getCurrentUser();
  const deny = requireVollePersonalRechte(me);
  if (deny) return deny;

  const { id } = await ctx.params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const body = await req.json();
    const { aktion, von, bis, tage, notiz, status } = body;

    let newStatus = status;
    if (aktion === "genehmigen") newStatus = "GENEHMIGT";
    else if (aktion === "ablehnen") newStatus = "ABGELEHNT";

    if (newStatus && !["BEANTRAGT", "GENEHMIGT", "ABGELEHNT"].includes(newStatus)) {
      return NextResponse.json({ error: "Ungültiger Status" }, { status: 400 });
    }

    const updated = await prisma.urlaubsantrag.update({
      where: { id: numId },
      data: {
        ...(newStatus !== undefined && { status: newStatus }),
        ...(von !== undefined && { von: new Date(von) }),
        ...(bis !== undefined && { bis: new Date(bis) }),
        ...(tage !== undefined && { tage: parseFloat(tage) }),
        ...(notiz !== undefined && { notiz: notiz || null }),
      },
      include: { mitarbeiter: { select: { id: true, vorname: true, nachname: true } } },
    });

    return NextResponse.json(updated);
  } catch (err) {
    Sentry.captureException(err);
    const isDev = process.env.NODE_ENV === "development";
    const e = err as { code?: string; message?: string };
    if (e.code === "P2025") return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    return NextResponse.json({ error: isDev ? (e.message ?? "Fehler") : "Interner Fehler" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const modul = await getModulConfig();
  const denyModul = requireModul(modul, "personal");
  if (denyModul) return denyModul;
  const me = await getCurrentUser();
  const deny = requireVollePersonalRechte(me);
  if (deny) return deny;

  const { id } = await ctx.params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    await prisma.urlaubsantrag.delete({ where: { id: numId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err);
    const isDev = process.env.NODE_ENV === "development";
    const e = err as { code?: string; message?: string };
    if (e.code === "P2025") return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    return NextResponse.json({ error: isDev ? (e.message ?? "Fehler") : "Interner Fehler" }, { status: 500 });
  }
}
