import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { getUploadBase } from "@/lib/upload";

type Params = { params: Promise<{ id: string }> };

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const artikelId = parseInt(id, 10);
  if (isNaN(artikelId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });
  try {
    const docs = await prisma.artikelDokument.findMany({
      where: { artikelId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(docs);
  } catch {
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const artikelId = parseInt(id, 10);
  if (isNaN(artikelId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Keine Datei übergeben" }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "Datei ist leer" }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "Datei zu groß (max. 25 MB)" }, { status: 413 });
    }

    const name = (formData.get("name") as string | null)?.trim() || file.name;
    const notiz = (formData.get("notiz") as string | null) ?? null;

    // Zielverzeichnis: /data/uploads/artikel/{id}/ (Docker) oder ./uploads/... (lokal)
    const base = getUploadBase();
    const uploadDir = path.join(base, "artikel", String(artikelId));
    await mkdir(uploadDir, { recursive: true });

    const safeOriginal = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
    const safeName = `${Date.now()}_${safeOriginal || "datei"}`;
    const filePath = path.join(uploadDir, safeName);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    // Relativer Pfad (ohne Basis), den der Download-Endpoint wieder auflöst
    const pfadRel = `artikel/${artikelId}/${safeName}`;

    const doc = await prisma.artikelDokument.create({
      data: {
        artikelId,
        name,
        dateiname: file.name,
        pfad: pfadRel,
        typ: file.type || null,
        groesse: file.size,
        notiz,
      },
    });
    return NextResponse.json(doc, { status: 201 });
  } catch (err) {
    console.error("[artikel/dokumente] upload failed:", err);
    const message = err instanceof Error ? err.message : "Upload fehlgeschlagen";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
