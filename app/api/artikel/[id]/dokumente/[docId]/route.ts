import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readFile, unlink } from "fs/promises";
import { resolveUploadPath } from "@/lib/upload";

type Params = { params: Promise<{ id: string; docId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { docId } = await params;
  const docIdNum = parseInt(docId, 10);
  if (isNaN(docIdNum)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const doc = await prisma.artikelDokument.findUnique({ where: { id: docIdNum } });
    if (!doc) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    const filePath = resolveUploadPath(doc.pfad);
    let buffer: Buffer;
    try {
      buffer = await readFile(filePath);
    } catch {
      return NextResponse.json({ error: "Datei nicht auf Server gefunden" }, { status: 404 });
    }

    const inline = req.nextUrl.searchParams.get("download") !== "1";
    const disposition = `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(doc.dateiname)}"`;
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": doc.typ || "application/octet-stream",
        "Content-Length": String(buffer.length),
        "Content-Disposition": disposition,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (err) {
    console.error("[artikel/dokumente] download failed:", err);
    return NextResponse.json({ error: "Fehler beim Laden" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { docId } = await params;
  const docIdNum = parseInt(docId, 10);
  if (isNaN(docIdNum)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const doc = await prisma.artikelDokument.findUnique({ where: { id: docIdNum } });
    if (!doc) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    // Datei best-effort löschen
    try {
      await unlink(resolveUploadPath(doc.pfad));
    } catch {
      // ignorieren
    }
    await prisma.artikelDokument.delete({ where: { id: docIdNum } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[artikel/dokumente] delete failed:", err);
    return NextResponse.json({ error: "Fehler beim Löschen" }, { status: 500 });
  }
}
