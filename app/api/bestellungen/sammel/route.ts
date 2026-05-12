import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET ?artikelId=X → returns customers with active Bedarf for this article
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const artikelIdParam = searchParams.get("artikelId");
  if (!artikelIdParam) return NextResponse.json({ error: "artikelId fehlt" }, { status: 400 });
  const artikelId = parseInt(artikelIdParam, 10);
  if (isNaN(artikelId)) return NextResponse.json({ error: "Ungültige artikelId" }, { status: 400 });

  try {
    const bedarfe = await prisma.kundeBedarf.findMany({
      where: { artikelId, aktiv: true },
      include: {
        kunde: { select: { id: true, name: true, firma: true, ort: true } },
        artikel: { select: { id: true, name: true, einheit: true, standardpreis: true } },
      },
      orderBy: { kunde: { name: "asc" } },
      take: 200,
    });
    return NextResponse.json(bedarfe);
  } catch (err) {
    console.error("Sammel GET error:", err);
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST: { artikelId, lieferantId, positionen: [{kundeId, menge}] }
export async function POST(req: NextRequest) {
  let body: {
    artikelId?: unknown;
    lieferantId?: unknown;
    positionen?: unknown;
    notiz?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const artikelId = parseInt(String(body.artikelId), 10);
  if (isNaN(artikelId)) return NextResponse.json({ error: "Ungültige artikelId" }, { status: 400 });
  const lieferantId = parseInt(String(body.lieferantId), 10);
  if (isNaN(lieferantId)) return NextResponse.json({ error: "Ungültige lieferantId" }, { status: 400 });

  const positionenRaw = Array.isArray(body.positionen) ? body.positionen : [];
  if (positionenRaw.length === 0) {
    return NextResponse.json({ error: "Mindestens eine Position erforderlich" }, { status: 400 });
  }

  const positionen = positionenRaw
    .filter(
      (p: { kundeId?: unknown; menge?: unknown }) =>
        p.kundeId && p.menge && Number(p.menge) > 0
    )
    .map((p: { kundeId: unknown; menge: unknown }) => ({
      kundeId: parseInt(String(p.kundeId), 10),
      menge: Number(p.menge),
    }));

  if (positionen.length === 0) {
    return NextResponse.json({ error: "Keine gültigen Positionen" }, { status: 400 });
  }

  const gesamtMenge = positionen.reduce((sum: number, p: { menge: number }) => sum + p.menge, 0);

  // Build notiz with customer breakdown
  const kundenBreakdown = positionen
    .map((p: { kundeId: number; menge: number }) => `KID:${p.kundeId}=${p.menge}`)
    .join(", ");
  const notizText = body.notiz
    ? `${String(body.notiz)} | ${kundenBreakdown}`
    : `Sammelbestellung: ${kundenBreakdown}`;

  try {
    const bestellung = await prisma.$transaction(async (tx) => {
      // Nummer vergabe with Race-Condition protection
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

      // Get article info for einheit
      const artikel = await tx.artikel.findUnique({
        where: { id: artikelId },
        select: { einheit: true, standardpreis: true },
      });

      return tx.bestellung.create({
        data: {
          nummer,
          lieferantId,
          notiz: notizText,
          positionen: {
            create: [
              {
                artikelId,
                menge: gesamtMenge,
                einheit: artikel?.einheit ?? "kg",
                preis: artikel?.standardpreis ?? null,
              },
            ],
          },
        },
        include: {
          lieferant: { select: { id: true, name: true } },
          positionen: {
            include: {
              artikel: { select: { id: true, name: true, einheit: true } },
            },
          },
        },
      });
    });

    return NextResponse.json(
      { ...bestellung, gesamtMenge, positionen },
      { status: 201 }
    );
  } catch (err) {
    console.error("Sammel POST error:", err);
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
