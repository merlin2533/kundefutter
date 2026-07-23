import { NextRequest, NextResponse } from "next/server";
import { getUploadBase } from "@/lib/upload";
import { prisma } from "@/lib/prisma";
import path from "path";
import fs from "fs/promises";
import { Sentry } from "@/lib/sentry";
import { isNextcloudKonfiguriert, uploadZuArtikelOrdner } from "@/lib/nextcloud";

export const dynamic = "force-dynamic";

// GET /api/chargen-zertifikate?chargeNr=X
export async function GET(req: NextRequest) {
  const chargeNr = req.nextUrl.searchParams.get("chargeNr") ?? "";
  try {
    const where = chargeNr ? { chargeNr: { contains: chargeNr } } : {};
    const zertifikate = await prisma.chargenZertifikat.findMany({
      where,
      include: { artikel: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return NextResponse.json(zertifikate);
  } catch (err) {
    Sentry.captureException(err);
    const isDev = process.env.NODE_ENV === "development";
    return NextResponse.json(
      { error: isDev && err instanceof Error ? err.message : "Interner Fehler" },
      { status: 500 }
    );
  }
}

// POST /api/chargen-zertifikate (multipart/form-data)
export async function POST(req: NextRequest) {
  try {
    const fd = await req.formData();
    const chargeNr = (fd.get("chargeNr") as string | null)?.trim() ?? "";
    const artikelId = parseInt((fd.get("artikelId") as string | null) ?? "", 10);
    const notiz = (fd.get("notiz") as string | null)?.trim() ?? "";
    const datei = fd.get("datei") as File | null;

    if (!chargeNr) return NextResponse.json({ error: "Chargennummer erforderlich" }, { status: 400 });
    if (isNaN(artikelId)) return NextResponse.json({ error: "Artikel-ID erforderlich" }, { status: 400 });
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
        artikelId,
        dateiname: datei.name,
        pfad: relPath,
        typ: datei.type || null,
        groesse: datei.size,
        notiz: notiz || null,
      },
    });

    // Fire-and-forget: Chargenzertifikat nach Nextcloud spiegeln
    isNextcloudKonfiguriert()
      .then(async (ok) => {
        if (!ok) return;
        const artikel = await prisma.artikel.findUnique({ where: { id: artikelId }, select: { name: true } });
        if (!artikel) return;
        await uploadZuArtikelOrdner(artikelId, artikel.name, "Chargenzertifikate", `${chargeNr}_${datei.name}`, Buffer.from(bytes), datei.type || undefined);
      })
      .catch((e: unknown) => {
        Sentry.captureException(e);
        console.warn("[nextcloud] Chargenzertifikat-Upload fehlgeschlagen:", e instanceof Error ? e.message : e);
      });

    return NextResponse.json(record, { status: 201 });
  } catch (err) {
    Sentry.captureException(err);
    const isDev = process.env.NODE_ENV === "development";
    return NextResponse.json(
      { error: isDev && err instanceof Error ? err.message : "Interner Fehler" },
      { status: 500 }
    );
  }
}
