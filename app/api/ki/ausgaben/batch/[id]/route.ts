import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Sentry } from "@/lib/sentry";
import { getUploadBase } from "@/lib/upload";
import { rm, readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import { getSachkonto } from "@/lib/datev";
import { getCurrentUser } from "@/lib/auth";
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
    const batch = await prisma.kiAusgabenBatch.findUnique({
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
    console.error("KiAusgabenBatch GET[id] error:", e);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

async function getKontenrahmen() {
  const einst = await prisma.einstellung.findUnique({ where: { key: "datev.sachkontenrahmen" } });
  return (einst?.value === "SKR04" ? "SKR04" : "SKR03") as "SKR03" | "SKR04";
}

/** Sanitize a string for use in filenames — identisch zu app/api/ausgaben/[id]/beleg/route.ts */
function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[äöüÄÖÜß]/g, (c) => ({ ä: "ae", ö: "oe", ü: "ue", Ä: "Ae", Ö: "Oe", Ü: "Ue", ß: "ss" })[c] ?? c)
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 40);
}

function datumPrefix(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
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

// Verschiebt die im Batch hochgeladene Datei zum Beleg der neu angelegten Ausgabe — nach
// demselben Ablage-Schema wie POST /api/ausgaben/[id]/beleg (public/uploads/belege/<Jahr>/…),
// ausgehend von einer bereits auf der Platte liegenden Batch-Datei statt eines frischen Uploads.
async function uebernehmeBelegDatei(ausgabeId: number, quellPfad: string, beschreibung: string, belegNr: string | null, datum: Date) {
  const ext = path.extname(quellPfad).toLowerCase() || ".jpg";
  const extOhnePunkt = ext.replace(/^\./, "");
  const year = datum.getFullYear();
  const prefix = datumPrefix(datum);
  const slug = slugify(belegNr || beschreibung || String(ausgabeId));
  const filename = `${prefix}_${ausgabeId}_${slug}.${extOhnePunkt}`;

  const uploadDir = path.join(process.cwd(), "public", "uploads", "belege", String(year));
  await mkdir(uploadDir, { recursive: true });
  const buffer = await readFile(path.join(getUploadBase(), quellPfad));
  await writeFile(path.join(uploadDir, filename), buffer);
  const belegPfad = `/uploads/belege/${year}/${filename}`;

  await prisma.ausgabe.update({ where: { id: ausgabeId }, data: { belegPfad, belegDateiname: path.basename(quellPfad) } });

  isNextcloudKonfiguriert()
    .then(async (ok) => {
      if (!ok) return;
      await uploadZuBuchhaltung(year, datum.getMonth() + 1, "Ausgaben", filename, buffer, mimeFuerExt(ext));
    })
    .catch((e: unknown) => {
      Sentry.captureException(e);
      console.warn("[nextcloud] Ausgaben-Batch-Beleg-Upload fehlgeschlagen:", e instanceof Error ? e.message : e);
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
    const batch = await prisma.kiAusgabenBatch.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!batch) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    if (aktion === "verwerfen") {
      const dir = path.join(getUploadBase(), "ki-ausgaben-batch", String(id));
      try {
        await rm(dir, { recursive: true, force: true });
      } catch (e) {
        Sentry.captureException(e);
      }
      await prisma.kiAusgabenBatch.delete({ where: { id } });
      return NextResponse.json({ ok: true });
    }

    if (aktion === "abschliessen") {
      const me = await getCurrentUser();
      const kontenrahmen = await getKontenrahmen();

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
        if (!item.beschreibung?.trim() || item.betragNetto == null || item.betragNetto <= 0) {
          fehlgeschlagen++;
          await prisma.kiAusgabenBatchItem.update({
            where: { id: item.id },
            data: { status: "fehler", fehlerText: "Beschreibung oder Betrag fehlen" },
          });
          continue;
        }

        try {
          const kategorie = item.kategorie || "Sonstige";
          const datum = item.datum ? new Date(item.datum + "T00:00:00") : new Date();
          const sachkonto = getSachkonto(kategorie, "Betriebsausgabe", kontenrahmen, null);

          const ausgabe = await prisma.ausgabe.create({
            data: {
              datum,
              belegNr: item.belegNr?.trim() || null,
              beschreibung: item.beschreibung.trim(),
              betragNetto: item.betragNetto,
              mwstSatz: item.mwstSatz ?? 19,
              betragNetto2: item.betragNetto2 ?? null,
              mwstSatz2: item.betragNetto2 != null ? (item.mwstSatz2 ?? 19) : null,
              betragNetto3: item.betragNetto3 ?? null,
              mwstSatz3: item.betragNetto3 != null ? (item.mwstSatz3 ?? 0) : null,
              kategorie,
              lieferantId: item.lieferantId,
              buchungstyp: "Betriebsausgabe",
              sachkonto,
              erfasstVon: me?.benutzername ?? null,
            },
          });

          try {
            await uebernehmeBelegDatei(ausgabe.id, item.dateiPfad, item.beschreibung, item.belegNr, datum);
          } catch (err) {
            // Beleg-Übernahme ist nicht kritisch für die Ausgabe selbst — nur protokollieren
            Sentry.captureException(err);
          }

          await prisma.kiAusgabenBatchItem.update({
            where: { id: item.id },
            data: { status: "uebernommen", ausgabeId: ausgabe.id, fehlerText: null },
          });
          erstellt++;
        } catch (err) {
          Sentry.captureException(err);
          const message = err instanceof Error ? err.message : "Unbekannter Fehler";
          await prisma.kiAusgabenBatchItem.update({
            where: { id: item.id },
            data: { status: "fehler", fehlerText: message.slice(0, 500) },
          });
          fehlgeschlagen++;
        }
      }

      const nochOffen = await prisma.kiAusgabenBatchItem.count({
        where: { batchId: id, status: { in: ["wartet", "analysiert"] } },
      });
      await prisma.kiAusgabenBatch.update({
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
    console.error("KiAusgabenBatch PUT error:", e);
    return NextResponse.json({ error: "Aktion fehlgeschlagen" }, { status: 500 });
  }
}
