import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

const isDev = process.env.NODE_ENV === "development";

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = parseFloat(String(v));
  return isNaN(n) ? null : n;
}

function strOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

// GET /api/bodenanalyse?schlagId=X&kundeId=Y
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const schlagId = parseInt(searchParams.get("schlagId") ?? "", 10);
  const kundeId = parseInt(searchParams.get("kundeId") ?? "", 10);

  try {
    const where: {
      schlagId?: number;
      schlag?: { kundeId: number };
    } = {};

    if (!isNaN(schlagId)) {
      where.schlagId = schlagId;
    } else if (!isNaN(kundeId)) {
      where.schlag = { kundeId };
    }

    const analysen = await prisma.bodenanalyseAlbrecht.findMany({
      where,
      include: {
        schlag: {
          select: {
            id: true,
            name: true,
            kundeId: true,
            kunde: { select: { name: true } },
          },
        },
      },
      orderBy: { datum: "desc" },
      take: 500,
    });

    return NextResponse.json(analysen);
  } catch (err) {
    const msg = isDev && err instanceof Error ? err.message : "Datenbankfehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/bodenanalyse
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const schlagId = parseInt(String(body.schlagId ?? ""), 10);
    if (isNaN(schlagId)) {
      return NextResponse.json({ error: "schlagId fehlt oder ungültig" }, { status: 400 });
    }
    if (!body.datum) {
      return NextResponse.json({ error: "Datum fehlt" }, { status: 400 });
    }

    const schlag = await prisma.kundeSchlag.findUnique({ where: { id: schlagId } });
    if (!schlag) {
      return NextResponse.json({ error: "Schlag nicht gefunden" }, { status: 404 });
    }

    const analyse = await prisma.bodenanalyseAlbrecht.create({
      data: {
        schlagId,
        datum: new Date(String(body.datum)),
        probenId: strOrNull(body.probenId),
        kultur: strOrNull(body.kultur),
        tiefe: strOrNull(body.tiefe),
        bodenart: strOrNull(body.bodenart),

        // Basisdaten
        phH2O: numOrNull(body.phH2O),
        phKCl: numOrNull(body.phKCl),
        kak: numOrNull(body.kak),
        humus: numOrNull(body.humus),
        nGesamt: numOrNull(body.nGesamt),
        cn: numOrNull(body.cn),
        nNachlieferung: numOrNull(body.nNachlieferung),
        caCo3: numOrNull(body.caCo3),
        leitfaehigkeit: numOrNull(body.leitfaehigkeit),

        // Kationen-Sättigung %
        caSaettigung: numOrNull(body.caSaettigung),
        mgSaettigung: numOrNull(body.mgSaettigung),
        kSaettigung: numOrNull(body.kSaettigung),
        naSaettigung: numOrNull(body.naSaettigung),
        hSaettigung: numOrNull(body.hSaettigung),
        variabelSaett: numOrNull(body.variabelSaett),

        // Kationen-Vorräte kg/ha
        caVorrat: numOrNull(body.caVorrat),
        mgVorrat: numOrNull(body.mgVorrat),
        kVorrat: numOrNull(body.kVorrat),
        naVorrat: numOrNull(body.naVorrat),

        // Anionen + Phosphor
        schwefel: numOrNull(body.schwefel),
        p2o5Verfuegbar: numOrNull(body.p2o5Verfuegbar),
        p2o5Vorrat: numOrNull(body.p2o5Vorrat),

        // Spurenelemente
        bor: numOrNull(body.bor),
        eisen: numOrNull(body.eisen),
        mangan: numOrNull(body.mangan),
        kupfer: numOrNull(body.kupfer),
        zink: numOrNull(body.zink),
        chlorid: numOrNull(body.chlorid),
        silizium: numOrNull(body.silizium),
        kobalt: numOrNull(body.kobalt),
        molybdaen: numOrNull(body.molybdaen),
        selen: numOrNull(body.selen),

        // Empfehlungen
        empfehlungenJson: (() => {
          if (!body.empfehlungen) return null;
          try { return JSON.stringify(body.empfehlungen); } catch { return null; }
        })(),

        notiz: strOrNull(body.notiz),
        belegPfad: strOrNull(body.belegPfad),
        belegName: strOrNull(body.belegName),
      },
    });

    return NextResponse.json(analyse, { status: 201 });
  } catch (err) {
    const msg = isDev && err instanceof Error ? err.message : "Speichern fehlgeschlagen";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/bodenanalyse?id=X
export async function DELETE(req: NextRequest) {
  const id = parseInt(new URL(req.url).searchParams.get("id") ?? "", 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "id fehlt" }, { status: 400 });
  }

  try {
    await prisma.bodenanalyseAlbrecht.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "P2025") {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }
    const msg = isDev && err instanceof Error ? err.message : "Löschfehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
