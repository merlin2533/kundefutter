import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { lagerStatus } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status"); // rot | gelb | gruen

  const artikel = await prisma.artikel.findMany({
    where: { aktiv: true },
    include: { lieferanten: { include: { lieferant: true } } },
    orderBy: { name: "asc" },
  });

  const lager = artikel.map((a) => {
    const s = lagerStatus(a.aktuellerBestand, a.mindestbestand);
    return {
      ...a,
      lagerStatus: s,
    };
  });

  const gefiltert = status ? lager.filter((l) => l.lagerStatus === status) : lager;
  return NextResponse.json(gefiltert);
}
