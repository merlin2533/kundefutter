import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUploadBase } from "@/lib/upload";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
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

    const existing = await prisma.sachkundenachweis.findUnique({
      where: { id },
      select: { id: true, belegPfad: true },
    });
    if (!existing) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    const uploadDir = path.join(getUploadBase(), "sachkunde");
    await mkdir(uploadDir, { recursive: true });

    // Remove old file if present
    if (existing.belegPfad) {
      try {
        const oldAbs = path.join(getUploadBase(), existing.belegPfad.replace(/^sachkunde\//, "sachkunde/"));
        await unlink(oldAbs);
      } catch {
        // ignore missing file
      }
    }

    const filename = `sachkunde-${id}-${Date.now()}${ext}`;
    const filepath = path.join(uploadDir, filename);
    await writeFile(filepath, Buffer.from(await file.arrayBuffer()));

    const relPfad = `sachkunde/${filename}`;

    await prisma.sachkundenachweis.update({
      where: { id },
      data: { belegPfad: relPfad, belegName: file.name },
    });

    return NextResponse.json({ ok: true, belegPfad: relPfad, belegName: file.name });
  } catch (err) {
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
    const existing = await prisma.sachkundenachweis.findUnique({
      where: { id },
      select: { belegPfad: true },
    });
    if (!existing) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    if (existing.belegPfad) {
      try {
        await unlink(path.join(getUploadBase(), existing.belegPfad));
      } catch {
        // ignore
      }
    }

    await prisma.sachkundenachweis.update({
      where: { id },
      data: { belegPfad: null, belegName: null },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Datenbankfehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
