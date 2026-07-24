import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncArtikelStandardpreis } from "@/lib/jahrespreis";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function validiereJahr(jahr: unknown): jahr is number {
  return typeof jahr === "number" && Number.isInteger(jahr) && jahr >= 1900 && jahr <= 2100;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const artikelId = parseInt(id, 10);
  if (isNaN(artikelId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const jahrespreise = await prisma.artikelJahrespreis.findMany({
      where: { artikelId },
      orderBy: { jahr: "asc" },
    });
    return NextResponse.json(jahrespreise);
  } catch (err) {
    Sentry.captureException(err);
    console.error("Artikel-Jahrespreise GET error:", err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const artikelId = parseInt(id, 10);
  if (isNaN(artikelId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  let body;
  try {
    body = await req.json();
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const { jahr, preis, notiz } = body;
  if (!validiereJahr(jahr)) {
    return NextResponse.json({ error: "jahr ist erforderlich (1900–2100)" }, { status: 400 });
  }
  if (typeof preis !== "number" || !Number.isFinite(preis) || preis < 0) {
    return NextResponse.json({ error: "preis ist erforderlich (Zahl ≥ 0)" }, { status: 400 });
  }

  try {
    const artikel = await prisma.artikel.findUnique({ where: { id: artikelId }, select: { id: true } });
    if (!artikel) return NextResponse.json({ error: "Artikel nicht gefunden" }, { status: 404 });

    const eintrag = await prisma.artikelJahrespreis.upsert({
      where: { artikelId_jahr: { artikelId, jahr } },
      update: { preis, notiz: notiz ?? null },
      create: { artikelId, jahr, preis, notiz: notiz ?? null },
    });
    await syncArtikelStandardpreis(artikelId);
    return NextResponse.json(eintrag, { status: 201 });
  } catch (err) {
    Sentry.captureException(err);
    console.error("Artikel-Jahrespreise POST error:", err);
    return NextResponse.json({ error: "Fehler beim Speichern des Jahrespreises" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const artikelId = parseInt(id, 10);
  if (isNaN(artikelId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

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
    await prisma.artikelJahrespreis.delete({ where: { artikelId_jahr: { artikelId, jahr } } });
    await syncArtikelStandardpreis(artikelId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err);
    const code = err && typeof err === "object" && "code" in err ? (err as { code: string }).code : undefined;
    if (code === "P2025") return NextResponse.json({ error: "Jahrespreis nicht gefunden" }, { status: 404 });
    console.error("Artikel-Jahrespreise DELETE error:", err);
    return NextResponse.json({ error: "Fehler beim Löschen" }, { status: 500 });
  }
}
