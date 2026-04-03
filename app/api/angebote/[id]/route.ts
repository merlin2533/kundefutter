import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { naechsteRechnungsnummer } from "@/lib/utils";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Params) {
  const { id } = await ctx.params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    // Automatisch abgelaufen setzen wenn nötig
    await prisma.angebot.updateMany({
      where: { id: numId, status: "OFFEN", gueltigBis: { lt: new Date() } },
      data: { status: "ABGELAUFEN" },
    });

    const angebot = await prisma.angebot.findUnique({
      where: { id: numId },
      include: {
        kunde: { include: { kontakte: true } },
        positionen: { include: { artikel: true } },
      },
    });
    if (!angebot) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    return NextResponse.json(angebot);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, ctx: Params) {
  const { id } = await ctx.params;
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const { aktion, status, notiz, gueltigBis } = body;

  try {
    // Sonderaktion: Angebot annehmen → Lieferung + Sammelrechnung + Bestellpositionen
    if (aktion === "annehmen") {
      const result = await prisma.$transaction(async (tx) => {
        const angebot = await tx.angebot.findUnique({
          where: { id: Number(id) },
          include: {
            positionen: {
              include: {
                artikel: {
                  include: {
                    lieferanten: { orderBy: [{ bevorzugt: "desc" }, { id: "asc" }], take: 1 },
                  },
                },
              },
            },
          },
        });
        if (!angebot) throw new Error("Angebot nicht gefunden");
        if (angebot.status !== "OFFEN") {
          throw new Error(`Angebot hat Status "${angebot.status}" und kann nicht angenommen werden`);
        }

        // 1. Lieferung erstellen
        const lieferung = await tx.lieferung.create({
          data: {
            kundeId: angebot.kundeId,
            notiz: `Aus Angebot ${angebot.nummer} übernommen${angebot.notiz ? `: ${angebot.notiz}` : ""}`,
            positionen: {
              create: angebot.positionen.map((pos) => ({
                artikelId: pos.artikelId,
                menge: pos.menge,
                verkaufspreis: pos.preis * (1 - pos.rabatt / 100),
                einkaufspreis: pos.artikel.lieferanten[0]?.einkaufspreis ?? 0,
                rabattProzent: pos.rabatt,
              })),
            },
          },
        });

        // 2. Sammelrechnung erstellen und mit Lieferung verknüpfen
        const einstellung = await tx.einstellung.findUnique({ where: { key: "letzte_rechnungsnummer" } });
        const rechnungNr = naechsteRechnungsnummer(einstellung?.value ?? null);
        await tx.einstellung.upsert({
          where: { key: "letzte_rechnungsnummer" },
          update: { value: rechnungNr },
          create: { key: "letzte_rechnungsnummer", value: rechnungNr },
        });
        const sammelrechnung = await tx.sammelrechnung.create({
          data: {
            kundeId: angebot.kundeId,
            rechnungNr,
            rechnungDatum: new Date(),
            zahlungsziel: 30,
          },
        });
        await tx.lieferung.update({
          where: { id: lieferung.id },
          data: { sammelrechnungId: sammelrechnung.id },
        });

        // 3. Bestellpositionen für Lieferanten anlegen
        const bestellpositionen = angebot.positionen
          .filter((pos) => pos.artikel.lieferanten.length > 0)
          .map((pos) => {
            const al = pos.artikel.lieferanten[0];
            return {
              lieferantId: al.lieferantId,
              artikelId: pos.artikelId,
              kundeId: angebot.kundeId,
              lieferungId: lieferung.id,
              angebotId: angebot.id,
              menge: pos.menge,
              einheit: pos.einheit,
              einkaufspreis: al.einkaufspreis,
            };
          });
        if (bestellpositionen.length > 0) {
          await tx.bestellposition.createMany({ data: bestellpositionen });
        }

        const updated = await tx.angebot.update({
          where: { id: Number(id) },
          data: { status: "ANGENOMMEN", notiz: `Lieferung ${lieferung.id} / Rechnung ${rechnungNr}. ${angebot.notiz ?? ""}`.trim() },
          include: {
            kunde: { include: { kontakte: true } },
            positionen: { include: { artikel: true } },
          },
        });

        return { angebot: updated, lieferungId: lieferung.id, sammelrechnungId: sammelrechnung.id, rechnungNr };
      });

      return NextResponse.json(result);
    }

    // Normales Update
    const VALID_STATUS = ["OFFEN", "ANGENOMMEN", "ABGELEHNT", "ABGELAUFEN"];
    const updateData: Record<string, unknown> = {};
    if (status !== undefined) {
      if (!VALID_STATUS.includes(status)) throw new Error(`Ungültiger Status: ${status}`);
      updateData.status = status;
    }
    if (notiz !== undefined) updateData.notiz = notiz;
    if (gueltigBis !== undefined) updateData.gueltigBis = gueltigBis ? new Date(gueltigBis) : null;

    const updated = await prisma.angebot.update({
      where: { id: Number(id) },
      data: updateData,
      include: {
        kunde: { include: { kontakte: true } },
        positionen: { include: { artikel: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Params) {
  const { id } = await ctx.params;
  try {
    await prisma.angebot.delete({ where: { id: Number(id) } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
