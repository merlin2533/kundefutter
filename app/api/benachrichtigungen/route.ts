import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const gelesenParam = searchParams.get("gelesen");

    const where: { gelesen?: boolean } = {};
    if (gelesenParam === "false") where.gelesen = false;
    else if (gelesenParam === "true") where.gelesen = true;

    const items = await prisma.benachrichtigung.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json(items);
  } catch (e) {
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && e instanceof Error ? e.message : "Interner Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { typ, titel, text, prioritaet, kundeId, artikelId, link } = body;

    if (!typ || !titel || !text) {
      return NextResponse.json({ error: "typ, titel und text sind Pflichtfelder" }, { status: 400 });
    }

    const VALID_TYP = ["lagerbestand", "sachkunde", "kreditlimit", "rechnung_faellig", "reklamation"];
    if (!VALID_TYP.includes(typ)) {
      return NextResponse.json({ error: "Ungültiger typ" }, { status: 400 });
    }

    const VALID_PRIO = ["info", "warnung", "kritisch"];
    const prio = VALID_PRIO.includes(prioritaet) ? prioritaet : "info";

    const item = await prisma.benachrichtigung.create({
      data: {
        typ,
        titel,
        text,
        prioritaet: prio,
        kundeId: kundeId ? parseInt(kundeId, 10) : null,
        artikelId: artikelId ? parseInt(artikelId, 10) : null,
        link: link ?? null,
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (e) {
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && e instanceof Error ? e.message : "Interner Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
