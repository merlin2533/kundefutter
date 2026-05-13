import { NextRequest, NextResponse } from "next/server";
import { validateSession } from "@/lib/auth";
import { resolveUploadPath } from "@/lib/upload";
import prisma from "@/lib/prisma";
import fs from "fs/promises";
import path from "path";

type Params = { params: Promise<{ id: string }> };

// GET /api/chargen-zertifikate/[id] — Download
export async function GET(req: NextRequest, ctx: Params) {
  const session = await validateSession(req);
  if (!session) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const { id } = await ctx.params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const record = await prisma.chargenZertifikat.findUnique({ where: { id: numId } });
    if (!record) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    const filePath = resolveUploadPath(record.pfad);
    const data = await fs.readFile(filePath);
    const ext = path.extname(record.dateiName).toLowerCase();
    const contentType =
      ext === ".pdf" ? "application/pdf" :
      ext === ".png" ? "image/png" :
      ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" :
      "application/octet-stream";

    return new NextResponse(data, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(record.dateiName)}"`,
      },
    });
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Datei nicht abrufbar";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/chargen-zertifikate/[id]
export async function DELETE(req: NextRequest, ctx: Params) {
  const session = await validateSession(req);
  if (!session) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

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
    const msg = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
