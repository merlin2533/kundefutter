import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession, SESSION_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";

const KATEGORIEN = [
  "Wareneinkauf",
  "Betriebsbedarf",
  "Fahrtkosten",
  "Bürobedarf",
  "Telefon/Internet",
  "Versicherung",
  "Miete",
  "Sonstige",
];

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id: idStr } = await ctx.params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const ausgabe = await prisma.ausgabe.findUnique({
      where: { id },
      include: { lieferant: { select: { id: true, name: true } } },
    });
    if (!ausgabe) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    return NextResponse.json(ausgabe);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const { id: idStr } = await ctx.params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const token = req.cookies.get(SESSION_COOKIE)?.value;
    const session = token ? await verifySession(token) : null;
    const body = await req.json();
    const { datum, belegNr, beschreibung, betragNetto, mwstSatz, kategorie, lieferantId, bezahltAm, notiz, ausleger, erfasstVon, bezahltVon } = body;

    if (betragNetto !== undefined) {
      const betrag = parseFloat(betragNetto);
      if (isNaN(betrag) || betrag < 0) return NextResponse.json({ error: "Ungültiger Betrag" }, { status: 400 });
    }
    if (mwstSatz !== undefined && ![0, 7, 19].includes(parseFloat(mwstSatz))) {
      return NextResponse.json({ error: "Ungültiger MwSt-Satz" }, { status: 400 });
    }
    if (kategorie && !KATEGORIEN.includes(kategorie)) {
      return NextResponse.json({ error: "Ungültige Kategorie" }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (datum !== undefined) data.datum = new Date(datum);
    if (belegNr !== undefined) data.belegNr = belegNr || null;
    if (beschreibung !== undefined) data.beschreibung = String(beschreibung).trim();
    if (betragNetto !== undefined) data.betragNetto = parseFloat(betragNetto);
    if (mwstSatz !== undefined) data.mwstSatz = parseFloat(mwstSatz);
    if (kategorie !== undefined) data.kategorie = kategorie;
    if (lieferantId !== undefined) data.lieferantId = lieferantId ? parseInt(lieferantId, 10) : null;
    if (bezahltAm !== undefined) data.bezahltAm = bezahltAm ? new Date(bezahltAm) : null;
    if (notiz !== undefined) data.notiz = notiz || null;
    if (ausleger !== undefined) data.ausleger = ausleger ? String(ausleger).trim() : null;
    if (erfasstVon !== undefined) data.erfasstVon = erfasstVon ? String(erfasstVon).trim() : null;
    // Wenn bezahltAm gesetzt wird und bezahltVon nicht explizit übergeben: Session-User setzen
    if (bezahltAm !== undefined && bezahltAm) {
      data.bezahltVon = bezahltVon ? String(bezahltVon).trim() : (session?.benutzername ?? null);
    } else if (bezahltVon !== undefined) {
      data.bezahltVon = bezahltVon ? String(bezahltVon).trim() : null;
    }
    // Wenn bezahltAm auf null gesetzt wird: bezahltVon löschen
    if (bezahltAm !== undefined && !bezahltAm) {
      data.bezahltVon = null;
    }

    const ausgabe = await prisma.ausgabe.update({
      where: { id },
      data,
      include: { lieferant: { select: { id: true, name: true } } },
    });
    return NextResponse.json(ausgabe);
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "P2025") return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    console.error(err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id: idStr } = await ctx.params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    await prisma.ausgabe.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "P2025") return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    console.error(err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
