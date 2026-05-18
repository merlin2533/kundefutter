import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUploadBase } from "@/lib/upload";
import { writeFile, mkdir } from "fs/promises";
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

    const uploadDir = path.join(getUploadBase(), "zertifizierungen");
    await mkdir(uploadDir, { recursive: true });

    const ext = path.extname(file.name) || ".bin";
    const filename = `zert-${id}-${Date.now()}${ext}`;
    const filepath = path.join(uploadDir, filename);

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filepath, buffer);

    const relPfad = `zertifizierungen/${filename}`;

    const updated = await prisma.zertifizierung.update({
      where: { id },
      data: {
        belegpfad: relPfad,
        belegname: file.name,
      },
    });

    return NextResponse.json({ ok: true, belegpfad: relPfad, belegname: file.name, id: updated.id });
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Fehler beim Upload";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
