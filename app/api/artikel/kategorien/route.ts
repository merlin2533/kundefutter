import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";


// GET → distinct unterkategorien je kategorie: { [kategorie]: string[] }
// ?format=flat → legacy: { [kategorie]: count }
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const flat = searchParams.get("format") === "flat";

  try {
    if (flat) {
      const grouped = await prisma.artikel.groupBy({
        by: ["kategorie"],
        _count: { _all: true },
      });
      const result: Record<string, number> = {};
      for (const g of grouped) result[g.kategorie] = g._count._all;
      return NextResponse.json(result);
    }

    const rows = await prisma.artikel.findMany({
      where: { aktiv: true },
      select: { kategorie: true, unterkategorie: true },
      distinct: ["kategorie", "unterkategorie"],
      orderBy: [{ kategorie: "asc" }, { unterkategorie: "asc" }],
    });

    const map: Record<string, Set<string>> = {};
    for (const r of rows) {
      if (!map[r.kategorie]) map[r.kategorie] = new Set();
      if (r.unterkategorie) map[r.kategorie].add(r.unterkategorie);
    }
    const result: Record<string, string[]> = {};
    for (const [kat, set] of Object.entries(map)) {
      result[kat] = Array.from(set).sort();
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
