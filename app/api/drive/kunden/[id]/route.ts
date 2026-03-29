import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getKundenOrdnerId, listeDateien, uploadDatei } from "@/lib/googleDrive";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const kundeId = parseInt(id);
  if (isNaN(kundeId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  const kunde = await prisma.kunde.findUnique({ where: { id: kundeId }, select: { id: true, name: true } });
  if (!kunde) return NextResponse.json({ error: "Kunde nicht gefunden" }, { status: 404 });

  try {
    const folderId = await getKundenOrdnerId(kundeId, kunde.name);
    const dateien = await listeDateien(folderId);
    const driveUrl = `https://drive.google.com/drive/folders/${folderId}`;
    return NextResponse.json({ folderId, driveUrl, dateien });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("nicht konfiguriert")) {
      return NextResponse.json({ error: msg, nichtKonfiguriert: true }, { status: 503 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const kundeId = parseInt(id);
  if (isNaN(kundeId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  const kunde = await prisma.kunde.findUnique({ where: { id: kundeId }, select: { id: true, name: true } });
  if (!kunde) return NextResponse.json({ error: "Kunde nicht gefunden" }, { status: 404 });

  const formData = await req.formData();
  const datei = formData.get("datei") as File | null;
  if (!datei) return NextResponse.json({ error: "Keine Datei übermittelt" }, { status: 400 });

  const MAX_SIZE = 25 * 1024 * 1024;
  if (datei.size > MAX_SIZE) {
    return NextResponse.json({ error: "Datei zu groß (max. 25 MB)" }, { status: 400 });
  }

  try {
    const folderId = await getKundenOrdnerId(kundeId, kunde.name);
    const buffer = Buffer.from(await datei.arrayBuffer());
    const result = await uploadDatei(folderId, datei.name, datei.type || "application/octet-stream", buffer);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
