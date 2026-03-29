import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await prisma.$executeRawUnsafe(`DELETE FROM kunden_fts`);
    await prisma.$executeRawUnsafe(`
      INSERT INTO kunden_fts(rowid, kunde_id, name, firma, plz, ort)
      SELECT id, id, name, COALESCE(firma, ''), COALESCE(plz, ''), COALESCE(ort, '') FROM Kunde
    `);
    await prisma.$executeRawUnsafe(`DELETE FROM artikel_fts`);
    await prisma.$executeRawUnsafe(`
      INSERT INTO artikel_fts(rowid, artikel_id, name, artikelnummer, kategorie)
      SELECT id, id, name, artikelnummer, kategorie FROM Artikel
    `);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "FTS rebuild failed" }, { status: 500 });
  }
}
