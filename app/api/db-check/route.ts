import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import { Sentry } from "@/lib/sentry";

export const dynamic = "force-dynamic";

// Öffentlicher Endpoint ohne Session-Auth (Docker HEALTHCHECK + waitForNextJs in
// geo-server.js brauchen ihn ohne Login erreichbar). Detaillierte Diagnosedaten
// (DB-Pfad, Zeilenzahlen, Migrationshistorie) sind aber Recon-Material für
// Angreifer und potenziell ein Credential-Leak (DATABASE_URL kann bei anderen
// Providern als SQLite ein Auth-Token enthalten) — daher nur mit gültigem
// CRON_SECRET (Bearer-Header) oder außerhalb von production ausgeliefert.
function isAuthorizedForDetails(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") ?? "";
    return auth === `Bearer ${secret}`;
  }
  return process.env.NODE_ENV !== "production";
}

export async function GET(req: NextRequest) {
  const showDetails = isAuthorizedForDetails(req);

  let countsOk = true;
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
    Sentry.captureException(err);
    countsOk = false;
    counts = { error: "Fehler beim Laden" };
  }

  // Test actual findMany queries to catch column-not-found / migration issues
  const queryTests: Record<string, unknown> = {};
  let queryTestsOk = true;
  try {
    await prisma.lieferung.findFirst({ select: { id: true, datum: true, status: true, lieferDatum: true, rechnungNr: true, rechnungDatum: true, bezahltAm: true, zahlungsziel: true } });
    queryTests.lieferung = "ok";
  } catch (err) {
    Sentry.captureException(err); queryTests.lieferung = "error"; queryTestsOk = false; }
  try {
    await prisma.artikel.findFirst({ select: { id: true, name: true, lagerort: true, liefergroesse: true, unterkategorie: true } });
    queryTests.artikel = "ok";
  } catch (err) {
    Sentry.captureException(err); queryTests.artikel = "error"; queryTestsOk = false; }
  try {
    await prisma.artikel.findFirst({ select: { id: true, sprengstoffvorlaeufer: true, ghsKlassen: true, hSaetze: true, pSaetze: true, signalwort: true } });
    queryTests.artikelGhs = "ok";
  } catch (err) {
    Sentry.captureException(err); queryTests.artikelGhs = "error"; queryTestsOk = false; }
  try {
    await prisma.kunde.findFirst({ select: { id: true, name: true, kreditlimit: true, sachkundeNr: true, sachkundeGueltigBis: true } });
    queryTests.kunde = "ok";
  } catch (err) {
    Sentry.captureException(err); queryTests.kunde = "error"; queryTestsOk = false; }

  if (!showDetails) {
    return NextResponse.json({ ok: countsOk && queryTestsOk, queryTests });
  }

  const dbUrl = process.env.DATABASE_URL ?? "(nicht gesetzt – Fallback: file:prisma/dev.db)";
  const dbPath = dbUrl.replace(/^file:/, "");

  let fileInfo: Record<string, unknown> = {};
  try {
    const stat = fs.statSync(dbPath);
    fileInfo = { exists: true, sizeBytes: stat.size, modified: stat.mtime };
  } catch (err) {
    Sentry.captureException(err);
    fileInfo = { exists: false };
  }

  let migrations: unknown = null;
  try {
    const rows = await prisma.$queryRaw<{ migration_name: string; finished_at: string | null }[]>`
      SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY started_at DESC LIMIT 10
    `;
    migrations = rows;
  } catch (err) {
    Sentry.captureException(err); migrations = { error: "Fehler beim Laden" }; }

  return NextResponse.json({ dbUrl, dbPath, fileInfo, counts, queryTests, migrations });
}
