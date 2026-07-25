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

export async function GET() {
  try {
    const batches = await prisma.kiEingangsrechnungBatch.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { items: { select: { status: true } } },
    });
    const result = batches.map((b) => {
      const counts: Record<string, number> = {};
      for (const it of b.items) counts[it.status] = (counts[it.status] ?? 0) + 1;
      return {
        id: b.id,
        status: b.status,
        notiz: b.notiz,
        createdAt: b.createdAt,
        abgeschlossenAm: b.abgeschlossenAm,
        itemCount: b.items.length,
        counts,
      };
    });
    return NextResponse.json(result);
  } catch (e) {
    Sentry.captureException(e);
    console.error("KiEingangsrechnungBatch GET error:", e);
    return NextResponse.json({ error: "Datenbankfehler beim Laden der Batches" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("files").filter((f): f is File => f instanceof File);
    if (files.length === 0) {
      return NextResponse.json({ error: "Keine Dateien übermittelt" }, { status: 400 });
    }
    if (files.length > MAX_DATEIEN) {
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

    const batch = await prisma.kiEingangsrechnungBatch.create({ data: {} });
    const uploadDir = path.join(getUploadBase(), "ki-eingangsrechnung-batch", String(batch.id));
    await mkdir(uploadDir, { recursive: true });

    const items = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = path.extname(file.name).toLowerCase() || ".jpg";
      const filename = `${i + 1}${ext}`;
      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(path.join(uploadDir, filename), buffer);
      const item = await prisma.kiEingangsrechnungBatchItem.create({
        data: {
          batchId: batch.id,
          reihenfolge: i,
          dateiPfad: `ki-eingangsrechnung-batch/${batch.id}/${filename}`,
          dateiName: file.name,
        },
      });
      items.push(item);
    }

    return NextResponse.json({ id: batch.id, items }, { status: 201 });
  } catch (e) {
    Sentry.captureException(e);
    console.error("KiEingangsrechnungBatch POST error:", e);
    return NextResponse.json({ error: "Batch konnte nicht angelegt werden" }, { status: 500 });
  }
}
