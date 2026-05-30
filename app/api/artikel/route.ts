import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { artikelSafeSelect } from "@/lib/artikel-select";
export const dynamic = "force-dynamic";


export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const kategorie = searchParams.get("kategorie");
  const unterkategorie = searchParams.get("unterkategorie");
  const search = searchParams.get("search");
  const aktiv = searchParams.get("aktiv");

  const lieferantId = searchParams.get("lieferantId");
  const preisVon = searchParams.get("preisVon");
  const preisBis = searchParams.get("preisBis");
  const nurSprengstoff = searchParams.get("sprengstoffvorlaeufer");

  const where: Record<string, unknown> = {};
  if (kategorie) where.kategorie = kategorie;
  if (unterkategorie) where.unterkategorie = unterkategorie;
  // Standardmäßig nur aktive Artikel anzeigen; explizit ?aktiv=false für inaktive, ?aktiv=alle für alle
  if (aktiv === null) where.aktiv = true;
  else if (aktiv !== "alle") where.aktiv = aktiv === "true";
  if (lieferantId) {
    const lid = parseInt(lieferantId, 10);
    if (!isNaN(lid)) where.lieferanten = { some: { lieferantId: lid } };
  }
  if (preisVon || preisBis) {
    const preis: Record<string, number> = {};
    if (preisVon) { const v = parseFloat(preisVon); if (!isNaN(v)) preis.gte = v; }
    if (preisBis) { const v = parseFloat(preisBis); if (!isNaN(v)) preis.lte = v; }
    if (Object.keys(preis).length > 0) where.standardpreis = preis;
  }
  if (nurSprengstoff === "1") where.sprengstoffvorlaeufer = true;
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { artikelnummer: { contains: search } },
      { inhaltsstoffe: { some: { name: { contains: search } } } },
    ];
  }

  // Paginierung + optionale Relations (spart Joins bei Listenansichten)
  const limit = Math.min(500, Math.max(1, parseInt(searchParams.get("limit") ?? "200", 10) || 200));
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const withRelations = searchParams.get("relations") !== "false";

  const select = withRelations
    ? {
        ...artikelSafeSelect,
        inhaltsstoffe: true as const,
        lieferanten: { include: { lieferant: true } },
        dokumente: true as const,
      }
    : artikelSafeSelect;

  try {
    const [artikel, total] = await Promise.all([
      prisma.artikel.findMany({
        where,
        select,
        orderBy: { name: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.artikel.count({ where }),
    ]);
    return NextResponse.json(artikel, {
      headers: { "X-Total-Count": String(total) },
    });
  } catch (e) {
    console.error("Artikel GET error:", e);
    const isDev = process.env.NODE_ENV === "development";
    const raw = e instanceof Error ? e.message : "";
    const isMissingColumn = /no such column|column .* does not exist/i.test(raw);
    return NextResponse.json(
      {
        error: isMissingColumn
          ? "Schema-Fehler: fehlende DB-Spalte. /api/db-check für Details, dann Container neu starten (pre-migrate.js wendet fehlende Migrationen an)."
          : "Datenbankfehler beim Laden der Artikel",
        detail: isDev ? raw : undefined,
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const { lieferanten, inhaltsstoffe, ...data } = body;

  if (!data.name || typeof data.name !== "string" || !data.name.trim()) {
    return NextResponse.json({ error: "Name ist erforderlich" }, { status: 400 });
  }

  try {
    if (data.mwstSatz !== undefined) data.mwstSatz = Number(data.mwstSatz);
    else data.mwstSatz = 19;
    if (data.chargePflicht !== undefined) data.chargePflicht = Boolean(data.chargePflicht);
    else data.chargePflicht = false;
    if (data.sprengstoffvorlaeufer !== undefined) data.sprengstoffvorlaeufer = Boolean(data.sprengstoffvorlaeufer);
    else data.sprengstoffvorlaeufer = false;
    if (data.lagerTracking !== undefined) data.lagerTracking = Boolean(data.lagerTracking);
    else data.lagerTracking = true;

    // Nummer-Vergabe und Create in einer Transaktion, damit parallele POSTs
    // keine doppelten Artikelnummern erzeugen.
    const artikel = await prisma.$transaction(async (tx) => {
      if (!data.artikelnummer) {
        const nummernkreisRaw = await tx.einstellung.findUnique({ where: { key: "artikel.nummernkreis" } });
        const nk = nummernkreisRaw?.value
          ? (() => { try { return JSON.parse(nummernkreisRaw.value); } catch { return null; } })()
          : null;
        const prefix = nk?.prefix ?? "ART-";
        const laenge = Number(nk?.laenge) || 5;
        const naechste = Number(nk?.naechste) || 1;
        data.artikelnummer = `${prefix}${String(naechste).padStart(laenge, "0")}`;
        await tx.einstellung.upsert({
          where: { key: "artikel.nummernkreis" },
          update: { value: JSON.stringify({ prefix, laenge, naechste: naechste + 1 }) },
          create: { key: "artikel.nummernkreis", value: JSON.stringify({ prefix, laenge, naechste: naechste + 1 }) },
        });
      }

      return tx.artikel.create({
        data: {
          ...data,
          lieferanten: lieferanten?.length
            ? { create: lieferanten }
            : undefined,
          inhaltsstoffe: inhaltsstoffe?.length
            ? { create: (inhaltsstoffe as { name: string; menge?: number | null; einheit?: string | null }[]).map((i) => ({
                name: i.name,
                menge: i.menge ?? null,
                einheit: i.einheit ?? null,
              })) }
            : undefined,
        },
        select: {
          ...artikelSafeSelect,
          inhaltsstoffe: true,
          lieferanten: { include: { lieferant: true } },
          dokumente: true,
        },
      });
    });
    return NextResponse.json(artikel, { status: 201 });
  } catch (err) {
    console.error("Artikel POST error:", err);
    const isDev = process.env.NODE_ENV === "development";
    const message = isDev && err instanceof Error ? err.message : "Artikel konnte nicht angelegt werden";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
