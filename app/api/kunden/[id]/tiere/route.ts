import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { NUTZUNGSARTEN, type TierartKey } from "@/lib/tierbedarf";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const TIERARTEN: TierartKey[] = ["Rind", "Schwein", "Geflugel", "Pferd", "Schaf", "Ziege"];

// GET /api/kunden/[id]/tiere
export async function GET(_req: NextRequest, ctx: Params) {
  const { id } = await ctx.params;
  const kundeId = parseInt(id, 10);
  if (isNaN(kundeId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const tiere = await prisma.kundeTier.findMany({
      where: { kundeId },
      orderBy: { erstellt: "desc" },
      take: 500,
    });
    return NextResponse.json(tiere);
  } catch {
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

// POST /api/kunden/[id]/tiere
export async function POST(req: NextRequest, ctx: Params) {
  const { id } = await ctx.params;
  const kundeId = parseInt(id, 10);
  if (isNaN(kundeId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const body = await req.json();
    const { name, tierart, nutzungsart, rasse, anzahl, gewicht, leistung, leistungEinheit, laktationstag, notiz } = body;

    if (!name?.trim()) return NextResponse.json({ error: "Name ist erforderlich" }, { status: 400 });
    if (!TIERARTEN.includes(tierart)) return NextResponse.json({ error: "Ungültige Tierart" }, { status: 400 });
    const validNutzung = NUTZUNGSARTEN[tierart as TierartKey] ?? [];
    if (!nutzungsart || !validNutzung.includes(nutzungsart)) {
      return NextResponse.json({ error: "Ungültige Nutzungsart für diese Tierart" }, { status: 400 });
    }

    const anzahlNum = anzahl != null && anzahl !== "" ? parseInt(String(anzahl), 10) : 1;
    if (isNaN(anzahlNum) || anzahlNum < 1 || anzahlNum > 1000000) {
      return NextResponse.json({ error: "Ungültige Tierzahl" }, { status: 400 });
    }
    const gewichtNum = gewicht != null && gewicht !== "" ? Number(gewicht) : null;
    if (gewichtNum !== null && (isNaN(gewichtNum) || gewichtNum <= 0 || gewichtNum > 2000)) {
      return NextResponse.json({ error: "Ungültiges Gewicht (0–2000 kg)" }, { status: 400 });
    }
    const leistungNum = leistung != null && leistung !== "" ? Number(leistung) : null;
    if (leistungNum !== null && (isNaN(leistungNum) || leistungNum < 0)) {
      return NextResponse.json({ error: "Ungültige Leistung" }, { status: 400 });
    }
    const laktNum = laktationstag != null && laktationstag !== "" ? parseInt(String(laktationstag), 10) : null;

    const tier = await prisma.kundeTier.create({
      data: {
        kundeId,
        name: name.trim(),
        tierart,
        nutzungsart,
        rasse: rasse?.trim() || null,
        anzahl: anzahlNum,
        gewicht: gewichtNum,
        leistung: leistungNum,
        leistungEinheit: leistungEinheit?.trim() || null,
        laktationstag: laktNum,
        notiz: notiz?.trim() || null,
      },
    });
    return NextResponse.json(tier, { status: 201 });
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PUT /api/kunden/[id]/tiere?tierId=X
export async function PUT(req: NextRequest, ctx: Params) {
  const { id } = await ctx.params;
  const kundeId = parseInt(id, 10);
  if (isNaN(kundeId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const tierId = parseInt(searchParams.get("tierId") ?? "", 10);
  if (isNaN(tierId)) return NextResponse.json({ error: "tierId fehlt" }, { status: 400 });

  try {
    const existing = await prisma.kundeTier.findFirst({ where: { id: tierId, kundeId } });
    if (!existing) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = String(body.name).trim();
    if (body.rasse !== undefined) data.rasse = body.rasse?.trim() || null;
    if (body.anzahl !== undefined) {
      const n = parseInt(String(body.anzahl), 10);
      if (!isNaN(n) && n >= 1) data.anzahl = n;
    }
    if (body.gewicht !== undefined) data.gewicht = body.gewicht != null && body.gewicht !== "" ? Number(body.gewicht) : null;
    if (body.leistung !== undefined) data.leistung = body.leistung != null && body.leistung !== "" ? Number(body.leistung) : null;
    if (body.leistungEinheit !== undefined) data.leistungEinheit = body.leistungEinheit?.trim() || null;
    if (body.laktationstag !== undefined) data.laktationstag = body.laktationstag != null && body.laktationstag !== "" ? parseInt(String(body.laktationstag), 10) : null;
    if (body.notiz !== undefined) data.notiz = body.notiz?.trim() || null;
    if (body.tierart !== undefined && TIERARTEN.includes(body.tierart)) data.tierart = body.tierart;
    if (body.nutzungsart !== undefined) {
      const ta = (data.tierart as TierartKey) ?? (existing.tierart as TierartKey);
      if ((NUTZUNGSARTEN[ta] ?? []).includes(body.nutzungsart)) data.nutzungsart = body.nutzungsart;
    }

    const tier = await prisma.kundeTier.update({ where: { id: tierId }, data });
    return NextResponse.json(tier);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "P2025") return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

// DELETE /api/kunden/[id]/tiere?tierId=X
export async function DELETE(req: NextRequest, ctx: Params) {
  const { id } = await ctx.params;
  const kundeId = parseInt(id, 10);
  if (isNaN(kundeId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const tierId = parseInt(searchParams.get("tierId") ?? "", 10);
  if (isNaN(tierId)) return NextResponse.json({ error: "tierId fehlt oder ungültig" }, { status: 400 });

  try {
    const existing = await prisma.kundeTier.findFirst({ where: { id: tierId, kundeId } });
    if (!existing) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    await prisma.kundeTier.delete({ where: { id: tierId } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
