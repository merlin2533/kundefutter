import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Sentry } from "@/lib/sentry";
import { getUploadBase } from "@/lib/upload";
import { unlink } from "fs/promises";
import path from "path";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; itemId: string }> };

const GUELTIGE_ENTSCHEIDUNG = ["passt", "passt_nicht"];

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id: idStr, itemId: itemIdStr } = await ctx.params;
  const batchId = parseInt(idStr, 10);
  const itemId = parseInt(itemIdStr, 10);
  if (isNaN(batchId) || isNaN(itemId)) {
    return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });
  }

  let body;
  try {
    body = await req.json();
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const data: Prisma.KiLieferungBatchItemUpdateInput = {};
  if (body.kundeId !== undefined) {
    const kid = body.kundeId === null || body.kundeId === "" ? null : Number(body.kundeId);
    if (kid !== null && isNaN(kid)) {
      return NextResponse.json({ error: "Ungültige kundeId" }, { status: 400 });
    }
    data.kundeId = kid;
  }
  if (body.kundeKonfidenz !== undefined) data.kundeKonfidenz = body.kundeKonfidenz;
  if (body.positionen !== undefined) data.positionenJson = JSON.stringify(body.positionen);
  if (body.fehlendeFelder !== undefined) data.fehlendeFelder = JSON.stringify(body.fehlendeFelder);
  if (body.entscheidung !== undefined) {
    if (body.entscheidung !== null && !GUELTIGE_ENTSCHEIDUNG.includes(body.entscheidung)) {
      return NextResponse.json({ error: "Ungültige entscheidung" }, { status: 400 });
    }
    data.entscheidung = body.entscheidung;
  }

  try {
    const item = await prisma.kiLieferungBatchItem.findFirst({ where: { id: itemId, batchId } });
    if (!item) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    const updated = await prisma.kiLieferungBatchItem.update({ where: { id: itemId }, data });
    return NextResponse.json(updated);
  } catch (e) {
    Sentry.captureException(e);
    console.error("KiLieferungBatchItem PATCH error:", e);
    return NextResponse.json({ error: "Aktualisierung fehlgeschlagen" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id: idStr, itemId: itemIdStr } = await ctx.params;
  const batchId = parseInt(idStr, 10);
  const itemId = parseInt(itemIdStr, 10);
  if (isNaN(batchId) || isNaN(itemId)) {
    return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });
  }

  try {
    const item = await prisma.kiLieferungBatchItem.findFirst({ where: { id: itemId, batchId } });
    if (!item) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    try {
      await unlink(path.join(getUploadBase(), item.dateiPfad));
    } catch (e) {
      Sentry.captureException(e);
    }
    await prisma.kiLieferungBatchItem.delete({ where: { id: itemId } });

    return NextResponse.json({ ok: true });
  } catch (e) {
    Sentry.captureException(e);
    console.error("KiLieferungBatchItem DELETE error:", e);
    return NextResponse.json({ error: "Löschen fehlgeschlagen" }, { status: 500 });
  }
}
