/**
 * Client-sichere Typen & Parsing für die Backup-Konfiguration.
 * Enthält bewusst KEINE Node-Module (fs, prisma), damit auch Client-Komponenten
 * dies importieren können.
 */

export interface BackupConfig {
  /** Automatische Sicherung aktiviert */
  autoAktiv: boolean;
  /** Abstand zwischen automatischen Sicherungen in Stunden */
  intervallStunden: number;
  /** Maximale Anzahl aufbewahrter automatischer Backups (älteste werden gelöscht) */
  aufbewahrung: number;
}

export const DEFAULT_BACKUP_CONFIG: BackupConfig = {
  autoAktiv: false,
  intervallStunden: 24,
  aufbewahrung: 14,
};

export function parseBackupConfig(raw: string | null | undefined): BackupConfig {
  if (!raw) return { ...DEFAULT_BACKUP_CONFIG };
  try {
    const p = JSON.parse(raw) as Record<string, unknown>;
    const d = DEFAULT_BACKUP_CONFIG;
    const intervall = Number(p.intervallStunden);
    const aufbewahrung = Number(p.aufbewahrung);
    return {
      autoAktiv: p.autoAktiv === true,
      intervallStunden: Number.isFinite(intervall) && intervall >= 1 ? intervall : d.intervallStunden,
      aufbewahrung: Number.isFinite(aufbewahrung) && aufbewahrung >= 1 ? aufbewahrung : d.aufbewahrung,
    };
  } catch {
    return { ...DEFAULT_BACKUP_CONFIG };
  }
}
