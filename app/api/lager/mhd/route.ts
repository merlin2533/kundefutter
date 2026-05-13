import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export async function GET() {

  try {
    const positionen = await prisma.wareineingangPosition.findMany({
      where: { mhd: { not: null } },
      select: {
        id: true,
        mhd: true,
        menge: true,
        chargeNr: true,
        artikel: { select: { id: true, name: true, einheit: true } },
        wareneingang: { select: { datum: true } },
      },
      orderBy: { mhd: "asc" },
      take: 500,
    });

    return NextResponse.json(positionen);
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    return NextResponse.json(
      { error: isDev && err instanceof Error ? err.message : "Interner Fehler" },
      { status: 500 }
    );
  }
}
