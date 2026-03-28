import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const kundeId = parseInt(id);
  const notizen = await prisma.kundeNotiz.findMany({
    where: { kundeId },
    orderBy: { erstellt: "desc" },
  });
  return NextResponse.json(notizen);
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const kundeId = parseInt(id);
  const { text, thema } = await req.json();
  if (!text?.trim()) return NextResponse.json({ error: "Text fehlt" }, { status: 400 });
  const notiz = await prisma.kundeNotiz.create({
    data: { kundeId, text: text.trim(), thema: thema || null },
  });
  return NextResponse.json(notiz, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const kundeId = parseInt(id);
  const notizId = parseInt(req.nextUrl.searchParams.get("notizId") ?? "0");
  if (!notizId) return NextResponse.json({ error: "notizId fehlt" }, { status: 400 });
  await prisma.kundeNotiz.deleteMany({ where: { id: notizId, kundeId } });
  return NextResponse.json({ ok: true });
}
