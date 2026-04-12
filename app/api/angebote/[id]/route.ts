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
      const numId = parseInt(id, 10);
      if (isNaN(numId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

      const result = await prisma.$transaction(async (tx) => {
        const angebot = await tx.angebot.findUnique({
          where: { id: numId },
          include: {
            positionen: { include: { artikel: true } },
          },
        });
        if (!angebot) throw new Error("Angebot nicht gefunden");
        if (angebot.status !== "OFFEN") {
          throw new Error(`Angebot hat Status "${angebot.status}" und kann nicht angenommen werden`);
        }

        // Bulk-Lookup bevorzugter Lieferanten (statt N+1 per Position)
        const artikelIds = [...new Set(angebot.positionen.map((p) => p.artikelId))];
        const lieferantenRows = artikelIds.length > 0
          ? await tx.artikelLieferant.findMany({
              where: { artikelId: { in: artikelIds } },
              orderBy: [{ bevorzugt: "desc" }, { id: "asc" }],
            })
          : [];
        const bevorzugterLieferantMap = new Map<number, typeof lieferantenRows[number]>();
        for (const row of lieferantenRows) {
          if (!bevorzugterLieferantMap.has(row.artikelId)) {
            bevorzugterLieferantMap.set(row.artikelId, row);
          }
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
                einkaufspreis: bevorzugterLieferantMap.get(pos.artikelId)?.einkaufspreis ?? 0,
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

        // 3. Bestellpositionen für Lieferanten anlegen (Bulk-Map statt N+1)
        const bestellpositionen = angebot.positionen
          .map((pos) => {
            const al = bevorzugterLieferantMap.get(pos.artikelId);
            if (!al) return null;
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
          })
          .filter((p): p is NonNullable<typeof p> => p !== null);
        if (bestellpositionen.length > 0) {
          await tx.bestellposition.createMany({ data: bestellpositionen });
        }

        const updated = await tx.angebot.update({
          where: { id: numId },
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
    const numId = parseInt(id, 10);
    if (isNaN(numId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

    const VALID_STATUS = ["OFFEN", "ANGENOMMEN", "ABGELEHNT", "ABGELAUFEN"];
    const updateData: Record<string, unknown> = {};
    if (status !== undefined) {
      if (!VALID_STATUS.includes(status)) {
        return NextResponse.json({ error: `Ungültiger Status: ${status}` }, { status: 400 });
      }
      updateData.status = status;
    }
    if (notiz !== undefined) updateData.notiz = notiz;
    if (gueltigBis !== undefined) updateData.gueltigBis = gueltigBis ? new Date(gueltigBis) : null;

    const updated = await prisma.angebot.update({
      where: { id: numId },
      data: updateData,
      include: {
        kunde: { include: { kontakte: true } },
        positionen: { include: { artikel: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("Angebot PUT error:", err);
    const isDev = process.env.NODE_ENV === "development";
    const message = isDev && err instanceof Error ? err.message : "Aktion konnte nicht ausgeführt werden";
    // Prisma P2025 = Record not found
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2025") {
      return NextResponse.json({ error: "Angebot nicht gefunden" }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Params) {
  const { id } = await ctx.params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });
  try {
    await prisma.angebot.delete({ where: { id: numId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Angebot DELETE error:", err);
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2025") {
      return NextResponse.json({ error: "Angebot nicht gefunden" }, { status: 404 });
    }
    return NextResponse.json({ error: "Löschen fehlgeschlagen" }, { status: 400 });
  }
}
