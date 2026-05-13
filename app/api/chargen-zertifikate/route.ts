import { NextRequest, NextResponse } from "next/server";
import { validateSession } from "@/lib/auth";
import { getUploadBase } from "@/lib/upload";
import prisma from "@/lib/prisma";
import path from "path";
import fs from "fs/promises";

// GET /api/chargen-zertifikate?chargeNr=X
export async function GET(req: NextRequest) {
  const session = await validateSession(req);
  if (!session) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const chargeNr = req.nextUrl.searchParams.get("chargeNr") ?? "";
  try {
    const where = chargeNr ? { chargeNr: { contains: chargeNr } } : {};
    const zertifikate = await prisma.chargenZertifikat.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return NextResponse.json(zertifikate);
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/chargen-zertifikate (multipart/form-data)
export async function POST(req: NextRequest) {
  const session = await validateSession(req);
  if (!session) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  try {
    const fd = await req.formData();
    const chargeNr = (fd.get("chargeNr") as string | null)?.trim() ?? "";
    const beschreibung = (fd.get("beschreibung") as string | null)?.trim() ?? "";
    const datei = fd.get("datei") as File | null;

    if (!chargeNr) return NextResponse.json({ error: "Chargennummer erforderlich" }, { status: 400 });
    if (!datei) return NextResponse.json({ error: "Datei erforderlich" }, { status: 400 });

    const uploadBase = getUploadBase();
    const dir = path.join(uploadBase, "chargen-zertifikate");
    await fs.mkdir(dir, { recursive: true });

    const safeName = datei.name.replace(/[^a-zA-Z0-9._\-]/g, "_");
    const fileName = `${Date.now()}_${safeName}`;
    const filePath = path.join(dir, fileName);
    const bytes = await datei.arrayBuffer();
    await fs.writeFile(filePath, Buffer.from(bytes));

    const relPath = path.join("chargen-zertifikate", fileName);

    const record = await prisma.chargenZertifikat.create({
      data: {
        chargeNr,
        beschreibung: beschreibung || null,
        dateiName: datei.name,
        pfad: relPath,
      },
    });
    return NextResponse.json(record, { status: 201 });
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
