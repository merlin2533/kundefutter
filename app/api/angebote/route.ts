import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function naechsteAngebotsnummer(letzte: string | null): string {
  const jahr = new Date().getFullYear();
  if (!letzte) return `AN-${jahr}-0001`;
  const parts = letzte.split("-");
  const letzteJahr = parts.length >= 3 ? parseInt(parts[1], 10) : 0;
  if (letzteJahr !== jahr) return `AN-${jahr}-0001`;
  const num = parseInt(parts[parts.length - 1] || "0", 10) + 1;
  return `AN-${jahr}-${String(num).padStart(4, "0")}`;
}

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
  } catch {
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

  try {
    const angebote = await prisma.angebot.findMany({
      where,
      include: {
        kunde: { select: { id: true, name: true, firma: true } },
        positionen: {
          include: { artikel: { select: { name: true, einheit: true, mwstSatz: true } } },
        },
      },
      orderBy: { datum: "desc" },
      take: 200,
    });

    const result = angebote.map((a) => {
      const gesamtbetrag = a.positionen.reduce((sum, pos) => {
        const netto = pos.menge * pos.preis * (1 - pos.rabatt / 100);
        return sum + netto;
      }, 0);
      return {
        ...a,
        gesamtbetrag: Math.round(gesamtbetrag * 100) / 100,
        positionenAnzahl: a.positionen.length,
      };
    });

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Datenbankfehler beim Laden der Angebote" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body;
  try {
    body = await req.json();
  } catch {
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
      const nummer = naechsteAngebotsnummer(einstellung?.value ?? null);

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
    const message = err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
