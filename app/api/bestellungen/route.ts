import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
        positionen: {
          include: {
            artikel: { select: { id: true, name: true, artikelnummer: true, einheit: true } },
          },
        },
      },
      orderBy: { datum: "desc" },
      take: 200,
    });
    return NextResponse.json(list);
  } catch (err) {
    console.error("Bestellungen GET error:", err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const lieferantId = parseInt(String(body.lieferantId), 10);
  if (isNaN(lieferantId)) return NextResponse.json({ error: "Ungültige lieferantId" }, { status: 400 });

  const positionenRaw = Array.isArray(body.positionen) ? body.positionen : [];

  try {
    const bestellung = await prisma.$transaction(async (tx) => {
      // Nummer vergabe mit Race-Condition-Schutz
      const jahr = new Date().getFullYear();
      const key = "letzte_bestellungsnummer";
      const existing = await tx.einstellung.findUnique({ where: { key } });
      const nr = (existing ? parseInt(existing.value, 10) : 0) + 1;
      await tx.einstellung.upsert({
        where: { key },
        update: { value: String(nr) },
        create: { key, value: String(nr) },
      });
      const nummer = `BES-${jahr}-${String(nr).padStart(4, "0")}`;

      // Verify uniqueness (belt-and-suspenders, @unique constraint handles collision)
      const positionen = positionenRaw
        .filter((p: { artikelId?: unknown; menge?: unknown }) => p.artikelId && p.menge)
        .map((p: { artikelId: unknown; menge: unknown; preis?: unknown; einheit?: unknown }) => ({
          artikelId: parseInt(String(p.artikelId), 10),
          menge: Number(p.menge),
          preis: p.preis != null ? Number(p.preis) : null,
          einheit: p.einheit ? String(p.einheit) : "kg",
        }));

      return tx.bestellung.create({
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
    });
    return NextResponse.json(bestellung, { status: 201 });
  } catch (err) {
    console.error("Bestellungen POST error:", err);
    const isDev = process.env.NODE_ENV === "development";
    const message = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
