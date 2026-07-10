import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import fs from "fs";

export const dynamic = "force-dynamic";

export async function GET() {
  const dbUrl = process.env.DATABASE_URL ?? "(nicht gesetzt – Fallback: file:prisma/dev.db)";
  const dbPath = dbUrl.replace(/^file:/, "");

  let fileInfo: Record<string, unknown> = {};
  try {
    const stat = fs.statSync(dbPath);
    fileInfo = { exists: true, sizeBytes: stat.size, modified: stat.mtime };
  } catch {
    fileInfo = { exists: false };
  }

  // Öffentlicher Endpoint ohne Auth (Health-Check) — niemals err.message oder sonstige
  // Fehlerdetails (Spaltennamen, DB-Pfade, Stack) nach außen geben, nur generische Status-Werte.
  let counts: Record<string, unknown> = {};
  try {
    const [artikel, lieferanten, kunden, lieferungen, sammelrechnungen] = await Promise.all([
      prisma.artikel.count(),
      prisma.lieferant.count(),
      prisma.kunde.count(),
      prisma.lieferung.count(),
      prisma.sammelrechnung.count(),
    ]);
    counts = { artikel, lieferanten, kunden, lieferungen, sammelrechnungen };
  } catch {
    counts = { error: "Fehler beim Laden" };
  }

  // Test actual findMany queries to catch column-not-found / migration issues
  const queryTests: Record<string, unknown> = {};
  try {
    await prisma.lieferung.findFirst({ select: { id: true, datum: true, status: true, lieferDatum: true, rechnungNr: true, rechnungDatum: true, bezahltAm: true, zahlungsziel: true } });
    queryTests.lieferung = "ok";
  } catch { queryTests.lieferung = "error"; }
  try {
    await prisma.artikel.findFirst({ select: { id: true, name: true, driveOrdnerId: true, lagerort: true, liefergroesse: true, unterkategorie: true } });
    queryTests.artikel = "ok";
  } catch { queryTests.artikel = "error"; }
  try {
    await prisma.artikel.findFirst({ select: { id: true, sprengstoffvorlaeufer: true, ghsKlassen: true, hSaetze: true, pSaetze: true, signalwort: true } });
    queryTests.artikelGhs = "ok";
  } catch { queryTests.artikelGhs = "error"; }
  try {
    await prisma.kunde.findFirst({ select: { id: true, name: true, kreditlimit: true, sachkundeNr: true, sachkundeGueltigBis: true } });
    queryTests.kunde = "ok";
  } catch { queryTests.kunde = "error"; }

  // Check applied migrations
  let migrations: unknown = null;
  try {
    const rows = await prisma.$queryRaw<{ migration_name: string; finished_at: string | null }[]>`
      SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY started_at DESC LIMIT 10
    `;
    migrations = rows;
  } catch { migrations = { error: "Fehler beim Laden" }; }

  return NextResponse.json({ dbUrl, dbPath, fileInfo, counts, queryTests, migrations });
}
