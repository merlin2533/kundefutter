import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Sentry } from "@/lib/sentry";
import { naechsteBestellungsnummer } from "@/lib/utils";

export const dynamic = "force-dynamic";

const GUELTIGE_STATUS = ["OFFEN", "BESTAETIGT", "TEILGELIEFERT", "ABGESCHLOSSEN", "STORNIERT"];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lieferantId = searchParams.get("lieferantId");
  const status = searchParams.get("status");

  const where: Record<string, unknown> = {};

  if (lieferantId) {
    const lid = parseInt(lieferantId, 10);
    if (isNaN(lid)) return NextResponse.json({ error: "Ungültige lieferantId" }, { status: 400 });
    where.lieferantId = lid;
  }
  if (status) {
    if (!GUELTIGE_STATUS.includes(status)) return NextResponse.json({ error: "Ungültiger Status" }, { status: 400 });
    where.status = status;
  }

  try {
    const list = await prisma.bestellung.findMany({
      where,
      include: {
        lieferant: { select: { id: true, name: true } },
        _count: { select: { positionen: true } },
      },
      orderBy: { datum: "desc" },
      take: 200,
    });
    return NextResponse.json(list);
  } catch (err) {
    Sentry.captureException(err);
    console.error("Bestellungen GET error:", err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

// Body entweder frei: { lieferantId, positionen: [{artikelId,menge,preis?,einheit?}], ... }
// oder gebündelt aus der Bestellliste: { lieferantId, bestellpositionIds: number[], ... } — bündelt
// offene Bestellliste-Einträge desselben Lieferanten zu einer formellen Bestellung; die
// Quell-Positionen werden dabei als "bestellt" markiert und per bestellungId verknüpft, damit
// nachvollziehbar bleibt, was schon bestellt wurde (siehe /bestellliste).
export async function POST(req: NextRequest) {
  let body;
  try {
    body = await req.json();
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const lieferantId = parseInt(String(body.lieferantId), 10);
  if (isNaN(lieferantId)) return NextResponse.json({ error: "Ungültige lieferantId" }, { status: 400 });

  const bestellpositionIds = Array.isArray(body.bestellpositionIds)
    ? (body.bestellpositionIds as unknown[]).map((v) => parseInt(String(v), 10)).filter((n) => !isNaN(n))
    : [];

  try {
    const bestellung = await prisma.$transaction(async (tx) => {
      let positionen: { artikelId: number; menge: number; preis: number | null; einheit: string }[];
      let bestellliste: { id: number; artikelId: number; menge: number; einkaufspreis: number; einheit: string }[] = [];

      if (bestellpositionIds.length > 0) {
        bestellliste = await tx.bestellposition.findMany({
          where: { id: { in: bestellpositionIds }, lieferantId, status: "offen" },
          select: { id: true, artikelId: true, menge: true, einkaufspreis: true, einheit: true },
        });
        if (bestellliste.length === 0) {
          throw Object.assign(new Error("Keine passenden offenen Bestellliste-Positionen für diesen Lieferanten gefunden"), { statusCode: 422 });
        }
        positionen = bestellliste.map((p) => ({
          artikelId: p.artikelId,
          menge: p.menge,
          preis: p.einkaufspreis > 0 ? p.einkaufspreis : null,
          einheit: p.einheit,
        }));
      } else {
        const positionenRaw = Array.isArray(body.positionen) ? body.positionen : [];
        positionen = positionenRaw
          .filter((p: { artikelId?: unknown; menge?: unknown }) => p.artikelId && p.menge)
          .map((p: { artikelId: unknown; menge: unknown; preis?: unknown; einheit?: unknown }) => ({
            artikelId: parseInt(String(p.artikelId), 10),
            menge: Number(p.menge),
            preis: p.preis != null ? Number(p.preis) : null,
            einheit: p.einheit ? String(p.einheit) : "kg",
          }));
      }

      // Nummer vergabe mit Race-Condition-Schutz (Jahreswechsel-Reset via naechsteBestellungsnummer)
      const key = "letzte_bestellungsnummer";
      const existing = await tx.einstellung.findUnique({ where: { key } });
      const nummer = naechsteBestellungsnummer(existing?.value ?? null);
      await tx.einstellung.upsert({
        where: { key },
        update: { value: nummer },
        create: { key, value: nummer },
      });

      const neueBestellung = await tx.bestellung.create({
        data: {
          nummer,
          lieferantId,
          datum: body.datum ? new Date(body.datum) : new Date(),
          lieferdatum: body.lieferdatum ? new Date(body.lieferdatum) : null,
          notiz: body.notiz ? String(body.notiz) : null,
          positionen: { create: positionen },
        },
        include: {
          lieferant: { select: { id: true, name: true } },
          positionen: {
            include: { artikel: { select: { id: true, name: true, artikelnummer: true, einheit: true } } },
          },
        },
      });

      if (bestellliste.length > 0) {
        await tx.bestellposition.updateMany({
          where: { id: { in: bestellliste.map((p) => p.id) } },
          data: { status: "bestellt", bestelltAm: new Date(), bestellungId: neueBestellung.id },
        });
      }

      return neueBestellung;
    });
    return NextResponse.json(bestellung, { status: 201 });
  } catch (err) {
    Sentry.captureException(err);
    console.error("Bestellungen POST error:", err);
    const statusCode = (err as { statusCode?: number }).statusCode;
    const isDev = process.env.NODE_ENV === "development";
    const message = statusCode
      ? (err as Error).message
      : isDev && err instanceof Error
      ? err.message
      : "Interner Fehler";
    return NextResponse.json({ error: message }, { status: statusCode ?? 500 });
  }
}
