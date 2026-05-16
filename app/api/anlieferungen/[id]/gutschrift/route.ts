import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// POST: Erstelle eine Gutschrift aus der Anlieferung
export async function POST(_req: NextRequest, ctx: Params) {
  const { id: idStr } = await ctx.params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    // Load the Anlieferung
    const anlieferung = await prisma.anlieferung.findUnique({
      where: { id },
      include: {
        artikel: { select: { id: true, name: true } },
        kunde: { select: { id: true, name: true } },
      },
    });
    if (!anlieferung) return NextResponse.json({ error: "Anlieferung nicht gefunden" }, { status: 404 });
    if (anlieferung.gutschriftId) return NextResponse.json({ error: "Gutschrift bereits erstellt" }, { status: 409 });
    if (!anlieferung.preisProEinheit) {
      return NextResponse.json({ error: "Kein Preis hinterlegt — bitte zuerst Preis erfassen" }, { status: 400 });
    }

    // Create Gutschrift in transaction
    const gutschrift = await prisma.$transaction(async (tx) => {
      const year = new Date().getFullYear();
      const prefix = `GS-${year}-`;

      // Get next Gutschrift number
      const last = await tx.gutschrift.findFirst({
        where: { nummer: { startsWith: prefix } },
        orderBy: { nummer: "desc" },
      });
      let naechste = 1;
      if (last?.nummer) {
        const match = last.nummer.match(/GS-\d{4}-(\d+)/);
        if (match) naechste = parseInt(match[1], 10) + 1;
      }
      const nummer = `${prefix}${String(naechste).padStart(4, "0")}`;

      const preis = anlieferung.preisProEinheit!;
      const betrag = Math.round(preis * anlieferung.menge * 100) / 100;

      const gs = await tx.gutschrift.create({
        data: {
          nummer,
          kundeId: anlieferung.kundeId,
          datum: new Date(),
          grund: "Erzeugerabrechnung",
          notiz: `Anlieferung ${anlieferung.nummer}: ${anlieferung.menge} ${anlieferung.einheit} ${anlieferung.artikel.name}${anlieferung.qualitaet ? ` (${anlieferung.qualitaet})` : ""}`,
          status: "OFFEN",
          positionen: {
            create: [{
              artikelId: anlieferung.artikelId,
              menge: anlieferung.menge,
              preis,
              ruecknahme: false,
            }],
          },
        },
      });

      // Link Gutschrift back to Anlieferung
      await tx.anlieferung.update({
        where: { id },
        data: { gutschriftId: gs.id, gesamtBetrag: betrag },
      });

      return gs;
    });

    return NextResponse.json({ gutschrift }, { status: 201 });
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    return NextResponse.json(
      { error: isDev && err instanceof Error ? err.message : "Interner Fehler" },
      { status: 500 }
    );
  }
}
