import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getModulConfig, requireModul } from "@/lib/modul-config";
import { liefposArtikelSelect } from "@/lib/artikel-select";
import { getCurrentUser } from "@/lib/auth";
import { Sentry } from "@/lib/sentry";
import {
  EierSortierungValidierungsFehler,
  validiereEierSortierungPositionen,
  validiereAnlieferungFuerSortierung,
  erstelleEierSortierung,
  type EierSortierungPositionInput,
} from "@/lib/eiersortierung";
export const dynamic = "force-dynamic";

// GET /api/eiersortierung(?anlieferungId=)
export async function GET(req: NextRequest) {
  try {
    const modul = await getModulConfig();
    const denyModul = requireModul(modul, "eierhandel");
    if (denyModul) return denyModul;

    const { searchParams } = new URL(req.url);
    const anlieferungIdStr = searchParams.get("anlieferungId");
    const where: Record<string, unknown> = {};
    if (anlieferungIdStr) {
      const anlieferungId = parseInt(anlieferungIdStr, 10);
      if (!isNaN(anlieferungId)) where.anlieferungId = anlieferungId;
    }

    const liste = await prisma.eierSortierung.findMany({
      where,
      include: {
        anlieferung: { select: { id: true, nummer: true, kunde: { select: { id: true, name: true, firma: true } } } },
        positionen: { include: { artikel: { select: liefposArtikelSelect } } },
      },
      orderBy: { datum: "desc" },
      take: 5000,
    });
    return NextResponse.json(liste);
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

// POST /api/eiersortierung — Eine Anlieferung/Erzeugung wird in klassifizierte Ausgangschargen
// aufgeteilt (EU-Vermarktungsnorm). Jede Position bucht Lagerbewegung "eingang" — analog zu einem
// Wareneingang, nur mit Güte-/Gewichtsklasse statt reiner Mengenerfassung.
export async function POST(req: NextRequest) {
  try {
    const modul = await getModulConfig();
    const denyModul = requireModul(modul, "eierhandel");
    if (denyModul) return denyModul;

    let body;
    try {
      body = await req.json();
    } catch (err) {
      Sentry.captureException(err);
      return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
    }

    if (!Array.isArray(body.positionen) || body.positionen.length === 0) {
      return NextResponse.json({ error: "positionen erforderlich" }, { status: 400 });
    }

    const anlieferungId = body.anlieferungId ? parseInt(String(body.anlieferungId), 10) : null;
    if (body.anlieferungId && (anlieferungId === null || isNaN(anlieferungId))) {
      return NextResponse.json({ error: "Ungültige anlieferungId" }, { status: 400 });
    }

    let datum = new Date();
    if (body.datum) {
      datum = new Date(body.datum);
      if (isNaN(datum.getTime())) return NextResponse.json({ error: "Ungültiges Datum" }, { status: 400 });
    }

    const positionen: EierSortierungPositionInput[] = (body.positionen as {
      artikelId: unknown;
      gueteklasse: unknown;
      gewichtsklasse: unknown;
      menge: unknown;
      chargeNr?: unknown;
      legedatum?: unknown;
      erzeugercode?: unknown;
    }[]).map((p) => ({
      artikelId: Number(p.artikelId),
      gueteklasse: typeof p.gueteklasse === "string" ? p.gueteklasse.trim().toUpperCase() : "",
      gewichtsklasse: typeof p.gewichtsklasse === "string" ? p.gewichtsklasse.trim().toUpperCase() : "",
      menge: Number(p.menge),
      chargeNr: typeof p.chargeNr === "string" && p.chargeNr.trim() ? p.chargeNr.trim() : null,
      legedatum: typeof p.legedatum === "string" && p.legedatum.trim() ? new Date(p.legedatum) : null,
      erzeugercode: typeof p.erzeugercode === "string" && p.erzeugercode.trim() ? p.erzeugercode.trim() : null,
    }));

    try {
      validiereEierSortierungPositionen(positionen);
    } catch (err) {
      if (err instanceof EierSortierungValidierungsFehler) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }

    const me = await getCurrentUser();

    const sortierung = await prisma.$transaction(async (tx) => {
      if (anlieferungId !== null) {
        await validiereAnlieferungFuerSortierung(tx, anlieferungId);
      }
      return erstelleEierSortierung(tx, {
        datum,
        anlieferungId,
        notiz: typeof body.notiz === "string" && body.notiz.trim() ? body.notiz.trim() : null,
        erstelltVon: me?.benutzername ?? null,
        positionen,
      });
    });

    return NextResponse.json(sortierung, { status: 201 });
  } catch (err) {
    if (err instanceof EierSortierungValidierungsFehler) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    Sentry.captureException(err);
    return NextResponse.json({ error: "Fehler beim Speichern der Ei-Sortierung" }, { status: 500 });
  }
}
