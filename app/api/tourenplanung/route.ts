import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const datum = searchParams.get("datum");

  if (!datum) {
    return NextResponse.json({ error: "datum fehlt (YYYY-MM-DD)" }, { status: 400 });
  }

  const von = new Date(datum);
  von.setHours(0, 0, 0, 0);
  const bis = new Date(datum);
  bis.setHours(23, 59, 59, 999);

  const lieferungen = await prisma.lieferung.findMany({
    where: {
      status: "geplant",
      datum: { gte: von, lte: bis },
    },
    include: {
      kunde: { include: { kontakte: true } },
      positionen: { include: { artikel: true } },
    },
    orderBy: { datum: "asc" },
  });

  // Sortierung nach PLZ des Kunden (aufsteigend)
  lieferungen.sort((a, b) => {
    const plzA = a.kunde.plz ?? "";
    const plzB = b.kunde.plz ?? "";
    return plzA.localeCompare(plzB);
  });

  return NextResponse.json(lieferungen);
}
