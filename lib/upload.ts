import path from "path";
import { existsSync, accessSync, constants } from "fs";

/**
 * Liefert das Basisverzeichnis für hochgeladene Dateien.
 * - Docker-Deployment: `/data/uploads` (Volume persistent, nextjs-eigen)
 * - Lokale Entwicklung: `./uploads` im Projekt (nicht in `public/`, um Next.js
 *   Dev-Rebuilds bei Uploads zu vermeiden)
 */
export function getUploadBase(): string {
  try {
    if (existsSync("/data")) {
      accessSync("/data", constants.W_OK);
      return "/data/uploads";
    }
  } catch {
    // fällt auf lokales Verzeichnis zurück
  }
  return path.join(process.cwd(), "uploads");
}

/**
 * Baut den absoluten Dateipfad aus einem relativen gespeicherten Pfad.
 * Akzeptiert sowohl alte `/uploads/...`-Pfade (in `public/uploads`) als
 * auch neue relative Pfade.
 */
export function resolveUploadPath(pfad: string): string {
  // Alte Pfade (in public/uploads/)
  if (pfad.startsWith("/uploads/")) {
    return path.join(process.cwd(), "public", pfad.replace(/^\//, ""));
  }
  // Neue relative Pfade
  const base = getUploadBase();
  const rel = pfad.replace(/^\//, "");
  return path.join(base, rel);
}
