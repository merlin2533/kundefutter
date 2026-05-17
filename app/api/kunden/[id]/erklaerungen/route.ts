import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { getUploadBase } from "@/lib/upload";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const kundeId = parseInt(id, 10);
  if (isNaN(kundeId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const erklaerungen = await prisma.kundeSprengstoffErklaerung.findMany({
      where: { kundeId },
      orderBy: { jahr: "desc" },
    });
    return NextResponse.json(erklaerungen);
  } catch {
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const kundeId = parseInt(id, 10);
  if (isNaN(kundeId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  const isDev = process.env.NODE_ENV === "development";

  try {
    const contentType = req.headers.get("content-type") ?? "";

    let jahr: number;
    let datum: Date;
    let notiz: string | null = null;
    let dokumentPfad: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      jahr = parseInt(String(formData.get("jahr") ?? ""), 10);
      const datumStr = String(formData.get("datum") ?? "");
      datum = new Date(datumStr);
      notiz = formData.get("notiz") ? String(formData.get("notiz")) : null;

      const file = formData.get("dokument") as File | null;
      if (file && file.size > 0) {
        const erklaerungDir = path.join(getUploadBase(), "erklaerungen");
        await mkdir(erklaerungDir, { recursive: true });
        const ext = file.name.split(".").pop() ?? "bin";
        const filename = `kunde_${kundeId}_${jahr}_${Date.now()}.${ext}`;
        const dest = path.join(erklaerungDir, filename);
        const buffer = Buffer.from(await file.arrayBuffer());
        await writeFile(dest, buffer);
        dokumentPfad = `erklaerungen/${filename}`;
      }
    } else {
      const body = await req.json();
      jahr = parseInt(String(body.jahr ?? ""), 10);
      datum = new Date(String(body.datum ?? ""));
      notiz = body.notiz ? String(body.notiz) : null;
    }

    if (!jahr || isNaN(jahr) || jahr < 2000 || jahr > 2100) {
      return NextResponse.json({ error: "Ungültiges Jahr" }, { status: 400 });
    }
    if (isNaN(datum.getTime())) {
      return NextResponse.json({ error: "Ungültiges Datum" }, { status: 400 });
    }

    const erklaerung = await prisma.kundeSprengstoffErklaerung.upsert({
      where: { kundeId_jahr: { kundeId, jahr } },
      update: { datum, notiz, dokumentPfad },
      create: { kundeId, jahr, datum, notiz, dokumentPfad },
    });

    return NextResponse.json(erklaerung, { status: 201 });
  } catch (err) {
    console.error("Erklaerung POST error:", err);
    const msg = isDev && err instanceof Error ? err.message : "Erklärung konnte nicht gespeichert werden";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
