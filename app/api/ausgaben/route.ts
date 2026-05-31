import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession, SESSION_COOKIE } from "@/lib/auth";
import {
  getSachkonto,
  BUCHUNGSTYPEN,
  KILOMETERPAUSCHALE_EUR,
} from "@/lib/datev";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const von = searchParams.get("von");
  const bis = searchParams.get("bis");
  const kategorie = searchParams.get("kategorie");
  const lieferantId = searchParams.get("lieferantId");
  const unbezahlt = searchParams.get("unbezahlt") === "true";
  const nurAuslagen = searchParams.get("nurAuslagen") === "true";
  const ausleger = searchParams.get("ausleger");
  const buchungstyp = searchParams.get("buchungstyp");
  const zahlungsweg = searchParams.get("zahlungsweg");

  const where: Record<string, unknown> = {};

  if (von || bis) {
    where.datum = {
      ...(von ? { gte: new Date(von) } : {}),
      ...(bis ? { lte: new Date(new Date(bis).setHours(23, 59, 59, 999)) } : {}),
    };
  }
  if (kategorie) where.kategorie = kategorie;
  if (lieferantId) {
    const id = parseInt(lieferantId, 10);
    if (!isNaN(id)) where.lieferantId = id;
  }
  if (unbezahlt) where.bezahltAm = null;
  if (nurAuslagen) where.ausleger = { not: null };
  if (ausleger) where.ausleger = ausleger;
  if (buchungstyp) where.buchungstyp = buchungstyp;
  if (zahlungsweg) where.zahlungsweg = zahlungsweg;

  try {
    const ausgaben = await prisma.ausgabe.findMany({
      where,
      include: { lieferant: { select: { id: true, name: true } } },
      orderBy: { datum: "desc" },
      take: 500,
    });
    return NextResponse.json(ausgaben);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

async function getKontenrahmen() {
  const einst = await prisma.einstellung.findUnique({ where: { key: "datev.sachkontenrahmen" } });
  return (einst?.value === "SKR04" ? "SKR04" : "SKR03") as "SKR03" | "SKR04";
}

export async function POST(req: NextRequest) {
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

    if (!beschreibung || betragNetto === undefined) {
      return NextResponse.json({ error: "Beschreibung und Betrag sind erforderlich" }, { status: 400 });
    }

    const bt = buchungstyp ?? "Betriebsausgabe";
    if (!BUCHUNGSTYPEN.includes(bt)) {
      return NextResponse.json({ error: "Ungültiger Buchungstyp" }, { status: 400 });
    }

    // Kilometerpauschale überschreibt Betrag
    const km = reiseKm ? parseFloat(reiseKm) : null;
    let betrag = parseFloat(betragNetto);
    if (bt === "Reisekosten" && reiseKilometerpauschale && km) {
      betrag = Math.round(km * KILOMETERPAUSCHALE_EUR * 100) / 100;
    }
    if (isNaN(betrag) || betrag < 0) {
      return NextResponse.json({ error: "Ungültiger Betrag" }, { status: 400 });
    }

    // Privatentnahmen/einlagen: keine MwSt
    let mwst = parseFloat(mwstSatz ?? "19");
    if (bt === "Privatentnahme" || bt === "Privateinlage") mwst = 0;
    if (isNaN(mwst) || ![0, 7, 19].includes(mwst)) {
      return NextResponse.json({ error: "Ungültiger MwSt-Satz" }, { status: 400 });
    }

    const kontenrahmen = await getKontenrahmen();
    const resolvedSachkonto = getSachkonto(
      kategorie ?? "Sonstige",
      bt,
      kontenrahmen,
      sachkonto || null
    );

    const ausgabe = await prisma.ausgabe.create({
      data: {
        datum: datum ? new Date(datum) : new Date(),
        belegNr: belegNr || null,
        beschreibung: String(beschreibung).trim(),
        betragNetto: betrag,
        mwstSatz: mwst,
        kategorie: kategorie || "Sonstige",
        lieferantId: lieferantId ? (isNaN(parseInt(lieferantId, 10)) ? null : parseInt(lieferantId, 10)) : null,
        bezahltAm: bezahltAm ? new Date(bezahltAm) : null,
        notiz: notiz || null,
        ausleger: ausleger ? String(ausleger).trim() : null,
        erfasstVon: erfasstVon ? String(erfasstVon).trim() : (session?.benutzername ?? null),
        bezahltVon: bezahltVon ? String(bezahltVon).trim() : null,
        buchungstyp: bt,
        sachkonto: resolvedSachkonto,
        kostenstelle: kostenstelle || null,
        zahlungsweg: zahlungsweg || null,
        reiseZiel: reiseZiel || null,
        reiseKm: km,
        reiseKilometerpauschale: Boolean(reiseKilometerpauschale),
        reiseZweck: reiseZweck || null,
        bewirtungTeilnehmer: bewirtungTeilnehmer || null,
        bewirtungZweck: bewirtungZweck || null,
      },
      include: { lieferant: { select: { id: true, name: true } } },
    });

    return NextResponse.json(ausgabe, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
