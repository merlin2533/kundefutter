/**
 * scripts/erzeuge-demo-backup-eierhandel.ts
 * Erzeugt demodaten/eierhandel/eierhandel-demo-backup.db — eine fertige, restorebare
 * SQLite-Datenbank: Schema (alle Migrationen), Basis-Rahmendaten (dieselben Muster-Einstellungen
 * wie bei einer Neuinstallation, siehe lib/muster-seed.ts), ein Admin-Login, `modul.eierhandel`
 * eingeschaltet und die Eierhandel-Demodaten aus demodaten/eierhandel/*.json. Lässt sich unter
 * /einstellungen/backup → "Wiederherstellen" direkt als Datei hochladen, ohne selbst
 * `npm run seed:eierhandel` ausführen oder das Modul manuell einschalten zu müssen.
 *
 * npm run seed:eierhandel:backup — neu erzeugen/aktualisieren, wenn sich die Eierhandel-JSON-
 * Fixtures oder lib/muster-seed.ts ändern (siehe AGENTS.md-Regel "Demodaten synchron halten").
 *
 * !!! WARNUNG — restoreFromFile() (lib/backup.ts) ERSETZT BEIM WIEDERHERSTELLEN DIE GESAMTE
 * DATENBANKDATEI. Diese .db-Datei NIEMALS auf eine Instanz mit echten Kundendaten einspielen —
 * nur auf einer Demo-/Testinstanz verwenden. Enthaltener Admin-Login: admin / changeme —
 * Passwort nach dem Wiederherstellen sofort ändern.
 *
 * Arbeitet ausschließlich gegen eine frische, temporäre SQLite-Datei unter os.tmpdir() — fasst
 * NIE prisma/dev.db oder eine produktive DATABASE_URL an. Jeder Teilschritt läuft als eigener
 * Subprozess mit explizit gesetzter DATABASE_URL (siehe childEnv), damit kein Modul versehentlich
 * die im aufrufenden Prozess ggf. bereits gesetzte DATABASE_URL verwendet.
 */
import "dotenv/config";
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const REPO_ROOT = path.join(__dirname, "..");
const TMP_DB = path.join(os.tmpdir(), `eierhandel-demo-backup-${Date.now()}.db`);
const DATABASE_URL = `file:${TMP_DB}`;
const ZIEL_DATEI = path.join(REPO_ROOT, "demodaten", "eierhandel", "eierhandel-demo-backup.db");

const childEnv = { ...process.env, DATABASE_URL, ADMIN_PASSWORD: "changeme" };

function run(cmd: string) {
  console.log(`→ ${cmd}`);
  execSync(cmd, { cwd: REPO_ROOT, env: childEnv, stdio: "inherit" });
}

function aufraeumen() {
  for (const suffix of ["", "-shm", "-wal"]) {
    try {
      fs.unlinkSync(TMP_DB + suffix);
    } catch {
      // Datei existiert nicht (mehr) — kein Fehler
    }
  }
}

// Bewusstes Duplikat von MUSTER_EINSTELLUNGEN (lib/muster-seed.ts): dieses Skript läuft per
// ts-node außerhalb der Next.js-Laufzeit — lib/muster-seed.ts hängt an @sentry/nextjs +
// lib/logger, die dort nicht sicher funktionieren (gleicher Grund, aus dem prisma/seed.ts und
// scripts/lade-demodaten-eierhandel.ts einen eigenen, minimalen PrismaClient statt @/lib/prisma
// verwenden). Bei Änderungen an lib/muster-seed.ts hier nachziehen.
const MUSTER_EINSTELLUNGEN: Record<string, string> = {
  "system.appname": "AGRI-Office",
  "system.firmenname": "Muster Agrarhandel GmbH",
  "firma.name": "Muster Agrarhandel GmbH",
  "firma.zusatz": "Landhandel & Agrarservice",
  "firma.strasse": "Musterstraße 1",
  "firma.plz": "12345",
  "firma.ort": "Musterstadt",
  "firma.telefon": "+49 1234 56789-0",
  "firma.email": "info@muster-agrarhandel.de",
  "firma.steuernummer": "12/345/67890",
  "firma.ustIdNr": "DE123456789",
  "firma.iban": "DE12 3456 7890 1234 5678 90",
  "firma.bic": "MUSTDE12XXX",
  "firma.bank": "Musterbank Musterstadt",
  "firma.mwstSatz": "19",
  "firma.zahlungszielStandard": "30",
  // Eierhandel-spezifisch (anders als lib/muster-seed.ts, das generisch für jede Branche gilt) —
  // dieses Backup stellt gezielt einen Eierbetrieb dar, siehe Datei-Kommentar oben.
  "firma.eierZulassungsnummer": "DE-1234",
};

async function setzeRahmendaten() {
  const adapter = new PrismaLibSql({ url: DATABASE_URL });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prisma = new PrismaClient({ adapter } as any);
  for (const [key, value] of Object.entries(MUSTER_EINSTELLUNGEN)) {
    await prisma.einstellung.upsert({ where: { key }, update: {}, create: { key, value } });
  }
  await prisma.einstellung.upsert({
    where: { key: "modul.eierhandel" },
    update: { value: "true" },
    create: { key: "modul.eierhandel", value: "true" },
  });
  // Ohne gesetzte Betriebsart zeigt das Demo-Backup den vollen Agrarhandel-Menüzuschnitt mit
  // allen Agrar-Modulen (Bodenproben/PSM/Sortenversuche stehen standardmäßig ebenfalls an) statt
  // des für dieses Backup eigentlich gemeinten Eierbetrieb-Profils (siehe lib/betriebsart.ts) —
  // Nav-Umbenennung "Pflanze & Tier" → "Eier & Futter" greift erst mit diesem Wert.
  await prisma.einstellung.upsert({
    where: { key: "system.betriebsart" },
    update: { value: "eierbetrieb" },
    create: { key: "system.betriebsart", value: "eierbetrieb" },
  });
  await prisma.$disconnect();
}

async function main() {
  console.log(`Erzeuge Eierhandel-Demo-Backup — frische, temporäre Datenbank unter ${TMP_DB}`);
  run("npx prisma migrate deploy");
  run("node prisma/seed-admin.js");
  console.log("→ Rahmendaten setzen (Muster-Einstellungen + modul.eierhandel)…");
  await setzeRahmendaten();
  run("npm run seed:eierhandel");

  fs.mkdirSync(path.dirname(ZIEL_DATEI), { recursive: true });
  fs.copyFileSync(TMP_DB, ZIEL_DATEI);
  const kb = (fs.statSync(ZIEL_DATEI).size / 1024).toFixed(0);
  console.log(`\nFertig: ${path.relative(REPO_ROOT, ZIEL_DATEI)} (${kb} KB)`);
  console.log("Enthält: Admin-Login admin/changeme, modul.eierhandel=true, Eierhandel-Demodaten.");
  console.log("WARNUNG: Nur auf einer Demo-/Testinstanz wiederherstellen — ersetzt die gesamte Datenbank.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(aufraeumen);
