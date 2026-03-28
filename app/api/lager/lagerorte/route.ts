import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const lagerorte = await prisma.artikel.findMany({
    where: { lagerort: { not: null } },
    select: { lagerort: true },
    distinct: ["lagerort"],
  });

  const values = lagerorte
    .map((a) => a.lagerort)
    .filter((l): l is string => l !== null);

  return NextResponse.json(values);
}
