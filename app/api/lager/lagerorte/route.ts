import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";


export async function GET() {
  try {
    const lagerorte = await prisma.artikel.findMany({
      where: { lagerort: { not: null } },
      select: { lagerort: true },
      distinct: ["lagerort"],
    });

    const values = lagerorte
      .map((a) => a.lagerort)
      .filter((l): l is string => l !== null);

    return NextResponse.json(values);
  } catch (e) {
    console.error("Lagerorte GET error:", e);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
