import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function naechsteAngebotsnummer(letzte: string | null): string {
  const jahr = new Date().getFullYear();
  if (!letzte) return `AN-${jahr}-0001`;
  const parts = letzte.split("-");
  const letzteJahr = parts.length >= 3 ? parseInt(parts[1], 10) : 0;
  if (letzteJahr !== jahr) return `AN-${jahr}-0001`;
  const num = parseInt(parts[parts.length - 1] || "0", 10) + 1;
  return `AN-${jahr}-${String(num).padStart(4, "0")}`;
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const kundeId = b.kundeId != null ? parseInt(String(b.kundeId), 10) : null;
  if (!kundeId || isNaN(kundeId))
    return NextResponse.json({ error: "kundeId ist erforderlich" }, { status: 400 });

  try {
    const angebot = await prisma.$transaction(async (tx) => {
      // Load template with positions and article data (for fallback prices)
      const vorlage = await tx.angebotVorlage.findUnique({
        where: { id: numId },
        include: {
          positionen: {
            include: {
              artikel: { select: { id: true, standardpreis: true, einheit: true } },
            },
          },
        },
      });
      if (!vorlage) throw new Error("P2025");

      // Verify customer exists
      const kunde = await tx.kunde.findUnique({ where: { id: kundeId }, select: { id: true } });
      if (!kunde) throw new Error("Kunde nicht gefunden");

      // Resolve Angebotsnummer inside transaction to avoid race condition
      const einstellung = await tx.einstellung.findUnique({
        where: { key: "letzte_angebotsnummer" },
      });
      const nummer = naechsteAngebotsnummer(einstellung?.value ?? null);
      await tx.einstellung.upsert({
        where: { key: "letzte_angebotsnummer" },
        update: { value: nummer },
        create: { key: "letzte_angebotsnummer", value: nummer },
      });

      return tx.angebot.create({
        data: {
          nummer,
          kundeId,
          notiz: vorlage.notiz ?? null,
          positionen: {
            create: vorlage.positionen.map((p) => ({
              artikelId: p.artikelId,
              menge: p.menge,
              // If vorlage price is 0, use article's current standard price
              preis: p.preis > 0 ? p.preis : p.artikel.standardpreis,
              rabatt: p.rabatt,
              einheit: p.einheit,
              notiz: p.notiz ?? null,
            })),
          },
        },
        include: {
          kunde: { select: { id: true, name: true, firma: true } },
          positionen: {
            include: {
              artikel: { select: { id: true, name: true, einheit: true, mwstSatz: true } },
            },
          },
        },
      });
    });

    return NextResponse.json(angebot, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("P2025") || msg === "P2025") {
      return NextResponse.json({ error: "Vorlage nicht gefunden" }, { status: 404 });
    }
    if (msg === "Kunde nicht gefunden") {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    console.error("AngebotVorlage anwenden error:", err);
    const isDev = process.env.NODE_ENV === "development";
    return NextResponse.json({ error: isDev ? msg : "Interner Fehler" }, { status: 500 });
  }
}
