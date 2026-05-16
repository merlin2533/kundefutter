import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  berechneDuengebedarf,
  ableiteVersorgungsklasseP,
  ableiteVersorgungsklasseK,
  ableiteVersorgungsklasseMg,
  FRUCHTARTEN_DUEV,
  type BedarfEingaben,
} from "@/lib/duengebedarf";
export const dynamic = "force-dynamic";

// GET /api/duengebedarf?schlagId=X
// GET /api/duengebedarf?fruchtarten=1  (Liste verfügbarer Fruchtarten)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("fruchtarten")) {
    return NextResponse.json(FRUCHTARTEN_DUEV);
  }
  const schlagId = parseInt(searchParams.get("schlagId") ?? "", 10);
  if (isNaN(schlagId)) return NextResponse.json({ error: "schlagId fehlt" }, { status: 400 });

  try {
    const eintraege = await prisma.duengebedarf.findMany({
      where: { schlagId },
      include: { bodenprobe: true },
      orderBy: [{ jahr: "desc" }, { berechnetAm: "desc" }],
      take: 50,
    });
    return NextResponse.json(eintraege);
  } catch {
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

// POST /api/duengebedarf
// Body: { schlagId, jahr, fruchtart, ertragsZiel?, vorfrucht?, nMin?, organischeDuengungVorjahrN?, versorgungsklasseP?, versorgungsklasseK?, versorgungsklasseMg?, zwischenfruchtAngebaut?, bodenprobeId?, speichern? }
// Wenn speichern=true → wird als Duengebedarf gespeichert.
// Wenn versorgungsklasseX nicht gesetzt aber bodenprobeId vorhanden → wird aus Probe abgeleitet.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const schlagId = parseInt(String(body.schlagId), 10);
    if (isNaN(schlagId)) return NextResponse.json({ error: "schlagId erforderlich" }, { status: 400 });
    if (!body.fruchtart) return NextResponse.json({ error: "Fruchtart erforderlich" }, { status: 400 });

    const schlag = await prisma.kundeSchlag.findUnique({ where: { id: schlagId } });
    if (!schlag) return NextResponse.json({ error: "Schlag nicht gefunden" }, { status: 404 });

    let versorgP = body.versorgungsklasseP ?? null;
    let versorgK = body.versorgungsklasseK ?? null;
    let versorgMg = body.versorgungsklasseMg ?? null;
    let bodenprobeId: number | null = body.bodenprobeId ? parseInt(String(body.bodenprobeId), 10) : null;

    // Wenn keine bodenprobeId angegeben → letzte verfügbare Probe nehmen
    if (!bodenprobeId) {
      const last = await prisma.bodenprobe.findFirst({
        where: { schlagId },
        orderBy: { datum: "desc" },
      });
      if (last) bodenprobeId = last.id;
    }

    let bodenprobe: Awaited<ReturnType<typeof prisma.bodenprobe.findUnique>> = null;
    if (bodenprobeId) {
      bodenprobe = await prisma.bodenprobe.findUnique({ where: { id: bodenprobeId } });
      if (bodenprobe) {
        // Vorrang: explizit gepflegte Klasse pro Nährstoff > Ableitung aus Wert > Sammelklasse (legacy)
        if (!versorgP) versorgP = bodenprobe.klasseP ?? ableiteVersorgungsklasseP(bodenprobe.phosphor) ?? bodenprobe.klasse;
        if (!versorgK) versorgK = bodenprobe.klasseK ?? ableiteVersorgungsklasseK(bodenprobe.kalium) ?? bodenprobe.klasse;
        if (!versorgMg) versorgMg = bodenprobe.klasseMg ?? ableiteVersorgungsklasseMg(bodenprobe.magnesium) ?? bodenprobe.klasse;
      }
    }

    const eingaben: BedarfEingaben = {
      fruchtart: body.fruchtart,
      ertragsZiel: body.ertragsZiel != null ? Number(body.ertragsZiel) : null,
      vorfrucht: body.vorfrucht ?? schlag.vorfrucht ?? null,
      nMin: body.nMin != null ? Number(body.nMin) : (bodenprobe?.nMin ?? null),
      organischeDuengungVorjahrN: body.organischeDuengungVorjahrN != null ? Number(body.organischeDuengungVorjahrN) : null,
      versorgungsklasseP: versorgP,
      versorgungsklasseK: versorgK,
      versorgungsklasseMg: versorgMg,
      zwischenfruchtAngebaut: !!body.zwischenfruchtAngebaut,
    };

    let ergebnis;
    try {
      ergebnis = berechneDuengebedarf(eingaben);
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Berechnungsfehler" }, { status: 400 });
    }

    if (body.speichern) {
      const jahr = parseInt(String(body.jahr ?? new Date().getFullYear()), 10);
      const gespeichert = await prisma.duengebedarf.create({
        data: {
          schlagId,
          jahr,
          fruchtart: ergebnis.fruchtart,
          ertragsZiel: ergebnis.ertragsZiel,
          vorfrucht: eingaben.vorfrucht ?? null,
          bodenprobeId,
          nBedarf: ergebnis.nBedarf,
          pBedarf: ergebnis.pBedarf,
          kBedarf: ergebnis.kBedarf,
          mgBedarf: ergebnis.mgBedarf,
          parameter: JSON.stringify({ eingaben, rechenweg: ergebnis.rechenweg }),
          notiz: body.notiz?.trim() || null,
        },
      });
      return NextResponse.json({ ...ergebnis, gespeichert });
    }

    return NextResponse.json(ergebnis);
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/duengebedarf?id=X
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = parseInt(searchParams.get("id") ?? "", 10);
  if (isNaN(id)) return NextResponse.json({ error: "id fehlt" }, { status: 400 });
  try {
    await prisma.duengebedarf.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "P2025") return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
