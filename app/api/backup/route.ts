import { getCurrentUser } from "@/lib/auth";
import { requirePermission, P } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { createBackup, getBackupDir } from "@/lib/backup";
import { Sentry } from "@/lib/sentry";

export const dynamic = "force-dynamic";

export async function GET() {
  const meGuard = await getCurrentUser();
  const denyGuard = requirePermission(meGuard, P.EINSTELLUNGEN_BEARBEITEN);
  if (denyGuard) return denyGuard;

  try {
    const backupDir = getBackupDir();
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

    const files: { filename: string; size: number; created: string }[] = [];

    const entries = fs.readdirSync(backupDir);
    for (const entry of entries) {
      if (!entry.endsWith(".db")) continue;
      const filePath = path.join(backupDir, entry);
      const stat = fs.statSync(filePath);
      files.push({
        filename: entry,
        size: stat.size,
        created: stat.mtime.toISOString(),
      });
    }

    files.sort(
      (a, b) => new Date(b.created).getTime() - new Date(a.created).getTime()
    );

    return NextResponse.json(files);
  } catch (err) {
    Sentry.captureException(err);
    console.error("Backup list error:", err);
    return NextResponse.json({ error: "Fehler beim Lesen der Backups" }, { status: 500 });
  }
}

export async function POST() {
  const meGuard = await getCurrentUser();
  const denyGuard = requirePermission(meGuard, P.EINSTELLUNGEN_BEARBEITEN);
  if (denyGuard) return denyGuard;

  try {
    const entry = await createBackup();
    return NextResponse.json(entry);
  } catch (err) {
    Sentry.captureException(err);
    console.error("Backup create error:", err);
    const msg = err instanceof Error ? err.message : "Fehler beim Erstellen des Backups";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const meGuard = await getCurrentUser();
  const denyGuard = requirePermission(meGuard, P.EINSTELLUNGEN_BEARBEITEN);
  if (denyGuard) return denyGuard;

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
