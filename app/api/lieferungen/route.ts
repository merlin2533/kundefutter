import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { berechneVerkaufspreis } from "@/lib/utils";
import { artikelSafeSelect } from "@/lib/artikel-select";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const kundeId = searchParams.get("kundeId");
  const status = searchParams.get("status");
  const von = searchParams.get("von");
  const bis = searchParams.get("bis");
  const search = searchParams.get("search");
  const hatRechnung = searchParams.get("hatRechnung");
  const ohneRechnung = searchParams.get("ohneRechnung");

  const GUELTIGE_STATUS = ["geplant", "geliefert", "storniert"];
  if (status && !GUELTIGE_STATUS.includes(status)) {
    return NextResponse.json({ error: "Ungültiger Status" }, { status: 400 });
  }

  const where: Record<string, unknown> = {};
  if (kundeId) {
    const kid = parseInt(kundeId, 10);
    if (isNaN(kid)) return NextResponse.json({ error: "Ungültige kundeId" }, { status: 400 });
    where.kundeId = kid;
  }
  if (status) where.status = status;
  if (hatRechnung === "true") where.rechnungNr = { not: null };
  if (ohneRechnung === "true") where.rechnungNr = null;
  if (search) {
    // Suche auf eine sinnvolle Länge begrenzen (verhindert pathologische LIKE-Queries)
    const cleanSearch = search.slice(0, 80);
    where.kunde = {
      OR: [
        { name: { contains: cleanSearch } },
        { firma: { contains: cleanSearch } },
      ],
    };
  }
  if (von || bis) {
    const datum: Record<string, Date> = {};
    if (von) {
      const d = new Date(von);
      if (!isNaN(d.getTime())) datum.gte = d;
    }
    if (bis) {
      const d = new Date(bis);
      if (!isNaN(d.getTime())) datum.lte = d;
    }
    if (Object.keys(datum).length > 0) where.datum = datum;
  }

  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") ?? "100", 10) || 100));
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);

  try {
    const lieferungen = await prisma.lieferung.findMany({
      where,
      include: {
        kunde: true,
        positionen: { include: { artikel: { select: artikelSafeSelect } } },
      },
      orderBy: { datum: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });
    return NextResponse.json(lieferungen);
  } catch (e) {
    console.error("Lieferungen GET error:", e);
    return NextResponse.json({ error: "Datenbankfehler beim Laden der Lieferungen" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const { datum, notiz, wiederkehrend } = body;
  const kundeId = Number(body.kundeId);
  const positionenRaw: { artikelId: unknown; menge: unknown; verkaufspreis?: unknown; einkaufspreis?: unknown; chargeNr?: unknown }[] = body.positionen;

  if (!kundeId || isNaN(kundeId) || !Array.isArray(positionenRaw) || positionenRaw.length === 0) {
    return NextResponse.json({ error: "kundeId und mindestens eine Position erforderlich" }, { status: 400 });
  }

  // Numerische Felder robust parsen (Frontend kann Strings senden)
  const positionen: { artikelId: number; menge: number; verkaufspreis?: number; einkaufspreis?: number; chargeNr?: string }[] = [];
  for (const p of positionenRaw) {
    const artikelId = Number(p.artikelId);
    const menge = Number(p.menge);
    if (!artikelId || isNaN(artikelId)) {
      return NextResponse.json({ error: "Ungültige artikelId in Position" }, { status: 400 });
    }
    if (isNaN(menge) || menge <= 0) {
      return NextResponse.json({ error: "Menge muss > 0 sein" }, { status: 400 });
    }
    positionen.push({
      artikelId,
      menge,
      verkaufspreis: p.verkaufspreis !== undefined && p.verkaufspreis !== null && p.verkaufspreis !== "" ? Number(p.verkaufspreis) : undefined,
      einkaufspreis: p.einkaufspreis !== undefined && p.einkaufspreis !== null && p.einkaufspreis !== "" ? Number(p.einkaufspreis) : undefined,
      chargeNr: typeof p.chargeNr === "string" && p.chargeNr ? p.chargeNr : undefined,
    });
  }

  try {
  const lieferung = await prisma.$transaction(async (tx) => {
    // Batch-load all needed data upfront to avoid N+1 queries
    const artikelIds = positionen.map((p) => p.artikelId);

    const [alleArtikel, alleKundePreise, alleBevorzugteLieferanten, alleMengenrabatte] = await Promise.all([
      tx.artikel.findMany({ where: { id: { in: artikelIds } }, select: { id: true, name: true, kategorie: true, standardpreis: true, einheit: true, mwstSatz: true, aktuellerBestand: true, mindestbestand: true } }),
      tx.kundeArtikelPreis.findMany({ where: { kundeId, artikelId: { in: artikelIds } } }),
      tx.artikelLieferant.findMany({ where: { artikelId: { in: artikelIds }, bevorzugt: true } }),
      tx.mengenrabatt.findMany({
        where: {
          aktiv: true,
          OR: [{ kundeId }, { kundeId: null }],
        },
      }),
    ]);

    const artikelMap = new Map(alleArtikel.map((a) => [a.id, a]));
    const kundePreisMap = new Map(alleKundePreise.map((kp) => [kp.artikelId, kp]));
    const bevorzugterLieferantMap = new Map(alleBevorzugteLieferanten.map((al) => [al.artikelId, al]));

    // Verkaufspreise + Einkaufspreise automatisch befüllen falls nicht übergeben
    const angereichert = positionen.map((pos) => {
      const artikel = artikelMap.get(pos.artikelId);
      if (!artikel) throw new Error(`Artikel mit ID ${pos.artikelId} nicht gefunden`);
      const kundePreis = kundePreisMap.get(pos.artikelId) ?? null;
      const bevorzugterLieferant = bevorzugterLieferantMap.get(pos.artikelId);

      const basisVerkaufspreis = pos.verkaufspreis ?? berechneVerkaufspreis(artikel, kundePreis);

      // Mengenrabatt: filter in JS (vonMenge per position, then artikel/kategorie match)
      const passende = alleMengenrabatte.filter((r) => {
        if (r.vonMenge > pos.menge) return false;
        if (r.artikelId !== null) return r.artikelId === pos.artikelId;
        if (r.kategorie !== null) return r.kategorie === artikel.kategorie;
        return false;
      });

      // Wähle den höchsten Rabatt
      let bestRabatt = 0;
      for (const r of passende) {
        if (r.rabattProzent > bestRabatt) bestRabatt = r.rabattProzent;
      }

      const rabattVerkaufspreis = bestRabatt > 0
        ? Math.round(basisVerkaufspreis * (1 - bestRabatt / 100) * 100) / 100
        : basisVerkaufspreis;

      return {
        artikelId: pos.artikelId,
        menge: pos.menge,
        verkaufspreis: rabattVerkaufspreis,
        einkaufspreis: pos.einkaufspreis ?? bevorzugterLieferant?.einkaufspreis ?? 0,
        chargeNr: pos.chargeNr ?? null,
        rabattProzent: bestRabatt,
      };
    });

    return tx.lieferung.create({
      data: {
        kundeId,
        datum: datum ? new Date(datum) : new Date(),
        notiz,
        wiederkehrend: wiederkehrend ?? false,
        positionen: { create: angereichert },
      },
      include: {
        kunde: true,
        positionen: { include: { artikel: { select: artikelSafeSelect } } },
      },
    });
  });
  return NextResponse.json(lieferung, { status: 201 });
  } catch (err) {
    console.error("Lieferung POST error:", err);
    const isDev = process.env.NODE_ENV === "development";
    const message = isDev && err instanceof Error ? err.message : "Lieferung konnte nicht angelegt werden";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
