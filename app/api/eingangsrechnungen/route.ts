import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const GUELTIGE_STATUS = ["OFFEN", "BEZAHLT", "STORNIERT"];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lieferantId = searchParams.get("lieferantId");
  const status = searchParams.get("status");

  const where: Record<string, unknown> = {};

  if (lieferantId) {
    const lid = parseInt(lieferantId, 10);
    if (isNaN(lid)) return NextResponse.json({ error: "Ungültige lieferantId" }, { status: 400 });
    where.lieferantId = lid;
  }
  if (status) {
    if (!GUELTIGE_STATUS.includes(status)) return NextResponse.json({ error: "Ungültiger Status" }, { status: 400 });
    where.status = status;
  }

  try {
    const list = await prisma.eingangsRechnung.findMany({
      where,
      include: {
        lieferant: { select: { id: true, name: true } },
      },
      orderBy: { datum: "desc" },
      take: 200,
    });
    return NextResponse.json(list);
  } catch (err) {
    console.error("EingangsRechnungen GET error:", err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const lieferantId = parseInt(String(body.lieferantId), 10);
  if (isNaN(lieferantId)) return NextResponse.json({ error: "Ungültige lieferantId" }, { status: 400 });
  if (!body.datum) return NextResponse.json({ error: "datum erforderlich" }, { status: 400 });
  const betrag = Number(body.betrag);
  if (isNaN(betrag)) return NextResponse.json({ error: "Ungültiger betrag" }, { status: 400 });

  const status = body.status || "OFFEN";
  if (!GUELTIGE_STATUS.includes(status)) return NextResponse.json({ error: "Ungültiger Status" }, { status: 400 });

  try {
    const record = await prisma.eingangsRechnung.create({
      data: {
        lieferantId,
        nummer: body.nummer ? String(body.nummer) : null,
        datum: new Date(body.datum),
        faelligAm: body.faelligAm ? new Date(body.faelligAm) : null,
        betrag,
        mwst: body.mwst != null ? Number(body.mwst) : 19,
        status,
        belegpfad: body.belegpfad ? String(body.belegpfad) : null,
        notiz: body.notiz ? String(body.notiz) : null,
      },
      include: {
        lieferant: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(record, { status: 201 });
  } catch (err) {
    console.error("EingangsRechnungen POST error:", err);
    const isDev = process.env.NODE_ENV === "development";
    const message = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
