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
  } catch (err) {
    counts = { error: err instanceof Error ? err.message : String(err) };
  }

  // Test actual findMany queries to catch column-not-found / migration issues
  const queryTests: Record<string, unknown> = {};
  try {
    await prisma.lieferung.findFirst({ select: { id: true, datum: true, status: true, lieferDatum: true, rechnungNr: true, rechnungDatum: true, bezahltAm: true, zahlungsziel: true } });
    queryTests.lieferung = "ok";
  } catch (err) { queryTests.lieferung = err instanceof Error ? err.message : String(err); }
  try {
    await prisma.artikel.findFirst({ select: { id: true, name: true, driveOrdnerId: true, lagerort: true, liefergroesse: true, unterkategorie: true } });
    queryTests.artikel = "ok";
  } catch (err) { queryTests.artikel = err instanceof Error ? err.message : String(err); }
  try {
    await prisma.kunde.findFirst({ select: { id: true, name: true } });
    queryTests.kunde = "ok";
  } catch (err) { queryTests.kunde = err instanceof Error ? err.message : String(err); }

  // Check applied migrations
  let migrations: unknown = null;
  try {
    const rows = await prisma.$queryRaw<{ migration_name: string; finished_at: string | null }[]>`
      SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY started_at DESC LIMIT 10
    `;
    migrations = rows;
  } catch (err) { migrations = { error: err instanceof Error ? err.message : String(err) }; }

  return NextResponse.json({ dbUrl, dbPath, fileInfo, counts, queryTests, migrations });
}
