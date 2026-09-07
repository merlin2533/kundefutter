import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { Sentry } from "@/lib/sentry";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    // Ein einfaches "DELETE FROM kunden_fts"/"DELETE FROM artikel_fts" scheitert bei diesen
    // external-content FTS5-Tabellen zuverlässig mit "no such column: T.kunde_id"/"T.artikel_id":
    // SQLite versucht bei einem DELETE ohne explizit mitgelieferte Alt-Werte, diese selbst aus der
    // content='Kunde'/content='Artikel'-Tabelle nachzuladen — dort heißt die Spalte aber "id" statt
    // "kunde_id"/"artikel_id", und "inhaltsstoffe" existiert dort als Spalte gar nicht (wird per
    // Trigger aus ArtikelInhaltsstoff berechnet). Tabelle deshalb komplett neu anlegen (wie beim
    // ursprünglichen Migrations-Setup) statt zu leeren — das braucht keinen Rückgriff auf die
    // content-Tabelle. Bestehende Trigger auf Kunde/Artikel/ArtikelInhaltsstoff bleiben davon
    // unberührt, da sie an den Basistabellen hängen, nicht an der virtuellen FTS5-Tabelle selbst.
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS kunden_fts`);
    await prisma.$executeRawUnsafe(`
      CREATE VIRTUAL TABLE kunden_fts USING fts5(
        kunde_id UNINDEXED,
        name,
        firma,
        plz,
        ort,
        content='Kunde',
        content_rowid='id'
      )
    `);
    await prisma.$executeRawUnsafe(`
      INSERT INTO kunden_fts(rowid, kunde_id, name, firma, plz, ort)
      SELECT id, id, name, COALESCE(firma, ''), COALESCE(plz, ''), COALESCE(ort, '') FROM Kunde
    `);
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS artikel_fts`);
    await prisma.$executeRawUnsafe(`
      CREATE VIRTUAL TABLE artikel_fts USING fts5(
        artikel_id UNINDEXED,
        name,
        artikelnummer,
        kategorie,
        inhaltsstoffe,
        content='Artikel',
        content_rowid='id'
      )
    `);
    // inhaltsstoffe mit einindexieren (wurde hier zuvor komplett vergessen, siehe artikel_fts-Spalte
    // aus Migration 20260403200000) — sonst liefert die Suche nach Inhaltsstoffen nach einem Rebuild
    // keine Treffer mehr, obwohl die Spalte existiert.
    await prisma.$executeRawUnsafe(`
      INSERT INTO artikel_fts(rowid, artikel_id, name, artikelnummer, kategorie, inhaltsstoffe)
      SELECT a.id, a.id, a.name, a.artikelnummer, a.kategorie,
        COALESCE((SELECT group_concat(ai.name, ', ') FROM ArtikelInhaltsstoff ai WHERE ai.artikelId = a.id), '')
      FROM Artikel a
    `);
    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "FTS rebuild failed" }, { status: 500 });
  }
}
