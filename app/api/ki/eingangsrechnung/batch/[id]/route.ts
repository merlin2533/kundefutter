import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Sentry } from "@/lib/sentry";
import { getUploadBase } from "@/lib/upload";
import { rm, readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import { isNextcloudKonfiguriert, uploadZuBuchhaltung } from "@/lib/nextcloud";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function parseItem<T extends { kiErgebnisJson: string | null; fehlendeFelder: string | null }>(item: T) {
  return {
    ...item,
    kiErgebnis: item.kiErgebnisJson ? JSON.parse(item.kiErgebnisJson) : null,
    fehlendeFelder: item.fehlendeFelder ? JSON.parse(item.fehlendeFelder) : [],
  };
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id: idStr } = await ctx.params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const batch = await prisma.kiEingangsrechnungBatch.findUnique({
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
    console.error("KiEingangsrechnungBatch GET[id] error:", e);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

function mimeFuerExt(ext: string): string | undefined {
  switch (ext) {
    case ".pdf":
      return "application/pdf";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    default:
      return undefined;
  }
}

// Verschiebt die im Batch hochgeladene Datei zum Beleg der neu angelegten
// Eingangsrechnung — analog zu POST /api/eingangsrechnungen/[id]/beleg, nur
// ausgehend von einer bereits auf der Platte liegenden Datei statt eines
// frischen multipart-Uploads.
async function uebernehmeBelegDatei(
  rechnungId: number,
  quellPfad: string,
  lieferantName: string,
  datum: Date
) {
  const ext = path.extname(quellPfad).toLowerCase() || ".jpg";
  const uploadDir = path.join(getUploadBase(), "eingangsrechnungen");
  await mkdir(uploadDir, { recursive: true });
  const filename = `eingangsrechnung-${rechnungId}-${Date.now()}${ext}`;
  const buffer = await readFile(path.join(getUploadBase(), quellPfad));
  await writeFile(path.join(uploadDir, filename), buffer);
  const relPfad = `eingangsrechnungen/${filename}`;

  await prisma.eingangsRechnung.update({ where: { id: rechnungId }, data: { belegpfad: relPfad } });

  isNextcloudKonfiguriert()
    .then(async (ok) => {
      if (!ok) return;
      await uploadZuBuchhaltung(
        datum.getFullYear(),
        datum.getMonth() + 1,
        "Eingangsrechnungen",
        `Eingangsrechnung_${rechnungId}_${lieferantName}${ext}`,
        buffer,
        mimeFuerExt(ext)
      );
    })
    .catch((e: unknown) => {
      Sentry.captureException(e);
      console.warn("[nextcloud] Eingangsrechnung-Batch-Beleg-Upload fehlgeschlagen:", e instanceof Error ? e.message : e);
    });
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
  // Optional: nur ein einzelnes Item übernehmen (Rest des Batches bleibt offen für später)
  const itemId = body.itemId != null ? Number(body.itemId) : null;
  if (body.itemId != null && (itemId === null || isNaN(itemId))) {
    return NextResponse.json({ error: "Ungültige itemId" }, { status: 400 });
  }

  try {
    const batch = await prisma.kiEingangsrechnungBatch.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!batch) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    if (aktion === "verwerfen") {
      const dir = path.join(getUploadBase(), "ki-eingangsrechnung-batch", String(id));
      try {
        await rm(dir, { recursive: true, force: true });
      } catch (e) {
        Sentry.captureException(e);
      }
      await prisma.kiEingangsrechnungBatch.delete({ where: { id } });
      return NextResponse.json({ ok: true });
    }

    if (aktion === "abschliessen") {
      let erstellt = 0;
      let uebersprungen = 0;
      let fehlgeschlagen = 0;

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
        if (!item.lieferantId || item.betragNetto == null || !item.datum) {
          fehlgeschlagen++;
          await prisma.kiEingangsrechnungBatchItem.update({
            where: { id: item.id },
            data: { status: "fehler", fehlerText: "Lieferant, Datum oder Betrag fehlen" },
          });
          continue;
        }

        try {
          const lieferant = await prisma.lieferant.findUnique({ where: { id: item.lieferantId }, select: { name: true } });
          if (!lieferant) throw new Error("Lieferant nicht gefunden");

          const datum = new Date(item.datum + "T00:00:00");
          const rechnung = await prisma.eingangsRechnung.create({
            data: {
              lieferantId: item.lieferantId,
              nummer: item.nummer?.trim() || null,
              datum,
              faelligAm: item.faelligAm ? new Date(item.faelligAm + "T00:00:00") : null,
              betrag: item.betragNetto,
              mwst: item.mwstSatz ?? 19,
              notiz: item.notiz?.trim() || null,
            },
          });

          try {
            await uebernehmeBelegDatei(rechnung.id, item.dateiPfad, lieferant.name, datum);
          } catch (err) {
            // Beleg-Übernahme ist nicht kritisch für die Rechnung selbst — nur protokollieren
            Sentry.captureException(err);
          }

          await prisma.kiEingangsrechnungBatchItem.update({
            where: { id: item.id },
            data: { status: "uebernommen", eingangsRechnungId: rechnung.id, fehlerText: null },
          });
          erstellt++;
        } catch (err) {
          Sentry.captureException(err);
          const message = err instanceof Error ? err.message : "Unbekannter Fehler";
          await prisma.kiEingangsrechnungBatchItem.update({
            where: { id: item.id },
            data: { status: "fehler", fehlerText: message.slice(0, 500) },
          });
          fehlgeschlagen++;
        }
      }

      const nochOffen = await prisma.kiEingangsrechnungBatchItem.count({
        where: { batchId: id, status: { in: ["wartet", "analysiert"] } },
      });
      await prisma.kiEingangsrechnungBatch.update({
        where: { id },
        data: {
          status: nochOffen === 0 ? "abgeschlossen" : "bereit",
          abgeschlossenAm: nochOffen === 0 ? new Date() : undefined,
        },
      });

      return NextResponse.json({ erstellt, uebersprungen, fehlgeschlagen });
    }

    return NextResponse.json({ error: "Unbekannte Aktion" }, { status: 400 });
  } catch (e) {
    Sentry.captureException(e);
    console.error("KiEingangsrechnungBatch PUT error:", e);
    return NextResponse.json({ error: "Aktion fehlgeschlagen" }, { status: 500 });
  }
}
