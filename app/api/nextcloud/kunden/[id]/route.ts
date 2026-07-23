import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { kundenOrdnerPfad, listeDateien, uploadDatei } from "@/lib/nextcloud";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";


type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const kundeId = parseInt(id, 10);
  if (isNaN(kundeId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  const kunde = await prisma.kunde.findUnique({ where: { id: kundeId }, select: { id: true, name: true } });
  if (!kunde) return NextResponse.json({ error: "Kunde nicht gefunden" }, { status: 404 });

  try {
    const pfad = kundenOrdnerPfad(kundeId, kunde.name);
    const dateien = await listeDateien(pfad);
    const url = dateien[0]?.webViewLink ?? null;
    return NextResponse.json({ pfad, url, dateien });
  } catch (e) {
    Sentry.captureException(e);
    const rawMsg = e instanceof Error ? e.message : String(e);
    if (rawMsg.includes("nicht konfiguriert")) {
      return NextResponse.json({ error: rawMsg, nichtKonfiguriert: true }, { status: 503 });
    }
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev ? rawMsg : "Interner Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const kundeId = parseInt(id, 10);
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
    const pfad = kundenOrdnerPfad(kundeId, kunde.name);
    const buffer = Buffer.from(await datei.arrayBuffer());
    const result = await uploadDatei(pfad, datei.name, buffer, datei.type || "application/octet-stream");
    return NextResponse.json(result);
  } catch (e) {
    Sentry.captureException(e);
    const rawMsg = e instanceof Error ? e.message : String(e);
    if (rawMsg.includes("nicht konfiguriert")) {
      return NextResponse.json({ error: rawMsg, nichtKonfiguriert: true }, { status: 503 });
    }
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev ? rawMsg : "Interner Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
