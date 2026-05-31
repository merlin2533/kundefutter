import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession, SESSION_COOKIE } from "@/lib/auth";
import {
  getSachkonto,
  BUCHUNGSTYPEN,
  KILOMETERPAUSCHALE_EUR,
} from "@/lib/datev";

export const dynamic = "force-dynamic";

async function getKontenrahmen() {
  const einst = await prisma.einstellung.findUnique({ where: { key: "datev.sachkontenrahmen" } });
  return (einst?.value === "SKR04" ? "SKR04" : "SKR03") as "SKR03" | "SKR04";
}

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
    const {
      datum, belegNr, beschreibung, betragNetto, mwstSatz, kategorie,
      lieferantId, bezahltAm, notiz, ausleger, erfasstVon, bezahltVon,
      buchungstyp, sachkonto, kostenstelle, zahlungsweg,
      reiseZiel, reiseKm, reiseKilometerpauschale, reiseZweck,
      bewirtungTeilnehmer, bewirtungZweck,
    } = body;

    if (buchungstyp !== undefined && !BUCHUNGSTYPEN.includes(buchungstyp)) {
      return NextResponse.json({ error: "Ungültiger Buchungstyp" }, { status: 400 });
    }

    const bt: string | undefined = buchungstyp;
    const isPrivat = bt === "Privatentnahme" || bt === "Privateinlage";

    // Kilometerpauschale: betrag auto-kalkulieren
    const km = reiseKm !== undefined ? (reiseKm ? parseFloat(reiseKm) : null) : undefined;
    let resolvedBetrag: number | undefined;
    if (betragNetto !== undefined) {
      resolvedBetrag = parseFloat(betragNetto);
      if (isNaN(resolvedBetrag) || resolvedBetrag < 0)
        return NextResponse.json({ error: "Ungültiger Betrag" }, { status: 400 });
    }
    if (bt === "Reisekosten" && reiseKilometerpauschale && km) {
      resolvedBetrag = Math.round(km * KILOMETERPAUSCHALE_EUR * 100) / 100;
    }
    if (mwstSatz !== undefined && !isPrivat && ![0, 7, 19].includes(parseFloat(mwstSatz))) {
      return NextResponse.json({ error: "Ungültiger MwSt-Satz" }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (datum !== undefined) data.datum = new Date(datum);
    if (belegNr !== undefined) data.belegNr = belegNr || null;
    if (beschreibung !== undefined) data.beschreibung = String(beschreibung).trim();
    if (resolvedBetrag !== undefined) data.betragNetto = resolvedBetrag;
    if (mwstSatz !== undefined) data.mwstSatz = isPrivat ? 0 : parseFloat(mwstSatz);
    if (isPrivat) data.mwstSatz = 0;
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
    // Neue DATEV-Felder
    if (bt !== undefined) data.buchungstyp = bt;
    if (kostenstelle !== undefined) data.kostenstelle = kostenstelle || null;
    if (zahlungsweg !== undefined) data.zahlungsweg = zahlungsweg || null;
    if (reiseZiel !== undefined) data.reiseZiel = reiseZiel || null;
    if (km !== undefined) data.reiseKm = km;
    if (reiseKilometerpauschale !== undefined) data.reiseKilometerpauschale = Boolean(reiseKilometerpauschale);
    if (reiseZweck !== undefined) data.reiseZweck = reiseZweck || null;
    if (bewirtungTeilnehmer !== undefined) data.bewirtungTeilnehmer = bewirtungTeilnehmer || null;
    if (bewirtungZweck !== undefined) data.bewirtungZweck = bewirtungZweck || null;

    // Sachkonto: explizit gesetzt oder neu ableiten wenn Kategorie/Typ geändert
    if (sachkonto !== undefined) {
      data.sachkonto = sachkonto || null;
    } else if (kategorie !== undefined || bt !== undefined) {
      // Bestehenden Datensatz laden für aktuelle Werte
      const existing = await prisma.ausgabe.findUnique({ where: { id }, select: { kategorie: true, buchungstyp: true } });
      if (existing) {
        const kontenrahmen = await getKontenrahmen();
        data.sachkonto = getSachkonto(
          kategorie ?? existing.kategorie,
          bt ?? existing.buchungstyp,
          kontenrahmen,
          null
        );
      }
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
