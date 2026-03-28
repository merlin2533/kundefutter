import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const artikelId = searchParams.get("artikelId");
  const typ = searchParams.get("typ");
  const von = searchParams.get("von");
  const bis = searchParams.get("bis");

  const where: Record<string, unknown> = {};
  if (artikelId) where.artikelId = Number(artikelId);
  if (typ) where.typ = typ;
  if (von || bis) {
    where.datum = {
      ...(von && { gte: new Date(von) }),
      ...(bis && { lte: new Date(bis) }),
    };
  }

  const bewegungen = await prisma.lagerbewegung.findMany({
    where,
    include: { artikel: true },
    orderBy: { datum: "desc" },
    take: 500,
  });
  return NextResponse.json(bewegungen);
}
