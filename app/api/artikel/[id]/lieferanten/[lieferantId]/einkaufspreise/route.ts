import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { setAktiverEinkaufspreis } from "@/lib/einkaufspreisverlauf";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; lieferantId: string }> };

async function findeArtikelLieferant(artikelId: number, lieferantId: number) {
  return prisma.artikelLieferant.findUnique({
    where: { artikelId_lieferantId: { artikelId, lieferantId } },
    select: { id: true },
  });
}

export async function GET(_req: NextRequest, ctx: Params) {
  const { id, lieferantId } = await ctx.params;
  const artikelId = parseInt(id, 10);
  const lId = parseInt(lieferantId, 10);
  if (isNaN(artikelId) || isNaN(lId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const al = await findeArtikelLieferant(artikelId, lId);
    if (!al) return NextResponse.json({ error: "Lieferantenzuordnung nicht gefunden" }, { status: 404 });

    const preise = await prisma.artikelLieferantPreis.findMany({
      where: { artikelLieferantId: al.id },
      orderBy: { datum: "desc" },
    });
    return NextResponse.json(preise);
  } catch (err) {
    Sentry.captureException(err);
    console.error("Einkaufspreis-Verlauf GET error:", err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, ctx: Params) {
  const { id, lieferantId } = await ctx.params;
  const artikelId = parseInt(id, 10);
  const lId = parseInt(lieferantId, 10);
  if (isNaN(artikelId) || isNaN(lId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  let body;
  try {
    body = await req.json();
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const { datum, einkaufspreis, notiz, aktiv } = body;
  const geparstesDatum = datum ? new Date(String(datum)) : null;
  if (!geparstesDatum || isNaN(geparstesDatum.getTime())) {
    return NextResponse.json({ error: "datum ist erforderlich (gültiges Datum)" }, { status: 400 });
  }
  if (typeof einkaufspreis !== "number" || !Number.isFinite(einkaufspreis) || einkaufspreis < 0) {
    return NextResponse.json({ error: "einkaufspreis ist erforderlich (Zahl ≥ 0)" }, { status: 400 });
  }

  try {
    const al = await findeArtikelLieferant(artikelId, lId);
    if (!al) return NextResponse.json({ error: "Lieferantenzuordnung nicht gefunden" }, { status: 404 });

    const eintrag = await prisma.artikelLieferantPreis.create({
      data: { artikelLieferantId: al.id, datum: geparstesDatum, einkaufspreis, notiz: notiz ?? null },
    });
    if (aktiv === true) {
      await setAktiverEinkaufspreis(al.id, eintrag.id);
    }
    const ergebnis = await prisma.artikelLieferantPreis.findUnique({ where: { id: eintrag.id } });
    return NextResponse.json(ergebnis, { status: 201 });
  } catch (err) {
    Sentry.captureException(err);
    console.error("Einkaufspreis-Verlauf POST error:", err);
    return NextResponse.json({ error: "Fehler beim Speichern" }, { status: 500 });
  }
}
