import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { artikelSafeSelect, lieferungSafeSelect } from "@/lib/artikel-select";
import { Sentry } from "@/lib/sentry";
import { erstelleLieferungMitPreisberechnung } from "@/lib/lieferung";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const kundeId = searchParams.get("kundeId");
  const status = searchParams.get("status");
  const von = searchParams.get("von");
  const bis = searchParams.get("bis");
  const search = searchParams.get("search");
  const hatRechnung = searchParams.get("hatRechnung");
  const ohneRechnung = searchParams.get("ohneRechnung");
  const lieferscheinOffen = searchParams.get("lieferscheinOffen");
  const rechnungOffen = searchParams.get("rechnungOffen");
  const sort = searchParams.get("sort");
  const orderBy: Prisma.LieferungOrderByWithRelationInput[] = sort === "datum"
    ? [{ datum: "desc" }, { id: "desc" }]
    : [{ createdAt: "desc" }, { id: "desc" }];

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
  if (hatRechnung === "true") {
    where.rechnungNr = { not: null };
    // stornierte Rechnungen bleiben in der Rechnungsliste sichtbar (mit Storno-Kennzeichnung)
  }
  if (ohneRechnung === "true") where.rechnungNr = null;
  // Noch nicht per E-Mail versendete Lieferscheine/Rechnungen (für "Versand offen"-Filter)
  if (lieferscheinOffen === "true") {
    where.status = "geliefert";
    where.lieferscheinVersendetAm = null;
  }
  if (rechnungOffen === "true") {
    where.rechnungNr = { not: null };
    where.rechnungStorniert = null;
    where.rechnungVersendetAm = null;
  }
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

  const limit = Math.min(500, Math.max(1, parseInt(searchParams.get("limit") ?? "100", 10) || 100));
  const pageParam = searchParams.get("page");
  // Abwärtskompatibel: Nur wenn ?page= explizit mitgeschickt wird, liefern wir das
  // paginierte Format { data, total, page, limit, totalPages }. Ohne ?page= bleibt die
  // Response ein nacktes Array (viele Aufrufer verlassen sich darauf, siehe AGENTS.md).
  const usePagination = pageParam !== null;
  const page = usePagination ? Math.max(1, parseInt(pageParam, 10) || 1) : 1;

  const select = {
    ...lieferungSafeSelect,
    kunde: { select: { id: true, name: true, firma: true, ort: true } },
    streckenLieferant: { select: { id: true, name: true } },
    positionen: {
      select: {
        id: true, menge: true, verkaufspreis: true, einkaufspreis: true, mwstSatz: true,
        chargeNr: true, rabattProzent: true, notiz: true,
        artikel: { select: artikelSafeSelect },
      },
    },
  };

  try {
    if (usePagination) {
      const [lieferungen, total] = await Promise.all([
        prisma.lieferung.findMany({
          where,
          select,
          orderBy,
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.lieferung.count({ where }),
      ]);
      return NextResponse.json({ data: lieferungen, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) });
    }

    const lieferungen = await prisma.lieferung.findMany({
      where,
      select,
      orderBy,
      take: limit,
    });
    return NextResponse.json(lieferungen);
  } catch (e) {
    Sentry.captureException(e);
    console.error("Lieferungen GET error:", e);
    return NextResponse.json({ error: "Datenbankfehler beim Laden der Lieferungen" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body;
  try {
    body = await req.json();
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const { datum, notiz, wiederkehrend } = body;
  const quelle = typeof body.quelle === "string" && body.quelle ? body.quelle : undefined;
  const kundeId = Number(body.kundeId);
  const istStreckengeschaeft = body.istStreckengeschaeft === true;
  const streckenLieferantId = body.streckenLieferantId != null
    ? parseInt(String(body.streckenLieferantId), 10)
    : null;
  if (streckenLieferantId !== null && isNaN(streckenLieferantId)) {
    return NextResponse.json({ error: "Ungültige streckenLieferantId" }, { status: 400 });
  }
  const positionenRaw: { artikelId: unknown; menge: unknown; verkaufspreis?: unknown; rabattProzent?: unknown; einkaufspreis?: unknown; chargeNr?: unknown; notiz?: unknown }[] = body.positionen;

  if (!kundeId || isNaN(kundeId) || !Array.isArray(positionenRaw) || positionenRaw.length === 0) {
    return NextResponse.json({ error: "kundeId und mindestens eine Position erforderlich" }, { status: 400 });
  }

  // Numerische Felder robust parsen (Frontend kann Strings senden)
  const positionen: { artikelId: number; menge: number; verkaufspreis?: number; rabattProzent?: number; einkaufspreis?: number; chargeNr?: string; notiz?: string }[] = [];
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
      rabattProzent: p.rabattProzent !== undefined && p.rabattProzent !== null && p.rabattProzent !== "" ? Number(p.rabattProzent) : undefined,
      einkaufspreis: p.einkaufspreis !== undefined && p.einkaufspreis !== null && p.einkaufspreis !== "" ? Number(p.einkaufspreis) : undefined,
      chargeNr: typeof p.chargeNr === "string" && p.chargeNr ? p.chargeNr : undefined,
      notiz: typeof p.notiz === "string" && p.notiz.trim() ? p.notiz.trim() : undefined,
    });
  }

  try {
  const { lieferung, kreditlimitWarnung, offenerBetrag, kreditlimit } = await erstelleLieferungMitPreisberechnung({
    kundeId,
    datum: datum ? new Date(datum) : undefined,
    notiz,
    wiederkehrend,
    istStreckengeschaeft,
    streckenLieferantId,
    quelle,
    positionen,
  });

  const response: Record<string, unknown> = { ...lieferung };
  if (kreditlimitWarnung) {
    response.kreditlimitWarnung = true;
    response.offenerBetrag = offenerBetrag;
    response.kreditlimit = kreditlimit;
  }
  return NextResponse.json(response, { status: 201 });
  } catch (err) {
    Sentry.captureException(err);
    console.error("Lieferung POST error:", err);
    const isDev = process.env.NODE_ENV === "development";
    const message = isDev && err instanceof Error ? err.message : "Lieferung konnte nicht angelegt werden";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
