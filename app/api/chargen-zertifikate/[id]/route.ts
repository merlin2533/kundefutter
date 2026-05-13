import { NextRequest, NextResponse } from "next/server";
import { resolveUploadPath } from "@/lib/upload";
import { prisma } from "@/lib/prisma";
import fs from "fs/promises";
import path from "path";

type Params = { params: Promise<{ id: string }> };

// GET /api/chargen-zertifikate/[id] — Download
export async function GET(req: NextRequest, ctx: Params) {
  const { id } = await ctx.params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const record = await prisma.chargenZertifikat.findUnique({ where: { id: numId } });
    if (!record) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    const filePath = resolveUploadPath(record.pfad);
    const data = await fs.readFile(filePath);
    const ext = path.extname(record.dateiname).toLowerCase();
    const contentType =
      ext === ".pdf" ? "application/pdf" :
      ext === ".png" ? "image/png" :
      ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" :
      record.typ ?? "application/octet-stream";

    return new NextResponse(data, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(record.dateiname)}"`,
      },
    });
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    return NextResponse.json(
      { error: isDev && err instanceof Error ? err.message : "Datei nicht abrufbar" },
      { status: 500 }
    );
  }
}

// DELETE /api/chargen-zertifikate/[id]
export async function DELETE(req: NextRequest, ctx: Params) {
  const { id } = await ctx.params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const record = await prisma.chargenZertifikat.findUnique({ where: { id: numId } });
    if (!record) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    const filePath = resolveUploadPath(record.pfad);
    await fs.unlink(filePath).catch(() => {});
    await prisma.chargenZertifikat.delete({ where: { id: numId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    return NextResponse.json(
      { error: isDev && err instanceof Error ? err.message : "Interner Fehler" },
      { status: 500 }
    );
  }
}
