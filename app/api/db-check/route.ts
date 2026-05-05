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

  return NextResponse.json({ dbUrl, dbPath, fileInfo, counts });
}
