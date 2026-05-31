import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getBackupDir, restoreFromFile } from "@/lib/backup";

export const dynamic = "force-dynamic";

/**
 * POST /api/backup/restore
 *
 * Zwei Modi:
 *   1. JSON:       { filename: "backup-2024-01-01-120000.db" }
 *                  → Restore aus vorhandenem Backup im Backups-Verzeichnis
 *   2. multipart:  FormData mit field "file" (*.db)
 *                  → Hochgeladene Datei wird direkt als Restore-Quelle genutzt
 *
 * In beiden Fällen:
 *   - Sicherungs-Backup der aktuellen DB wird angelegt (vor-restore-*.db)
 *   - DB-Datei wird ersetzt
 *   - Prozess beendet sich (Docker startet automatisch neu)
 */
export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";
  const backupDir = getBackupDir();

  let sourcePath: string;
  let tempFile: string | null = null;

  if (contentType.includes("multipart/form-data")) {
    // Modus 2: File-Upload
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json({ error: "Fehler beim Lesen der Formulardaten" }, { status: 400 });
    }

    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "Kein Datei-Feld 'file' gefunden" }, { status: 400 });
    }
    if (!file.name.endsWith(".db")) {
      return NextResponse.json({ error: "Nur .db-Dateien sind erlaubt" }, { status: 400 });
    }

    // Max 500 MB
    if (file.size > 500 * 1024 * 1024) {
      return NextResponse.json({ error: "Datei zu groß (max. 500 MB)" }, { status: 413 });
    }

    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

    tempFile = path.join(backupDir, `upload-temp-${Date.now()}.db`);
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(tempFile, buffer);
    sourcePath = tempFile;
  } else {
    // Modus 1: JSON mit Dateiname
    let body: { filename?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Ungültiger JSON-Body" }, { status: 400 });
    }

    const { filename } = body;
    if (!filename) {
      return NextResponse.json({ error: "filename fehlt" }, { status: 400 });
    }

    // Pfad-Traversal verhindern
    if (!/^[A-Za-z0-9._-]+$/.test(filename)) {
      return NextResponse.json({ error: "Ungültiger Dateiname" }, { status: 400 });
    }

    const resolved = path.resolve(backupDir, filename);
    if (!resolved.startsWith(path.resolve(backupDir) + path.sep)) {
      return NextResponse.json({ error: "Ungültiger Pfad" }, { status: 400 });
    }

    if (!fs.existsSync(resolved)) {
      return NextResponse.json({ error: "Backup-Datei nicht gefunden" }, { status: 404 });
    }

    sourcePath = resolved;
  }

  try {
    const { sicherung } = await restoreFromFile(sourcePath);

    // Temp-Datei aufräumen (falls Upload)
    if (tempFile && fs.existsSync(tempFile)) {
      try { fs.unlinkSync(tempFile); } catch { /* ignorieren */ }
    }

    // Prozess beenden → Docker/Watchtower startet Container neu
    setTimeout(() => process.exit(0), 800);

    return NextResponse.json({
      ok: true,
      sicherung,
      message: "Datenbank wiederhergestellt. Server wird neu gestartet…",
    });
  } catch (err) {
    // Temp-Datei bei Fehler aufräumen
    if (tempFile && fs.existsSync(tempFile)) {
      try { fs.unlinkSync(tempFile); } catch { /* ignorieren */ }
    }

    console.error("Restore error:", err);
    const msg = err instanceof Error ? err.message : "Fehler beim Wiederherstellen";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
