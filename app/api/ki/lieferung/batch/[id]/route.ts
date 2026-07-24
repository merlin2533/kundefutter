import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Sentry } from "@/lib/sentry";
import { getUploadBase } from "@/lib/upload";
import { rm } from "fs/promises";
import path from "path";
import { erstelleLieferungMitPreisberechnung, vergebeRechnungsnummerFuerLieferung } from "@/lib/lieferung";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function parseItem<T extends { kiErgebnisJson: string | null; positionenJson: string | null; fehlendeFelder: string | null }>(
  item: T
) {
  return {
    ...item,
    kiErgebnis: item.kiErgebnisJson ? JSON.parse(item.kiErgebnisJson) : null,
    positionen: item.positionenJson ? JSON.parse(item.positionenJson) : [],
    fehlendeFelder: item.fehlendeFelder ? JSON.parse(item.fehlendeFelder) : [],
  };
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id: idStr } = await ctx.params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const batch = await prisma.kiLieferungBatch.findUnique({
      where: { id },
      include: { items: { orderBy: { reihenfolge: "asc" } } },
    });
    if (!batch) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    return NextResponse.json({
      ...batch,
      items: batch.items.map(parseItem),
    });
  } catch (e) {
    Sentry.captureException(e);
    console.error("KiLieferungBatch GET[id] error:", e);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

interface BatchPositionInput {
  artikelId: string | number | null;
  menge: number;
  verkaufspreis?: number;
  chargeNr?: string;
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const { id: idStr } = await ctx.params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  let body;
  try {
    body = await req.json();
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }
  const aktion = body.aktion;
  const autoRechnung = body.autoRechnung === true;
  // Optional: nur ein einzelnes Item übernehmen (Rest des Batches bleibt offen für später)
  const itemId = body.itemId != null ? Number(body.itemId) : null;
  if (body.itemId != null && (itemId === null || isNaN(itemId))) {
    return NextResponse.json({ error: "Ungültige itemId" }, { status: 400 });
  }

  try {
    const batch = await prisma.kiLieferungBatch.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!batch) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    if (aktion === "verwerfen") {
      const dir = path.join(getUploadBase(), "ki-lieferung-batch", String(id));
      try {
        await rm(dir, { recursive: true, force: true });
      } catch (e) {
        Sentry.captureException(e);
      }
      await prisma.kiLieferungBatch.delete({ where: { id } });
      return NextResponse.json({ ok: true });
    }

    if (aktion === "abschliessen") {
      let erstellt = 0;
      let uebersprungen = 0;
      let fehlgeschlagen = 0;
      let rechnungenErstellt = 0;

      const zuVerarbeiten = itemId != null ? batch.items.filter((it) => it.id === itemId) : batch.items;
      if (itemId != null && zuVerarbeiten.length === 0) {
        return NextResponse.json({ error: "Item nicht gefunden" }, { status: 404 });
      }

      for (const item of zuVerarbeiten) {
        if (item.status === "uebernommen") {
          erstellt++;
          continue;
        }
        if (item.entscheidung !== "passt") {
          uebersprungen++;
          continue;
        }
        if (!item.kundeId || !item.positionenJson) {
          fehlgeschlagen++;
          await prisma.kiLieferungBatchItem.update({
            where: { id: item.id },
            data: { status: "fehler", fehlerText: "Kunde oder Positionen fehlen" },
          });
          continue;
        }

        try {
          const positionenRaw: BatchPositionInput[] = JSON.parse(item.positionenJson);
          const positionen = positionenRaw
            .filter((p) => p.artikelId)
            .map((p) => ({
              artikelId: Number(p.artikelId),
              menge: p.menge,
              verkaufspreis: p.verkaufspreis,
              chargeNr: typeof p.chargeNr === "string" && p.chargeNr.trim() ? p.chargeNr.trim() : undefined,
            }));
          if (positionen.length === 0) {
            throw new Error("Keine gültigen Positionen");
          }

          const ergebnis = item.kiErgebnisJson ? (JSON.parse(item.kiErgebnisJson) as { datum?: string }) : {};

          const { lieferung } = await erstelleLieferungMitPreisberechnung({
            kundeId: item.kundeId,
            datum: ergebnis.datum ? new Date(ergebnis.datum) : undefined,
            quelle: "ki-batch",
            positionen,
          });

          if (autoRechnung) {
            try {
              await prisma.$transaction((tx) => vergebeRechnungsnummerFuerLieferung(tx, lieferung.id));
              rechnungenErstellt++;
            } catch (err) {
              // Rechnungserstellung ist nicht kritisch für die Übernahme der Lieferung — nur protokollieren
              Sentry.captureException(err);
            }
          }

          await prisma.kiLieferungBatchItem.update({
            where: { id: item.id },
            data: { status: "uebernommen", lieferungId: lieferung.id, fehlerText: null },
          });
          erstellt++;
        } catch (err) {
          Sentry.captureException(err);
          const message = err instanceof Error ? err.message : "Unbekannter Fehler";
          await prisma.kiLieferungBatchItem.update({
            where: { id: item.id },
            data: { status: "fehler", fehlerText: message.slice(0, 500) },
          });
          fehlgeschlagen++;
        }
      }

      const nochOffen = await prisma.kiLieferungBatchItem.count({
        where: { batchId: id, status: { in: ["wartet", "analysiert"] } },
      });
      await prisma.kiLieferungBatch.update({
        where: { id },
        data: {
          status: nochOffen === 0 ? "abgeschlossen" : "bereit",
          abgeschlossenAm: nochOffen === 0 ? new Date() : undefined,
        },
      });

      return NextResponse.json({ erstellt, uebersprungen, fehlgeschlagen, rechnungenErstellt });
    }

    return NextResponse.json({ error: "Unbekannte Aktion" }, { status: 400 });
  } catch (e) {
    Sentry.captureException(e);
    console.error("KiLieferungBatch PUT error:", e);
    return NextResponse.json({ error: "Aktion fehlgeschlagen" }, { status: 500 });
  }
}
