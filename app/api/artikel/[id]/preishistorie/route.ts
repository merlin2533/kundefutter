import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";


type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const artikelId = parseInt(id, 10);
  if (isNaN(artikelId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const historie = await prisma.artikelPreisHistorie.findMany({
      where: { artikelId },
      orderBy: { geaendertAm: "desc" },
      take: 200,
    });
    return NextResponse.json(historie);
  } catch (err) {
    console.error("Preishistorie GET error:", err);
    const isDev = process.env.NODE_ENV === "development";
    const message = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
