import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const docs = await prisma.artikelDokument.findMany({
    where: { artikelId: Number(id) },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(docs);
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const formData = await req.formData();
  const file = formData.get("file") as File;
  const name = (formData.get("name") as string) || file.name;
  const notiz = formData.get("notiz") as string | null;

  if (!file) return NextResponse.json({ error: "Keine Datei" }, { status: 400 });

  const uploadDir = path.join(process.cwd(), "public", "uploads", "artikel", id);
  await mkdir(uploadDir, { recursive: true });

  const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const filePath = path.join(uploadDir, safeName);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);

  const doc = await prisma.artikelDokument.create({
    data: {
      artikelId: Number(id),
      name,
      dateiname: file.name,
      pfad: `/uploads/artikel/${id}/${safeName}`,
      typ: file.type,
      groesse: file.size,
      notiz,
    },
  });
  return NextResponse.json(doc, { status: 201 });
}
