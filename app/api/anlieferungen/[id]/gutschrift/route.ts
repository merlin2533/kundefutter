import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Sentry } from "@/lib/sentry";
import { getModulConfig, requireModul } from "@/lib/modul-config";
import { naechsteGutschriftsnummer } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// POST: Erstelle eine Gutschrift aus der Anlieferung
export async function POST(_req: NextRequest, ctx: Params) {
  const modul = await getModulConfig();
  const denyModul = requireModul(modul, "erzeugerabrechnung");
  if (denyModul) return denyModul;

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

    // Create Gutschrift in transaction — Nummernvergabe über denselben zentralen Zähler
    // (system.letzteGutschriftNr) wie jede andere Gutschrift (app/api/gutschriften/route.ts,
    // lib/gutschrift.ts, lib/bankabgleich-differenz.ts) — ein eigener findFirst-basierter Zähler
    // hier würde mit der nächsten regulär angelegten Gutschrift kollidieren (P2002 auf
    // nummer @unique), da beide Zähler unabhängig voneinander hochzählen.
    const gutschrift = await prisma.$transaction(async (tx) => {
      const einstellung = await tx.einstellung.findUnique({ where: { key: "system.letzteGutschriftNr" } });
      const nummer = naechsteGutschriftsnummer(einstellung?.value ?? null);
      await tx.einstellung.upsert({
        where: { key: "system.letzteGutschriftNr" },
        update: { value: nummer },
        create: { key: "system.letzteGutschriftNr", value: nummer },
      });

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
    Sentry.captureException(err);
    const isDev = process.env.NODE_ENV === "development";
    return NextResponse.json(
      { error: isDev && err instanceof Error ? err.message : "Interner Fehler" },
      { status: 500 }
    );
  }
}
