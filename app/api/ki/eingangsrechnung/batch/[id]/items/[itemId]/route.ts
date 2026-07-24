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
const GUELTIGE_MWST = [0, 7, 19];

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

  const data: Prisma.KiEingangsrechnungBatchItemUpdateInput = {};
  if (body.lieferantId !== undefined) {
    const lid = body.lieferantId === null || body.lieferantId === "" ? null : Number(body.lieferantId);
    if (lid !== null && isNaN(lid)) {
      return NextResponse.json({ error: "Ungültige lieferantId" }, { status: 400 });
    }
    data.lieferantId = lid;
  }
  if (body.lieferantKonfidenz !== undefined) data.lieferantKonfidenz = body.lieferantKonfidenz;
  if (body.nummer !== undefined) data.nummer = body.nummer === null ? null : String(body.nummer);
  if (body.datum !== undefined) data.datum = body.datum === null ? null : String(body.datum);
  if (body.faelligAm !== undefined) data.faelligAm = body.faelligAm === null ? null : String(body.faelligAm);
  if (body.betragNetto !== undefined) {
    const betrag = body.betragNetto === null ? null : Number(body.betragNetto);
    if (betrag !== null && isNaN(betrag)) {
      return NextResponse.json({ error: "Ungültiger betragNetto" }, { status: 400 });
    }
    data.betragNetto = betrag;
  }
  if (body.mwstSatz !== undefined) {
    const mwst = body.mwstSatz === null ? null : Number(body.mwstSatz);
    if (mwst !== null && !GUELTIGE_MWST.includes(mwst)) {
      return NextResponse.json({ error: "Ungültiger mwstSatz" }, { status: 400 });
    }
    data.mwstSatz = mwst;
  }
  if (body.notiz !== undefined) data.notiz = body.notiz === null ? null : String(body.notiz);
  if (body.fehlendeFelder !== undefined) data.fehlendeFelder = JSON.stringify(body.fehlendeFelder);
  if (body.entscheidung !== undefined) {
    if (body.entscheidung !== null && !GUELTIGE_ENTSCHEIDUNG.includes(body.entscheidung)) {
      return NextResponse.json({ error: "Ungültige entscheidung" }, { status: 400 });
    }
    data.entscheidung = body.entscheidung;
  }

  try {
    const item = await prisma.kiEingangsrechnungBatchItem.findFirst({ where: { id: itemId, batchId } });
    if (!item) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    const updated = await prisma.kiEingangsrechnungBatchItem.update({ where: { id: itemId }, data });
    return NextResponse.json(updated);
  } catch (e) {
    Sentry.captureException(e);
    console.error("KiEingangsrechnungBatchItem PATCH error:", e);
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
    const item = await prisma.kiEingangsrechnungBatchItem.findFirst({ where: { id: itemId, batchId } });
    if (!item) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    try {
      await unlink(path.join(getUploadBase(), item.dateiPfad));
    } catch (e) {
      Sentry.captureException(e);
    }
    await prisma.kiEingangsrechnungBatchItem.delete({ where: { id: itemId } });

    return NextResponse.json({ ok: true });
  } catch (e) {
    Sentry.captureException(e);
    console.error("KiEingangsrechnungBatchItem DELETE error:", e);
    return NextResponse.json({ error: "Löschen fehlgeschlagen" }, { status: 500 });
  }
}
