import fs from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import {
  type BackupConfig,
  DEFAULT_BACKUP_CONFIG,
  parseBackupConfig,
} from "@/lib/backup-config";

export { type BackupConfig, DEFAULT_BACKUP_CONFIG, parseBackupConfig };

/** Verzeichnis für Backups – im Docker-Betrieb /data/backups, sonst lokal. */
export function getBackupDir(): string {
  if (fs.existsSync("/data")) return "/data/backups";
  return path.resolve(process.cwd(), "backups");
}

function ensureBackupDir(): string {
  const dir = getBackupDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getDbPath(): string {
  const dbUrl = process.env.DATABASE_URL ?? "";
  const match = dbUrl.match(/file:(.+)/);
  if (match) {
    const p = match[1];
    return path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
  }
  const defaultPath = "/data/kundefutter.db";
  if (fs.existsSync(defaultPath)) return defaultPath;
  if (fs.existsSync("/data")) {
    const files = fs.readdirSync("/data").filter((f) => f.endsWith(".db"));
    if (files.length > 0) return path.join("/data", files[0]);
  }
  return defaultPath;
}

export interface BackupEntry {
  filename: string;
  size: number;
  created: string;
}

export async function loadBackupConfig(): Promise<BackupConfig> {
  try {
    const e = await prisma.einstellung.findUnique({ where: { key: "system.backup" } });
    return parseBackupConfig(e?.value);
  } catch {
    return { ...DEFAULT_BACKUP_CONFIG };
  }
}

/** Erstellt eine vollständige Kopie der SQLite-Datenbank. */
export async function createBackup(prefix = "backup"): Promise<BackupEntry> {
  const dir = ensureBackupDir();

  // WAL-Puffer leeren für einen konsistenten Stand
  await prisma.$executeRawUnsafe("PRAGMA wal_checkpoint(TRUNCATE)");

  const dbPath = getDbPath();
  if (!fs.existsSync(dbPath)) {
    throw new Error(`Datenbankdatei nicht gefunden: ${dbPath}`);
  }

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const timestamp =
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const filename = `${prefix}-${timestamp}.db`;
  const destPath = path.join(dir, filename);

  fs.copyFileSync(dbPath, destPath);
  const stat = fs.statSync(destPath);
  return { filename, size: stat.size, created: stat.birthtime.toISOString() };
}

/** Behält nur die neuesten `keep` automatischen Backups, löscht ältere. */
export function pruneAutoBackups(keep: number): number {
  const dir = getBackupDir();
  if (!fs.existsSync(dir)) return 0;
  const autoBackups = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith("auto-") && f.endsWith(".db"))
    .map((f) => ({ f, mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  let deleted = 0;
  for (const { f } of autoBackups.slice(Math.max(1, keep))) {
    try {
      fs.unlinkSync(path.join(dir, f));
      deleted++;
    } catch {
      /* ignore */
    }
  }
  return deleted;
}

function newestAutoBackupTime(): number | null {
  const dir = getBackupDir();
  if (!fs.existsSync(dir)) return null;
  const times = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith("auto-") && f.endsWith(".db"))
    .map((f) => fs.statSync(path.join(dir, f)).mtimeMs);
  return times.length > 0 ? Math.max(...times) : null;
}

/** Führt eine automatische Sicherung aus, wenn sie laut Konfiguration fällig ist. */
export async function runAutoBackupIfDue(): Promise<BackupEntry | null> {
  const cfg = await loadBackupConfig();
  if (!cfg.autoAktiv) return null;

  const last = newestAutoBackupTime();
  if (last !== null) {
    const ageStunden = (Date.now() - last) / (1000 * 60 * 60);
    if (ageStunden < cfg.intervallStunden) return null;
  }

  const entry = await createBackup("auto");
  pruneAutoBackups(cfg.aufbewahrung);
  return entry;
}

let schedulerStarted = false;

/** Startet den Hintergrund-Scheduler (einmalig pro Serverinstanz). */
export function startBackupScheduler(): void {
  if (schedulerStarted) return;
  schedulerStarted = true;

  const tick = async () => {
    try {
      const entry = await runAutoBackupIfDue();
      if (entry) console.log(`[backup] Automatische Sicherung erstellt: ${entry.filename}`);
    } catch (err) {
      console.error("[backup] Automatische Sicherung fehlgeschlagen:", err);
    }
  };

  // Erste Prüfung kurz nach dem Start, danach stündlich
  setTimeout(tick, 60 * 1000);
  setInterval(tick, 60 * 60 * 1000);
}
