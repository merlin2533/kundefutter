import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPortalSession } from "@/lib/portal-auth";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getPortalSession();
  if (!session) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  try {
    const lieferungen = await prisma.lieferung.findMany({
      where: { kundeId: session.kundeId },
      select: {
        id: true,
        datum: true,
        status: true,
        notiz: true,
        _count: { select: { positionen: true } },
      },
      orderBy: { datum: "desc" },
      take: 50,
    });

    return NextResponse.json(
      lieferungen.map((l) => ({
        id: l.id,
        datum: l.datum,
        status: l.status,
        notiz: l.notiz,
        positionenAnzahl: l._count.positionen,
      })),
    );
  } catch {
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
