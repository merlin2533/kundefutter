import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET → Statistik: Anzahl Artikel je Kategorie
export async function GET() {
  try {
    const grouped = await prisma.artikel.groupBy({
      by: ["kategorie"],
      _count: { _all: true },
    });
    const result: Record<string, number> = {};
    for (const g of grouped) {
      result[g.kategorie] = g._count._all;
    }
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

// POST {aktion:"umbenennen", von, zu} → updateMany für alle Artikel
export async function POST(req: NextRequest) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const aktion = String(body?.aktion ?? "");
  if (aktion !== "umbenennen") {
    return NextResponse.json({ error: "Unbekannte Aktion" }, { status: 400 });
  }

  const von = String(body?.von ?? "").trim();
  const zu = String(body?.zu ?? "").trim();
  if (!von || !zu) {
    return NextResponse.json({ error: "von und zu erforderlich" }, { status: 400 });
  }
  if (von === zu) {
    return NextResponse.json({ ok: true, aktualisiert: 0 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const artikel = await tx.artikel.updateMany({
        where: { kategorie: von },
        data: { kategorie: zu },
      });
      await tx.mengenrabatt.updateMany({
        where: { kategorie: von },
        data: { kategorie: zu },
      });
      return artikel;
    });
    return NextResponse.json({ ok: true, aktualisiert: result.count });
  } catch {
    return NextResponse.json({ error: "Fehler beim Umbenennen" }, { status: 500 });
  }
}
