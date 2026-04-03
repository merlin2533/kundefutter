import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Sanitize a string for use in filenames */
function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[äöüÄÖÜß]/g, (c) =>
      ({ ä: "ae", ö: "oe", ü: "ue", Ä: "Ae", Ö: "Oe", Ü: "Ue", ß: "ss" })[c] ?? c
    )
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 40);
}

/** Build date prefix string: YYYYMMDD */
function datumPrefix(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { id: idStr } = await ctx.params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const ausgabe = await prisma.ausgabe.findUnique({
      where: { id },
      select: { id: true, datum: true, belegNr: true, beschreibung: true, belegPfad: true },
    });
    if (!ausgabe) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "Keine Datei übergeben" }, { status: 400 });

    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: "Datei zu groß (max. 20 MB)" }, { status: 413 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Nur Bilddateien erlaubt" }, { status: 400 });
    }

    // Build year-based directory and descriptive filename
    const datum = ausgabe.datum;
    const year = datum.getFullYear();
    const prefix = datumPrefix(datum);
    const slug = slugify(ausgabe.belegNr || ausgabe.beschreibung || String(id));
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const filename = `${prefix}_${id}_${slug}.${ext}`;

    const uploadDir = path.join(process.cwd(), "public", "uploads", "belege", String(year));
    await mkdir(uploadDir, { recursive: true });

    // Remove old file if it exists
    if (ausgabe.belegPfad) {
      try {
        await unlink(path.join(process.cwd(), "public", ausgabe.belegPfad.replace(/^\//, "")));
      } catch {
        // Ignore missing file errors
      }
    }

    const bytes = await file.arrayBuffer();
    await writeFile(path.join(uploadDir, filename), Buffer.from(bytes));

    const belegPfad = `/uploads/belege/${year}/${filename}`;

    const updated = await prisma.ausgabe.update({
      where: { id },
      data: { belegPfad, belegDateiname: file.name },
    });

    return NextResponse.json({ belegPfad, belegDateiname: updated.belegDateiname });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Upload fehlgeschlagen" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id: idStr } = await ctx.params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const ausgabe = await prisma.ausgabe.findUnique({
      where: { id },
      select: { belegPfad: true },
    });
    if (!ausgabe) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    if (ausgabe.belegPfad) {
      try {
        await unlink(path.join(process.cwd(), "public", ausgabe.belegPfad.replace(/^\//, "")));
      } catch {
        // Ignore missing file
      }
    }

    await prisma.ausgabe.update({
      where: { id },
      data: { belegPfad: null, belegDateiname: null },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
