import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { artikelOrdnerPfad, listeDateien } from "@/lib/nextcloud";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";


type Ctx = { params: Promise<{ id: string }> };

// Nur Lesezugriff: ArtikelDokument + ChargenZertifikat werden lokal erfasst und
// automatisch nach Nextcloud gespiegelt (siehe die jeweiligen Upload-Routen) —
// ein zusätzlicher manueller Direkt-Upload hierher entfällt bewusst.
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const artikelId = parseInt(id, 10);
  if (isNaN(artikelId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  const artikel = await prisma.artikel.findUnique({ where: { id: artikelId }, select: { id: true, name: true } });
  if (!artikel) return NextResponse.json({ error: "Artikel nicht gefunden" }, { status: 404 });

  try {
    const pfad = artikelOrdnerPfad(artikelId, artikel.name);
    const [dokumente, chargenzertifikate] = await Promise.all([
      listeDateien(`${pfad}/Dokumente`),
      listeDateien(`${pfad}/Chargenzertifikate`),
    ]);
    const dateien = [...dokumente, ...chargenzertifikate];
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
