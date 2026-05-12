import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveUploadPath } from "@/lib/upload";
import { readFile, unlink } from "fs/promises";
import { existsSync } from "fs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const zertifikat = await prisma.chargenZertifikat.findUnique({ where: { id: numId } });
    if (!zertifikat) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    const absolutePath = resolveUploadPath(zertifikat.pfad);
    if (!existsSync(absolutePath)) {
      return NextResponse.json({ error: "Datei nicht vorhanden" }, { status: 404 });
    }

    const buffer = await readFile(absolutePath);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": zertifikat.typ || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(zertifikat.dateiname)}"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch (e) {
    console.error("ChargenZertifikat GET error:", e);
    return NextResponse.json({ error: "Fehler beim Lesen der Datei" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const zertifikat = await prisma.chargenZertifikat.findUnique({ where: { id: numId } });
    if (!zertifikat) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    // Delete file from disk
    const absolutePath = resolveUploadPath(zertifikat.pfad);
    if (existsSync(absolutePath)) {
      try {
        await unlink(absolutePath);
      } catch (e) {
        console.warn("Zertifikat file delete failed:", e);
      }
    }

    await prisma.chargenZertifikat.delete({ where: { id: numId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("P2025")) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }
    console.error("ChargenZertifikat DELETE error:", err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
