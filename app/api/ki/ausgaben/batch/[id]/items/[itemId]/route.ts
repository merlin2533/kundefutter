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

  const data: Prisma.KiAusgabenBatchItemUpdateInput = {};
  if (body.lieferantId !== undefined) {
    const lid = body.lieferantId === null || body.lieferantId === "" ? null : Number(body.lieferantId);
    if (lid !== null && isNaN(lid)) {
      return NextResponse.json({ error: "Ungültige lieferantId" }, { status: 400 });
    }
    data.lieferantId = lid;
  }
  if (body.lieferantKonfidenz !== undefined) data.lieferantKonfidenz = body.lieferantKonfidenz;
  if (body.datum !== undefined) data.datum = body.datum === null ? null : String(body.datum);
  if (body.belegNr !== undefined) data.belegNr = body.belegNr === null ? null : String(body.belegNr);
  if (body.beschreibung !== undefined) data.beschreibung = body.beschreibung === null ? null : String(body.beschreibung);
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
  if (body.betragNetto2 !== undefined) {
    const betrag2 = body.betragNetto2 === null ? null : Number(body.betragNetto2);
    if (betrag2 !== null && isNaN(betrag2)) {
      return NextResponse.json({ error: "Ungültiger betragNetto2" }, { status: 400 });
    }
    data.betragNetto2 = betrag2;
  }
  if (body.mwstSatz2 !== undefined) {
    const mwst2 = body.mwstSatz2 === null ? null : Number(body.mwstSatz2);
    if (mwst2 !== null && !GUELTIGE_MWST.includes(mwst2)) {
      return NextResponse.json({ error: "Ungültiger mwstSatz2" }, { status: 400 });
    }
    data.mwstSatz2 = mwst2;
  }
  if (body.betragNetto3 !== undefined) {
    const betrag3 = body.betragNetto3 === null ? null : Number(body.betragNetto3);
    if (betrag3 !== null && isNaN(betrag3)) {
      return NextResponse.json({ error: "Ungültiger betragNetto3" }, { status: 400 });
    }
    data.betragNetto3 = betrag3;
  }
  if (body.mwstSatz3 !== undefined) {
    const mwst3 = body.mwstSatz3 === null ? null : Number(body.mwstSatz3);
    if (mwst3 !== null && !GUELTIGE_MWST.includes(mwst3)) {
      return NextResponse.json({ error: "Ungültiger mwstSatz3" }, { status: 400 });
    }
    data.mwstSatz3 = mwst3;
  }
  if (body.kategorie !== undefined) data.kategorie = body.kategorie === null ? null : String(body.kategorie);
  if (body.fehlendeFelder !== undefined) data.fehlendeFelder = JSON.stringify(body.fehlendeFelder);
  if (body.entscheidung !== undefined) {
    if (body.entscheidung !== null && !GUELTIGE_ENTSCHEIDUNG.includes(body.entscheidung)) {
      return NextResponse.json({ error: "Ungültige entscheidung" }, { status: 400 });
    }
    data.entscheidung = body.entscheidung;
  }

  try {
    const item = await prisma.kiAusgabenBatchItem.findFirst({ where: { id: itemId, batchId } });
    if (!item) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    const updated = await prisma.kiAusgabenBatchItem.update({ where: { id: itemId }, data });
    return NextResponse.json(updated);
  } catch (e) {
    Sentry.captureException(e);
    console.error("KiAusgabenBatchItem PATCH error:", e);
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
    const item = await prisma.kiAusgabenBatchItem.findFirst({ where: { id: itemId, batchId } });
    if (!item) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    try {
      await unlink(path.join(getUploadBase(), item.dateiPfad));
    } catch (e) {
      Sentry.captureException(e);
    }
    await prisma.kiAusgabenBatchItem.delete({ where: { id: itemId } });

    return NextResponse.json({ ok: true });
  } catch (e) {
    Sentry.captureException(e);
    console.error("KiAusgabenBatchItem DELETE error:", e);
    return NextResponse.json({ error: "Löschen fehlgeschlagen" }, { status: 500 });
  }
}
