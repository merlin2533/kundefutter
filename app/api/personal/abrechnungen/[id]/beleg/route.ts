import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { istPersonalSelbstbedienung, requireVollePersonalRechte } from "@/lib/permissions";
import { getModulConfig, requireModul } from "@/lib/modul-config";
import { getUploadBase } from "@/lib/upload";
import { writeFile, mkdir, unlink, readFile } from "fs/promises";
import path from "path";
import { Sentry } from "@/lib/sentry";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const UPLOAD_SUBDIR = "personal-abrechnungen";

/**
 * GET liefert das hochgeladene Original-PDF des Steuerberaters aus. Anders als der generische
 * `/api/uploads/[...path]`-Weg (der jeden eingeloggten Nutzer bedient) prüft diese Route zusätzlich
 * pro Aufruf, ob der Zugriff auf GENAU diese Gehaltsabrechnung erlaubt ist — Personal-Selbstbedienung
 * darf ausschließlich die eigene, bereits abgerechnete/ausgezahlte Abrechnung sehen (404 statt 403,
 * analog GET /api/personal/abrechnungen/[id]).
 */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const modul = await getModulConfig();
  const denyModul = requireModul(modul, "personal");
  if (denyModul) return denyModul;
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  const selbstbedienung = istPersonalSelbstbedienung(me);

  const { id } = await ctx.params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const abrechnung = await prisma.gehaltsabrechnung.findUnique({
      where: { id: numId },
      select: { mitarbeiterId: true, status: true, monat: true, jahr: true, belegPfad: true },
    });
    if (!abrechnung) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    if (selbstbedienung && (abrechnung.mitarbeiterId !== me.mitarbeiterId || abrechnung.status === "OFFEN")) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }
    if (!abrechnung.belegPfad) {
      return NextResponse.json({ error: "Kein PDF hinterlegt" }, { status: 404 });
    }

    const data = await readFile(path.join(getUploadBase(), abrechnung.belegPfad));
    const mm = String(abrechnung.monat).padStart(2, "0");
    const filename = `Lohnabrechnung_${mm}-${abrechnung.jahr}.pdf`;

    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    Sentry.captureException(err);
    const code = (err as { code?: string }).code;
    if (code === "ENOENT") return NextResponse.json({ error: "Datei nicht gefunden" }, { status: 404 });
    const isDev = process.env.NODE_ENV === "development";
    return NextResponse.json({ error: isDev && err instanceof Error ? err.message : "Interner Fehler" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const modul = await getModulConfig();
  const denyModul = requireModul(modul, "personal");
  if (denyModul) return denyModul;
  const me = await getCurrentUser();
  const deny = requireVollePersonalRechte(me);
  if (deny) return deny;

  const { id } = await ctx.params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const existing = await prisma.gehaltsabrechnung.findUnique({
      where: { id: numId },
      select: { id: true, belegPfad: true },
    });
    if (!existing) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "Keine Datei übergeben" }, { status: 400 });

    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: "Datei zu groß (max. 20 MB)" }, { status: 413 });
    }
    const ext = path.extname(file.name).toLowerCase();
    if (ext !== ".pdf" || (file.type && file.type !== "application/pdf")) {
      return NextResponse.json({ error: "Nur PDF-Dateien erlaubt" }, { status: 400 });
    }

    const uploadDir = path.join(getUploadBase(), UPLOAD_SUBDIR);
    await mkdir(uploadDir, { recursive: true });

    if (existing.belegPfad) {
      try {
        await unlink(path.join(getUploadBase(), existing.belegPfad));
      } catch (err) {
        Sentry.captureException(err);
        // Datei existiert nicht mehr — ignorieren
      }
    }

    const filename = `abrechnung-${numId}-${Date.now()}.pdf`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(uploadDir, filename), buffer);

    const relPfad = `${UPLOAD_SUBDIR}/${filename}`;
    await prisma.gehaltsabrechnung.update({
      where: { id: numId },
      data: { belegPfad: relPfad, belegDateiname: file.name },
    });

    return NextResponse.json({ ok: true, belegDateiname: file.name });
  } catch (err) {
    Sentry.captureException(err);
    const isDev = process.env.NODE_ENV === "development";
    return NextResponse.json({ error: isDev && err instanceof Error ? err.message : "Upload fehlgeschlagen" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const modul = await getModulConfig();
  const denyModul = requireModul(modul, "personal");
  if (denyModul) return denyModul;
  const me = await getCurrentUser();
  const deny = requireVollePersonalRechte(me);
  if (deny) return deny;

  const { id } = await ctx.params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const existing = await prisma.gehaltsabrechnung.findUnique({
      where: { id: numId },
      select: { belegPfad: true },
    });
    if (!existing) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    if (existing.belegPfad) {
      try {
        await unlink(path.join(getUploadBase(), existing.belegPfad));
      } catch (err) {
        Sentry.captureException(err);
        // ignore
      }
    }

    await prisma.gehaltsabrechnung.update({
      where: { id: numId },
      data: { belegPfad: null, belegDateiname: null },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err);
    const isDev = process.env.NODE_ENV === "development";
    return NextResponse.json({ error: isDev && err instanceof Error ? err.message : "Interner Fehler" }, { status: 500 });
  }
}
