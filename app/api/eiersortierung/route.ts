import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getModulConfig, requireModul } from "@/lib/modul-config";
import { liefposArtikelSelect } from "@/lib/artikel-select";
import { GUETEKLASSEN, GEWICHTSKLASSEN } from "@/lib/auswahllisten";
import { istLagerrelevant } from "@/lib/utils";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";

const GUETEKLASSEN_KEYS = new Set<string>(GUETEKLASSEN.map((g) => g.key));
const GEWICHTSKLASSEN_KEYS = new Set<string>(GEWICHTSKLASSEN.map((g) => g.key));

// GET /api/eiersortierung
export async function GET() {
  try {
    const modul = await getModulConfig();
    const denyModul = requireModul(modul, "eierhandel");
    if (denyModul) return denyModul;

    const liste = await prisma.eierSortierung.findMany({
      include: {
        anlieferung: { select: { id: true, nummer: true, kunde: { select: { id: true, name: true, firma: true } } } },
        positionen: { include: { artikel: { select: liefposArtikelSelect } } },
      },
      orderBy: { datum: "desc" },
      take: 200,
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

    const positionen = (body.positionen as {
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

    for (const p of positionen) {
      if (!Number.isInteger(p.artikelId) || p.artikelId <= 0 || !Number.isFinite(p.menge) || p.menge <= 0) {
        return NextResponse.json({ error: "Ungültige Position (artikelId/menge)" }, { status: 400 });
      }
      if (!GUETEKLASSEN_KEYS.has(p.gueteklasse)) {
        return NextResponse.json({ error: `Ungültige Güteklasse „${p.gueteklasse}“ (erlaubt: A, B)` }, { status: 400 });
      }
      if (!GEWICHTSKLASSEN_KEYS.has(p.gewichtsklasse)) {
        return NextResponse.json({ error: `Ungültige Gewichtsklasse „${p.gewichtsklasse}“ (erlaubt: S, M, L, XL)` }, { status: 400 });
      }
      if (p.legedatum && isNaN(p.legedatum.getTime())) {
        return NextResponse.json({ error: "Ungültiges Legedatum" }, { status: 400 });
      }
    }

    const sortierung = await prisma.$transaction(async (tx) => {
      const s = await tx.eierSortierung.create({
        data: {
          datum,
          anlieferungId,
          notiz: typeof body.notiz === "string" && body.notiz.trim() ? body.notiz.trim() : null,
          erstelltVon: typeof body.erstelltVon === "string" && body.erstelltVon.trim() ? body.erstelltVon.trim() : null,
          positionen: { create: positionen },
        },
        include: { positionen: { include: { artikel: { select: liefposArtikelSelect } } } },
      });

      const artikelIds = [...new Set(s.positionen.map((p) => p.artikelId))];
      const artikelList = await tx.artikel.findMany({ where: { id: { in: artikelIds } } });
      const artikelMap = new Map(artikelList.map((a) => [a.id, a]));

      for (const pos of s.positionen) {
        const artikel = artikelMap.get(pos.artikelId);
        if (!artikel || !istLagerrelevant(artikel.kategorie, artikel.lagerTracking)) continue;
        const neuerBestand = artikel.aktuellerBestand + pos.menge;
        artikel.aktuellerBestand = neuerBestand;
        await tx.artikel.update({ where: { id: pos.artikelId }, data: { aktuellerBestand: neuerBestand } });
        await tx.lagerbewegung.create({
          data: {
            artikelId: pos.artikelId,
            typ: "eingang",
            menge: pos.menge,
            bestandNach: neuerBestand,
            chargeNr: pos.chargeNr,
            notiz: `Ei-Sortierung #${s.id} · Güte ${pos.gueteklasse}/${pos.gewichtsklasse}${pos.chargeNr ? ` · Charge ${pos.chargeNr}` : ""}`,
          },
        });
      }

      return s;
    });

    return NextResponse.json(sortierung, { status: 201 });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Fehler beim Speichern der Ei-Sortierung" }, { status: 500 });
  }
}
