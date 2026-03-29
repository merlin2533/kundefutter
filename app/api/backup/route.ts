import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const BACKUP_DIR = "/data/backups";

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

function getDbPath(): string {
  const dbUrl = process.env.DATABASE_URL ?? "";
  // libsql: file:/data/kundefutter.db or file:./...
  const match = dbUrl.match(/file:(.+)/);
  if (match) {
    const p = match[1];
    return path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
  }
  // Default fallback
  const defaultPath = "/data/kundefutter.db";
  if (fs.existsSync(defaultPath)) return defaultPath;
  // Search in /data for any .db file
  if (fs.existsSync("/data")) {
    const files = fs.readdirSync("/data").filter((f) => f.endsWith(".db"));
    if (files.length > 0) return path.join("/data", files[0]);
  }
  return defaultPath;
}

export async function GET() {
  try {
    ensureBackupDir();

    const files: { filename: string; size: number; created: string }[] = [];

    if (fs.existsSync(BACKUP_DIR)) {
      const entries = fs.readdirSync(BACKUP_DIR);
      for (const entry of entries) {
        if (!entry.endsWith(".db")) continue;
        const filePath = path.join(BACKUP_DIR, entry);
        const stat = fs.statSync(filePath);
        files.push({
          filename: entry,
          size: stat.size,
          created: stat.birthtime.toISOString(),
        });
      }
    }

    // Also check /data for any .db.bak files
    if (fs.existsSync("/data")) {
      const entries = fs.readdirSync("/data");
      for (const entry of entries) {
        if (!entry.endsWith(".db.bak")) continue;
        const filePath = path.join("/data", entry);
        const stat = fs.statSync(filePath);
        files.push({
          filename: entry,
          size: stat.size,
          created: stat.birthtime.toISOString(),
        });
      }
    }

    files.sort(
      (a, b) => new Date(b.created).getTime() - new Date(a.created).getTime()
    );

    return NextResponse.json(files);
  } catch (err) {
    console.error("Backup list error:", err);
    return NextResponse.json({ error: "Fehler beim Lesen der Backups" }, { status: 500 });
  }
}

export async function POST() {
  try {
    ensureBackupDir();

    // Flush WAL before copying
    await prisma.$executeRawUnsafe("PRAGMA wal_checkpoint(TRUNCATE)");

    const dbPath = getDbPath();
    if (!fs.existsSync(dbPath)) {
      return NextResponse.json(
        { error: `Datenbankdatei nicht gefunden: ${dbPath}` },
        { status: 404 }
      );
    }

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const timestamp =
      `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
      `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const filename = `backup-${timestamp}.db`;
    const destPath = path.join(BACKUP_DIR, filename);

    fs.copyFileSync(dbPath, destPath);

    const stat = fs.statSync(destPath);
    return NextResponse.json({
      filename,
      size: stat.size,
      created: stat.birthtime.toISOString(),
    });
  } catch (err) {
    console.error("Backup create error:", err);
    return NextResponse.json({ error: "Fehler beim Erstellen des Backups" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const filename = searchParams.get("filename");

  if (!filename) {
    return NextResponse.json({ error: "filename fehlt" }, { status: 400 });
  }

  // Validate: no path traversal
  if (filename.includes("/") || filename.includes("..") || filename.includes("\\")) {
    return NextResponse.json({ error: "Ungültiger Dateiname" }, { status: 400 });
  }

  const filePath = path.join(BACKUP_DIR, filename);

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "Datei nicht gefunden" }, { status: 404 });
  }

  fs.unlinkSync(filePath);
  return NextResponse.json({ ok: true });
}
