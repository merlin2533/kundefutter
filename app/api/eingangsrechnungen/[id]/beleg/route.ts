import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUploadBase } from "@/lib/upload";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import { Sentry } from "@/lib/sentry";
import { isNextcloudKonfiguriert, uploadZuBuchhaltung } from "@/lib/nextcloud";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const { id: idStr } = await ctx.params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "Keine Datei" }, { status: 400 });

    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: "Datei zu groß (max. 20 MB)" }, { status: 413 });
    }

    const ALLOWED_EXT = new Set([".pdf", ".jpg", ".jpeg", ".png", ".webp"]);
    const ext = path.extname(file.name).toLowerCase() || ".bin";
    if (!ALLOWED_EXT.has(ext)) {
      return NextResponse.json({ error: "Nur PDF, JPG, PNG oder WEBP erlaubt" }, { status: 400 });
    }

    const existing = await prisma.eingangsRechnung.findUnique({
      where: { id },
      select: { id: true, belegpfad: true, nummer: true, datum: true },
    });
    if (!existing) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    const uploadDir = path.join(getUploadBase(), "eingangsrechnungen");
    await mkdir(uploadDir, { recursive: true });

    if (existing.belegpfad) {
      try {
        await unlink(path.join(getUploadBase(), existing.belegpfad));
      } catch (err) {
        Sentry.captureException(err);
        // Datei existiert nicht mehr — ignorieren
      }
    }

    const filename = `eingangsrechnung-${id}-${Date.now()}${ext}`;
    const filepath = path.join(uploadDir, filename);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filepath, buffer);

    const relPfad = `eingangsrechnungen/${filename}`;

    await prisma.eingangsRechnung.update({
      where: { id },
      data: { belegpfad: relPfad },
    });

    // Fire-and-forget: Beleg nach Nextcloud (Buchhaltung) spiegeln
    const zielName = `Eingangsrechnung_${existing.nummer ?? id}_${file.name}`;
    isNextcloudKonfiguriert()
      .then(async (ok) => {
        if (!ok) return;
        await uploadZuBuchhaltung(
          existing.datum.getFullYear(),
          existing.datum.getMonth() + 1,
          "Eingangsrechnungen",
          zielName,
          buffer,
          file.type || undefined
        );
      })
      .catch((e: unknown) => {
        Sentry.captureException(e);
        console.warn("[nextcloud] Eingangsrechnung-Beleg-Upload fehlgeschlagen:", e instanceof Error ? e.message : e);
      });

    return NextResponse.json({ ok: true, belegpfad: relPfad });
  } catch (err) {
    Sentry.captureException(err);
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Upload fehlgeschlagen";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id: idStr } = await ctx.params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const existing = await prisma.eingangsRechnung.findUnique({
      where: { id },
      select: { belegpfad: true },
    });
    if (!existing) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    if (existing.belegpfad) {
      try {
        await unlink(path.join(getUploadBase(), existing.belegpfad));
      } catch (err) {
        Sentry.captureException(err);
        // ignore
      }
    }

    await prisma.eingangsRechnung.update({
      where: { id },
      data: { belegpfad: null },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err);
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Datenbankfehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
