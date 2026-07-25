import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Sentry } from "@/lib/sentry";
import { getUploadBase } from "@/lib/upload";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".pdf"]);
const MAX_DATEIEN = 30;
const MAX_DATEIGROESSE = 20 * 1024 * 1024;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const { id: idStr } = await ctx.params;
  const batchId = parseInt(idStr, 10);
  if (isNaN(batchId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const batch = await prisma.kiEingangsrechnungBatch.findUnique({
      where: { id: batchId },
      include: { items: { select: { id: true } } },
    });
    if (!batch) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    if (batch.status === "abgeschlossen" || batch.status === "verworfen") {
      return NextResponse.json({ error: "Batch ist bereits abgeschlossen oder verworfen" }, { status: 400 });
    }

    const formData = await req.formData();
    const files = formData.getAll("files").filter((f): f is File => f instanceof File);
    if (files.length === 0) {
      return NextResponse.json({ error: "Keine Dateien übermittelt" }, { status: 400 });
    }
    if (batch.items.length + files.length > MAX_DATEIEN) {
      return NextResponse.json({ error: `Maximal ${MAX_DATEIEN} Dateien pro Batch` }, { status: 400 });
    }
    for (const f of files) {
      if (f.size > MAX_DATEIGROESSE) {
        return NextResponse.json({ error: `Datei "${f.name}" ist zu groß (max. 20 MB)` }, { status: 413 });
      }
      const ext = path.extname(f.name).toLowerCase();
      if (ext && !ALLOWED_EXT.has(ext)) {
        return NextResponse.json({ error: `Dateityp von "${f.name}" nicht erlaubt` }, { status: 400 });
      }
    }

    const uploadDir = path.join(getUploadBase(), "ki-eingangsrechnung-batch", String(batch.id));
    await mkdir(uploadDir, { recursive: true });

    const start = batch.items.length;
    const items = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = path.extname(file.name).toLowerCase() || ".jpg";
      const filename = `${start + i + 1}${ext}`;
      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(path.join(uploadDir, filename), buffer);
      const item = await prisma.kiEingangsrechnungBatchItem.create({
        data: {
          batchId: batch.id,
          reihenfolge: start + i,
          dateiPfad: `ki-eingangsrechnung-batch/${batch.id}/${filename}`,
          dateiName: file.name,
        },
      });
      items.push(item);
    }

    // Batch ggf. wieder auf "offen" setzen, falls bereits als "bereit" markiert
    if (batch.status === "bereit") {
      await prisma.kiEingangsrechnungBatch.update({ where: { id: batchId }, data: { status: "offen" } });
    }

    return NextResponse.json({ items }, { status: 201 });
  } catch (e) {
    Sentry.captureException(e);
    console.error("KiEingangsrechnungBatchItem POST error:", e);
    return NextResponse.json({ error: "Dateien konnten nicht hinzugefügt werden" }, { status: 500 });
  }
}
