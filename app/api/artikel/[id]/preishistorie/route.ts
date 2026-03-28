import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const historie = await prisma.artikelPreisHistorie.findMany({
    where: { artikelId: Number(id) },
    orderBy: { geaendertAm: "desc" },
  });
  return NextResponse.json(historie);
}
