import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncKundePreis } from "@/lib/jahrespreis";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function validiereJahr(jahr: unknown): jahr is number {
  return typeof jahr === "number" && Number.isInteger(jahr) && jahr >= 1900 && jahr <= 2100;
}

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const kundeId = parseInt(id, 10);
  const artikelId = parseInt(req.nextUrl.searchParams.get("artikelId") ?? "", 10);
  if (isNaN(kundeId) || isNaN(artikelId)) {
    return NextResponse.json({ error: "kundeId und artikelId sind erforderlich" }, { status: 400 });
  }

  try {
    const kap = await prisma.kundeArtikelPreis.findUnique({
      where: { kundeId_artikelId: { kundeId, artikelId } },
      select: { id: true },
    });
    if (!kap) return NextResponse.json([]);

    const jahrespreise = await prisma.kundeArtikelPreisJahr.findMany({
      where: { kundeArtikelPreisId: kap.id },
      orderBy: { jahr: "asc" },
    });
    return NextResponse.json(jahrespreise);
  } catch (err) {
    Sentry.captureException(err);
    console.error("KundeArtikelPreis-Jahrespreise GET error:", err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const kundeId = parseInt(id, 10);
  if (isNaN(kundeId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  let body;
  try {
    body = await req.json();
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const { artikelId, jahr, preis, rabatt, notiz } = body;
  if (!artikelId || typeof artikelId !== "number") {
    return NextResponse.json({ error: "artikelId ist erforderlich" }, { status: 400 });
  }
  if (!validiereJahr(jahr)) {
    return NextResponse.json({ error: "jahr ist erforderlich (1900–2100)" }, { status: 400 });
  }
  if (typeof preis !== "number" || !Number.isFinite(preis) || preis < 0) {
    return NextResponse.json({ error: "preis ist erforderlich (Zahl ≥ 0)" }, { status: 400 });
  }

  try {
    const artikel = await prisma.artikel.findUnique({ where: { id: artikelId }, select: { id: true } });
    if (!artikel) return NextResponse.json({ error: "Artikel nicht gefunden" }, { status: 404 });

    // Basiszeile anlegen, falls noch kein Sonderpreis für diesen Kunden+Artikel existiert
    const kap = await prisma.kundeArtikelPreis.upsert({
      where: { kundeId_artikelId: { kundeId, artikelId } },
      update: {},
      create: { kundeId, artikelId, preis, rabatt: rabatt ?? 0 },
    });

    const eintrag = await prisma.kundeArtikelPreisJahr.upsert({
      where: { kundeArtikelPreisId_jahr: { kundeArtikelPreisId: kap.id, jahr } },
      update: { preis, rabatt: rabatt ?? 0, notiz: notiz ?? null },
      create: { kundeArtikelPreisId: kap.id, jahr, preis, rabatt: rabatt ?? 0, notiz: notiz ?? null },
    });
    await syncKundePreis(kap.id);
    return NextResponse.json(eintrag, { status: 201 });
  } catch (err) {
    Sentry.captureException(err);
    console.error("KundeArtikelPreis-Jahrespreise POST error:", err);
    return NextResponse.json({ error: "Fehler beim Speichern des Jahrespreises" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const kundeId = parseInt(id, 10);
  if (isNaN(kundeId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  let body;
  try {
    body = await req.json();
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const { artikelId, jahr } = body;
  if (!artikelId || typeof artikelId !== "number" || !validiereJahr(jahr)) {
    return NextResponse.json({ error: "artikelId und jahr sind erforderlich" }, { status: 400 });
  }

  try {
    const kap = await prisma.kundeArtikelPreis.findUnique({
      where: { kundeId_artikelId: { kundeId, artikelId } },
      select: { id: true },
    });
    if (!kap) return NextResponse.json({ error: "Sonderpreis nicht gefunden" }, { status: 404 });

    await prisma.kundeArtikelPreisJahr.delete({
      where: { kundeArtikelPreisId_jahr: { kundeArtikelPreisId: kap.id, jahr } },
    });
    await syncKundePreis(kap.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err);
    const code = err && typeof err === "object" && "code" in err ? (err as { code: string }).code : undefined;
    if (code === "P2025") return NextResponse.json({ error: "Jahrespreis nicht gefunden" }, { status: 404 });
    console.error("KundeArtikelPreis-Jahrespreise DELETE error:", err);
    return NextResponse.json({ error: "Fehler beim Löschen" }, { status: 500 });
  }
}
