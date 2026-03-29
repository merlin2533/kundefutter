import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const entitaet = searchParams.get("entitaet") ?? undefined;
  const entitaetId = searchParams.get("entitaetId");
  const von = searchParams.get("von");
  const bis = searchParams.get("bis");
  const limit = Math.min(Number(searchParams.get("limit") ?? "50"), 200);
  const offset = Number(searchParams.get("offset") ?? "0");

  const where: Record<string, unknown> = {};

  if (entitaet) where.entitaet = entitaet;
  if (entitaetId) where.entitaetId = Number(entitaetId);

  if (von || bis) {
    where.zeitpunkt = {
      ...(von ? { gte: new Date(von) } : {}),
      ...(bis ? { lte: new Date(bis + "T23:59:59Z") } : {}),
    };
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { zeitpunkt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return NextResponse.json({ logs, total, limit, offset });
}
