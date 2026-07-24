import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncEinkaufspreis } from "@/lib/jahrespreis";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; lieferantId: string }> };

function validiereJahr(jahr: unknown): jahr is number {
  return typeof jahr === "number" && Number.isInteger(jahr) && jahr >= 1900 && jahr <= 2100;
}

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

    const jahrespreise = await prisma.artikelLieferantJahrespreis.findMany({
      where: { artikelLieferantId: al.id },
      orderBy: { jahr: "asc" },
    });
    return NextResponse.json(jahrespreise);
  } catch (err) {
    Sentry.captureException(err);
    console.error("ArtikelLieferant-Jahrespreise GET error:", err);
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

  const { jahr, einkaufspreis, notiz } = body;
  if (!validiereJahr(jahr)) {
    return NextResponse.json({ error: "jahr ist erforderlich (1900–2100)" }, { status: 400 });
  }
  if (typeof einkaufspreis !== "number" || !Number.isFinite(einkaufspreis) || einkaufspreis < 0) {
    return NextResponse.json({ error: "einkaufspreis ist erforderlich (Zahl ≥ 0)" }, { status: 400 });
  }

  try {
    const al = await findeArtikelLieferant(artikelId, lId);
    if (!al) return NextResponse.json({ error: "Lieferantenzuordnung nicht gefunden" }, { status: 404 });

    const eintrag = await prisma.artikelLieferantJahrespreis.upsert({
      where: { artikelLieferantId_jahr: { artikelLieferantId: al.id, jahr } },
      update: { einkaufspreis, notiz: notiz ?? null },
      create: { artikelLieferantId: al.id, jahr, einkaufspreis, notiz: notiz ?? null },
    });
    await syncEinkaufspreis(al.id);
    return NextResponse.json(eintrag, { status: 201 });
  } catch (err) {
    Sentry.captureException(err);
    console.error("ArtikelLieferant-Jahrespreise POST error:", err);
    return NextResponse.json({ error: "Fehler beim Speichern des Jahrespreises" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: Params) {
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

  const { jahr } = body;
  if (!validiereJahr(jahr)) {
    return NextResponse.json({ error: "jahr ist erforderlich" }, { status: 400 });
  }

  try {
    const al = await findeArtikelLieferant(artikelId, lId);
    if (!al) return NextResponse.json({ error: "Lieferantenzuordnung nicht gefunden" }, { status: 404 });

    await prisma.artikelLieferantJahrespreis.delete({
      where: { artikelLieferantId_jahr: { artikelLieferantId: al.id, jahr } },
    });
    await syncEinkaufspreis(al.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err);
    const code = err && typeof err === "object" && "code" in err ? (err as { code: string }).code : undefined;
    if (code === "P2025") return NextResponse.json({ error: "Jahrespreis nicht gefunden" }, { status: 404 });
    console.error("ArtikelLieferant-Jahrespreise DELETE error:", err);
    return NextResponse.json({ error: "Fehler beim Löschen" }, { status: 500 });
  }
}
