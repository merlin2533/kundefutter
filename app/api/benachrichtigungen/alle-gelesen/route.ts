import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const result = await prisma.benachrichtigung.updateMany({
      where: { gelesen: false },
      data: { gelesen: true },
    });

    return NextResponse.json({ updated: result.count });
  } catch (e) {
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && e instanceof Error ? e.message : "Interner Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
