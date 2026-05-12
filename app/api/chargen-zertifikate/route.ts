import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUploadBase } from "@/lib/upload";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const chargeNr = searchParams.get("chargeNr");
  if (!chargeNr || chargeNr.trim().length < 2) {
    return NextResponse.json({ error: "chargeNr erforderlich (mind. 2 Zeichen)" }, { status: 400 });
  }

  try {
    const zertifikate = await prisma.chargenZertifikat.findMany({
      where: { chargeNr: { contains: chargeNr.trim() } },
      include: {
        artikel: { select: { id: true, name: true, artikelnummer: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return NextResponse.json(zertifikate);
  } catch (e) {
    console.error("ChargenZertifikate GET error:", e);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Ungültige Formulardaten" }, { status: 400 });
  }

  const chargeNr = formData.get("chargeNr");
  const artikelIdRaw = formData.get("artikelId");
  const notiz = formData.get("notiz");
  const file = formData.get("datei") as File | null;

  if (!chargeNr || String(chargeNr).trim() === "")
    return NextResponse.json({ error: "chargeNr ist erforderlich" }, { status: 400 });
  if (!artikelIdRaw)
    return NextResponse.json({ error: "artikelId ist erforderlich" }, { status: 400 });

  const artikelId = parseInt(String(artikelIdRaw), 10);
  if (isNaN(artikelId))
    return NextResponse.json({ error: "Ungültige artikelId" }, { status: 400 });

  if (!file || !(file instanceof File))
    return NextResponse.json({ error: "Datei ist erforderlich" }, { status: 400 });

  // Verify article exists
  try {
    const artikel = await prisma.artikel.findUnique({ where: { id: artikelId }, select: { id: true } });
    if (!artikel) return NextResponse.json({ error: "Artikel nicht gefunden" }, { status: 404 });
  } catch (e) {
    console.error("Artikel check error:", e);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }

  // Save file
  const base = getUploadBase();
  const dir = path.join(base, "zertifikate");
  await mkdir(dir, { recursive: true });

  const originalName = file.name;
  const ext = path.extname(originalName);
  const safeName = `${Date.now()}_${artikelId}_${String(chargeNr).replace(/[^a-zA-Z0-9-_]/g, "_")}${ext}`;
  const filePath = path.join(dir, safeName);
  const arrayBuffer = await file.arrayBuffer();
  await writeFile(filePath, Buffer.from(arrayBuffer));

  const relativePfad = `zertifikate/${safeName}`;

  try {
    const zertifikat = await prisma.chargenZertifikat.create({
      data: {
        chargeNr: String(chargeNr).trim(),
        artikelId,
        dateiname: originalName,
        pfad: relativePfad,
        typ: file.type || null,
        groesse: file.size,
        notiz: notiz ? String(notiz) : null,
      },
      include: {
        artikel: { select: { id: true, name: true, artikelnummer: true } },
      },
    });
    return NextResponse.json(zertifikat, { status: 201 });
  } catch (err) {
    console.error("ChargenZertifikat POST error:", err);
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
