import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { liefposArtikelSelect } from "@/lib/artikel-select";
import { rundeKaufmaennisch, naechsteAngebotsnummer } from "@/lib/utils";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const kundeId = searchParams.get("kundeId");
  const status = searchParams.get("status");
  const search = searchParams.get("search");

  // Automatisch abgelaufene Angebote auf ABGELAUFEN setzen
  try {
    await prisma.angebot.updateMany({
      where: { status: "OFFEN", gueltigBis: { lt: new Date() } },
      data: { status: "ABGELAUFEN" },
    });
  } catch (err) {
    Sentry.captureException(err);
    // Nicht-kritisch – weiter mit der Abfrage
  }

  const where: Record<string, unknown> = {};
  if (kundeId) where.kundeId = Number(kundeId);
  if (status && status !== "alle") where.status = status;
  if (search) {
    where.OR = [
      { nummer: { contains: search } },
      { kunde: { name: { contains: search } } },
      { kunde: { firma: { contains: search } } },
    ];
  }

  const include = {
    kunde: { select: { id: true, name: true, firma: true } },
    positionen: {
      include: { artikel: { select: { name: true, einheit: true, mwstSatz: true } } },
    },
  };

  function mapResult(angebote: Awaited<ReturnType<typeof prisma.angebot.findMany<{ include: typeof include }>>>) {
    return angebote.map((a) => {
      const gesamtbetrag = a.positionen.reduce((sum, pos) => {
        const netto = pos.menge * pos.preis * (1 - pos.rabatt / 100);
        return sum + netto;
      }, 0);
      return {
        ...a,
        gesamtbetrag: rundeKaufmaennisch(gesamtbetrag, 2),
        positionenAnzahl: a.positionen.length,
      };
    });
  }

  // Abwärtskompatibel: Nur wenn ?page= explizit mitgeschickt wird, liefern wir das
  // paginierte Format { data, total, page, limit, totalPages }. Ohne ?page= bleibt die
  // Response ein nacktes Array (bestehende Aufrufer wie Nav-Suche, Kunden-Tabs).
  const pageParam = searchParams.get("page");
  const usePagination = pageParam !== null;
  const limit = Math.min(500, Math.max(1, parseInt(searchParams.get("limit") ?? "200", 10) || 200));
  const page = usePagination ? Math.max(1, parseInt(pageParam, 10) || 1) : 1;

  try {
    if (usePagination) {
      const [angebote, total] = await Promise.all([
        prisma.angebot.findMany({
          where,
          include,
          orderBy: { id: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.angebot.count({ where }),
      ]);
      return NextResponse.json({ data: mapResult(angebote), total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) });
    }

    const angebote = await prisma.angebot.findMany({
      where,
      include,
      orderBy: { id: "desc" },
      take: limit,
    });
    return NextResponse.json(mapResult(angebote));
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Datenbankfehler beim Laden der Angebote" }, { status: 500 });
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

  const { kundeId, gueltigBis, notiz, positionen } = body;

  if (!kundeId) {
    return NextResponse.json({ error: "kundeId ist erforderlich" }, { status: 400 });
  }
  if (!Array.isArray(positionen) || positionen.length === 0) {
    return NextResponse.json({ error: "Mindestens eine Position erforderlich" }, { status: 400 });
  }

  try {
    const angebot = await prisma.$transaction(async (tx) => {
      const einstellung = await tx.einstellung.findUnique({
        where: { key: "letzte_angebotsnummer" },
      });
      const prefixSetting = await tx.einstellung.findUnique({
        where: { key: "system.nummernkreis.angebot_prefix" },
      });
      const prefix = prefixSetting?.value?.trim() || "AN";
      const nummer = naechsteAngebotsnummer(einstellung?.value ?? null, prefix);

      await tx.einstellung.upsert({
        where: { key: "letzte_angebotsnummer" },
        update: { value: nummer },
        create: { key: "letzte_angebotsnummer", value: nummer },
      });

      // Validate positions
      for (const pos of positionen) {
        const menge = Number(pos.menge);
        const preis = Number(pos.preis);
        const rabatt = Number(pos.rabatt ?? 0);
        if (isNaN(menge) || menge <= 0) throw new Error("Menge muss größer 0 sein");
        if (isNaN(preis) || preis < 0) throw new Error("Preis darf nicht negativ sein");
        if (isNaN(rabatt) || rabatt < 0 || rabatt > 100) throw new Error("Rabatt muss zwischen 0 und 100 liegen");
      }

      return tx.angebot.create({
        data: {
          nummer,
          kundeId: Number(kundeId),
          gueltigBis: gueltigBis ? new Date(gueltigBis) : null,
          notiz: notiz ?? null,
          positionen: {
            create: positionen.map((pos: {
              artikelId: number;
              menge: number;
              preis: number;
              rabatt?: number;
              einheit?: string;
              notiz?: string;
            }) => ({
              artikelId: Number(pos.artikelId),
              menge: Number(pos.menge),
              preis: Number(pos.preis),
              rabatt: Math.min(100, Math.max(0, Number(pos.rabatt ?? 0))),
              einheit: pos.einheit ?? "kg",
              notiz: pos.notiz ?? null,
            })),
          },
        },
        include: {
          kunde: { select: { id: true, name: true, firma: true } },
          positionen: { include: { artikel: { select: liefposArtikelSelect } } },
        },
      });
    });

    return NextResponse.json(angebot, { status: 201 });
  } catch (err) {
    Sentry.captureException(err);
    console.error("Angebot POST error:", err);
    const isDev = process.env.NODE_ENV === "development";
    const message = isDev && err instanceof Error ? err.message : "Angebot konnte nicht angelegt werden";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
