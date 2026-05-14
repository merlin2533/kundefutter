import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { createBackup, getBackupDir } from "@/lib/backup";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const backupDir = getBackupDir();
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

    const files: { filename: string; size: number; created: string }[] = [];

    {
      const entries = fs.readdirSync(backupDir);
      for (const entry of entries) {
        if (!entry.endsWith(".db")) continue;
        const filePath = path.join(backupDir, entry);
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
    const entry = await createBackup();
    return NextResponse.json(entry);
  } catch (err) {
    console.error("Backup create error:", err);
    const msg = err instanceof Error ? err.message : "Fehler beim Erstellen des Backups";
    return NextResponse.json({ error: msg }, { status: 500 });
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

  const filePath = path.join(getBackupDir(), filename);

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "Datei nicht gefunden" }, { status: 404 });
  }

  fs.unlinkSync(filePath);
  return NextResponse.json({ ok: true });
}
