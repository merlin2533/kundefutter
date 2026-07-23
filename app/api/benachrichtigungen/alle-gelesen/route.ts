import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const result = await prisma.benachrichtigung.updateMany({
      where: { gelesen: false },
      data: { gelesen: true },
    });

    return NextResponse.json({ updated: result.count });
  } catch (e) {
    Sentry.captureException(e);
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && e instanceof Error ? e.message : "Interner Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
