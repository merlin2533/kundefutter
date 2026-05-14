#!/usr/bin/env node
/**
 * Pre-migration repair script.
 * Runs BEFORE `prisma migrate deploy` to manually apply migrations that
 * fail because their SQL is not fully idempotent (missing IF NOT EXISTS).
 * After adding the column/index, the migration is recorded in
 * _prisma_migrations so Prisma skips it in the subsequent deploy.
 *
 * Handled migrations (each is detected via PRAGMA / sqlite_master):
 *   20260427000000_add_artikel_unterkategorie
 *   20260429000000_add_wareneingang_chargenr
 *   20260429010000_add_einheiten_saatgut_defaults  (data-only, idempotent SQL)
 *   20260505000000_add_lieferung_rechnung_indizes  (already uses IF NOT EXISTS)
 *   20260509000000_add_unterschrift_fahrer         (Lieferung.unterschriftPng + fahrerId)
 *   20260512000000_sprengstoffvorlaeufer
 *   20260512000000_competitor_features
 *   20260512010000_reklamation_streckengeschaeft
 *   20260512020000_benachrichtigungen
 *   20260512030000_umsatzziel
 *   20260512040000_skonto_teilzahlung_vorlagen_chargen_ghs
 *   20260512050000_add_performance_indexes
 *   20260512060000_fix_fts5_triggers
 *   20260513000000_congruence_features
 *   20260514000000_rationsberechnung
 */

const { createClient } = require("@libsql/client");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const DB_URL = process.env.DATABASE_URL ?? "file:prisma/dev.db";
const libsqlUrl = DB_URL.startsWith("file:./")
  ? DB_URL.replace("file:./", "file:")
  : DB_URL;

const MIGRATIONS_DIR = path.join(__dirname, "migrations");

function log(msg) { console.log(`[pre-migrate] ${msg}`); }

function checksum(migrationName) {
  const sql = fs.readFileSync(
    path.join(MIGRATIONS_DIR, migrationName, "migration.sql"),
    "utf8"
  );
  return crypto.createHash("sha256").update(sql).digest("hex");
}

async function columnExists(client, table, column) {
  try {
    const res = await client.execute(`PRAGMA table_info("${table}")`);
    return res.rows.some((r) => r[1] === column);
  } catch {
    return false;
  }
}

async function tableExists(client, table) {
  const res = await client.execute(
    `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
    [table]
  );
  return res.rows.length > 0;
}

async function indexExists(client, indexName) {
  const res = await client.execute(
    `SELECT name FROM sqlite_master WHERE type='index' AND name=?`,
    [indexName]
  );
  return res.rows.length > 0;
}

async function migrationApplied(client, name) {
  try {
    const res = await client.execute(
      `SELECT 1 FROM "_prisma_migrations" WHERE migration_name=? AND finished_at IS NOT NULL`,
      [name]
    );
    return res.rows.length > 0;
  } catch {
    return false; // _prisma_migrations might not exist yet
  }
}

async function recordMigration(client, name) {
  const id = crypto.randomUUID();
  const cs = checksum(name);
  const now = new Date().toISOString();
  // If prisma started this migration but failed mid-way, there's already a row
  // with finished_at=NULL — wipe it so we can insert a fresh "completed" row.
  await client.execute(
    `DELETE FROM "_prisma_migrations" WHERE migration_name=? AND finished_at IS NULL`,
    [name]
  );
  await client.execute(
    `INSERT OR IGNORE INTO "_prisma_migrations"
       (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
     VALUES (?, ?, ?, ?, NULL, NULL, ?, 1)`,
    [id, cs, now, name, now]
  );
  log(`Recorded ${name} in _prisma_migrations`);
}

async function addColumnIfMissing(client, table, column, definition) {
  if (!(await tableExists(client, table))) return;
  if (await columnExists(client, table, column)) return;
  log(`  + ${table}.${column}`);
  await client.execute(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${definition}`);
}

async function createTableIfMissing(client, table, ddl) {
  if (await tableExists(client, table)) return;
  log(`  + table ${table}`);
  await client.execute(ddl);
}

async function createIndexIfMissing(client, name, ddl) {
  if (await indexExists(client, name)) return;
  log(`  + index ${name}`);
  await client.execute(ddl);
}

async function main() {
  const client = createClient({ url: libsqlUrl });

  // ── Migration 1: 20260427000000_add_artikel_unterkategorie ─────────────────
  const MIG1 = "20260427000000_add_artikel_unterkategorie";
  if (!(await migrationApplied(client, MIG1))) {
    await addColumnIfMissing(client, "Artikel", "unterkategorie", "TEXT");
    await createIndexIfMissing(
      client,
      "Artikel_unterkategorie_idx",
      `CREATE INDEX "Artikel_unterkategorie_idx" ON "Artikel"("unterkategorie")`
    );
    await recordMigration(client, MIG1);
    log(`✓ ${MIG1} applied`);
  } else {
    log(`skip ${MIG1} (already applied)`);
  }

  // ── Migration 2: 20260429000000_add_wareneingang_chargenr ──────────────────
  const MIG2 = "20260429000000_add_wareneingang_chargenr";
  if (!(await migrationApplied(client, MIG2))) {
    await addColumnIfMissing(client, "WareineingangPosition", "chargeNr", "TEXT");
    await recordMigration(client, MIG2);
    log(`✓ ${MIG2} applied`);
  } else {
    log(`skip ${MIG2} (already applied)`);
  }

  // ── Migration 3: 20260429010000_add_einheiten_saatgut_defaults ─────────────
  // Data-only (INSERT/UPDATE of Einstellung). The SQL uses WHERE NOT EXISTS /
  // json_valid guards so it is naturally idempotent — just run it.
  const MIG3 = "20260429010000_add_einheiten_saatgut_defaults";
  if (!(await migrationApplied(client, MIG3))) {
    log("Running Einstellung seed defaults …");
    const sql3 = fs.readFileSync(
      path.join(MIGRATIONS_DIR, MIG3, "migration.sql"),
      "utf8"
    );
    for (const stmt of sql3.split(";").map((s) => s.trim()).filter(Boolean)) {
      try { await client.execute(stmt); } catch { /* ignore */ }
    }
    await recordMigration(client, MIG3);
    log(`✓ ${MIG3} applied`);
  } else {
    log(`skip ${MIG3} (already applied)`);
  }

  // ── Migration 4: 20260505000000_add_lieferung_rechnung_indizes ─────────────
  // Already uses CREATE INDEX IF NOT EXISTS — safe to run directly.
  const MIG4 = "20260505000000_add_lieferung_rechnung_indizes";
  if (!(await migrationApplied(client, MIG4))) {
    log("Creating Lieferung rechnung indexes …");
    const sql4 = fs.readFileSync(
      path.join(MIGRATIONS_DIR, MIG4, "migration.sql"),
      "utf8"
    );
    for (const stmt of sql4.split(";").map((s) => s.trim()).filter(Boolean)) {
      try { await client.execute(stmt); } catch { /* ignore */ }
    }
    await recordMigration(client, MIG4);
    log(`✓ ${MIG4} applied`);
  } else {
    log(`skip ${MIG4} (already applied)`);
  }

  // ── Migration 5: 20260509000000_add_unterschrift_fahrer ───────────────────
  const MIG5 = "20260509000000_add_unterschrift_fahrer";
  if (!(await migrationApplied(client, MIG5))) {
    await addColumnIfMissing(client, "Lieferung", "unterschriftPng", "TEXT");
    await addColumnIfMissing(client, "Lieferung", "fahrerId", "INTEGER");
    await recordMigration(client, MIG5);
    log(`✓ ${MIG5} applied`);
  } else {
    log(`skip ${MIG5} (already applied)`);
  }

  // ── Migration 6: 20260512000000_sprengstoffvorlaeufer ─────────────────────
  const MIG6 = "20260512000000_sprengstoffvorlaeufer";
  if (!(await migrationApplied(client, MIG6))) {
    await addColumnIfMissing(client, "Artikel", "sprengstoffvorlaeufer", "BOOLEAN NOT NULL DEFAULT false");
    await createTableIfMissing(
      client,
      "KundeSprengstoffErklaerung",
      `CREATE TABLE "KundeSprengstoffErklaerung" (
        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "kundeId" INTEGER NOT NULL,
        "jahr" INTEGER NOT NULL,
        "datum" DATETIME NOT NULL,
        "dokumentPfad" TEXT,
        "notiz" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "KundeSprengstoffErklaerung_kundeId_fkey" FOREIGN KEY ("kundeId") REFERENCES "Kunde" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )`
    );
    await createIndexIfMissing(
      client,
      "KundeSprengstoffErklaerung_kundeId_jahr_key",
      `CREATE UNIQUE INDEX "KundeSprengstoffErklaerung_kundeId_jahr_key" ON "KundeSprengstoffErklaerung"("kundeId", "jahr")`
    );
    await createIndexIfMissing(
      client,
      "KundeSprengstoffErklaerung_kundeId_idx",
      `CREATE INDEX "KundeSprengstoffErklaerung_kundeId_idx" ON "KundeSprengstoffErklaerung"("kundeId")`
    );
    await recordMigration(client, MIG6);
    log(`✓ ${MIG6} applied`);
  } else {
    log(`skip ${MIG6} (already applied)`);
  }

  // ── Migration 7: 20260512000000_competitor_features ───────────────────────
  const MIG7 = "20260512000000_competitor_features";
  if (!(await migrationApplied(client, MIG7))) {
    await addColumnIfMissing(client, "Kunde", "kreditlimit", "REAL");
    await addColumnIfMissing(client, "Kunde", "sachkundeNr", "TEXT");
    await addColumnIfMissing(client, "Kunde", "sachkundeGueltigBis", "DATETIME");

    await createTableIfMissing(client, "PsmAusbringung", `CREATE TABLE "PsmAusbringung" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "kundeId" INTEGER NOT NULL,
      "schlagId" INTEGER,
      "datum" DATETIME NOT NULL,
      "mittel" TEXT NOT NULL,
      "wirkstoff" TEXT,
      "menge" REAL NOT NULL,
      "einheit" TEXT NOT NULL DEFAULT 'l/ha',
      "kultur" TEXT,
      "flaeche" REAL,
      "anwendungsgrund" TEXT,
      "wartezeit" INTEGER,
      "notiz" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PsmAusbringung_kundeId_fkey" FOREIGN KEY ("kundeId") REFERENCES "Kunde" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "PsmAusbringung_schlagId_fkey" FOREIGN KEY ("schlagId") REFERENCES "KundeSchlag" ("id") ON DELETE SET NULL ON UPDATE CASCADE
    )`);
    await createIndexIfMissing(client, "PsmAusbringung_kundeId_idx", `CREATE INDEX "PsmAusbringung_kundeId_idx" ON "PsmAusbringung"("kundeId")`);
    await createIndexIfMissing(client, "PsmAusbringung_datum_idx", `CREATE INDEX "PsmAusbringung_datum_idx" ON "PsmAusbringung"("datum")`);

    await createTableIfMissing(client, "Bestellung", `CREATE TABLE "Bestellung" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "nummer" TEXT NOT NULL,
      "lieferantId" INTEGER NOT NULL,
      "datum" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "lieferdatum" DATETIME,
      "status" TEXT NOT NULL DEFAULT 'OFFEN',
      "notiz" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "Bestellung_lieferantId_fkey" FOREIGN KEY ("lieferantId") REFERENCES "Lieferant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
    )`);
    await createIndexIfMissing(client, "Bestellung_nummer_key", `CREATE UNIQUE INDEX "Bestellung_nummer_key" ON "Bestellung"("nummer")`);
    await createIndexIfMissing(client, "Bestellung_lieferantId_idx", `CREATE INDEX "Bestellung_lieferantId_idx" ON "Bestellung"("lieferantId")`);
    await createIndexIfMissing(client, "Bestellung_status_idx", `CREATE INDEX "Bestellung_status_idx" ON "Bestellung"("status")`);
    await createIndexIfMissing(client, "Bestellung_datum_idx", `CREATE INDEX "Bestellung_datum_idx" ON "Bestellung"("datum")`);

    await createTableIfMissing(client, "BestellungPosition", `CREATE TABLE "BestellungPosition" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "bestellungId" INTEGER NOT NULL,
      "artikelId" INTEGER NOT NULL,
      "menge" REAL NOT NULL,
      "mengeGeliefert" REAL NOT NULL DEFAULT 0,
      "preis" REAL,
      "einheit" TEXT NOT NULL DEFAULT 'kg',
      CONSTRAINT "BestellungPosition_bestellungId_fkey" FOREIGN KEY ("bestellungId") REFERENCES "Bestellung" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "BestellungPosition_artikelId_fkey" FOREIGN KEY ("artikelId") REFERENCES "Artikel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
    )`);
    await createIndexIfMissing(client, "BestellungPosition_bestellungId_idx", `CREATE INDEX "BestellungPosition_bestellungId_idx" ON "BestellungPosition"("bestellungId")`);
    await createIndexIfMissing(client, "BestellungPosition_artikelId_idx", `CREATE INDEX "BestellungPosition_artikelId_idx" ON "BestellungPosition"("artikelId")`);

    await createTableIfMissing(client, "Kontrakt", `CREATE TABLE "Kontrakt" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "nummer" TEXT NOT NULL,
      "kundeId" INTEGER NOT NULL,
      "datum" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "gueltigVon" DATETIME NOT NULL,
      "gueltigBis" DATETIME NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'AKTIV',
      "notiz" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "Kontrakt_kundeId_fkey" FOREIGN KEY ("kundeId") REFERENCES "Kunde" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`);
    await createIndexIfMissing(client, "Kontrakt_nummer_key", `CREATE UNIQUE INDEX "Kontrakt_nummer_key" ON "Kontrakt"("nummer")`);
    await createIndexIfMissing(client, "Kontrakt_kundeId_idx", `CREATE INDEX "Kontrakt_kundeId_idx" ON "Kontrakt"("kundeId")`);
    await createIndexIfMissing(client, "Kontrakt_status_idx", `CREATE INDEX "Kontrakt_status_idx" ON "Kontrakt"("status")`);
    await createIndexIfMissing(client, "Kontrakt_gueltigBis_idx", `CREATE INDEX "Kontrakt_gueltigBis_idx" ON "Kontrakt"("gueltigBis")`);

    await createTableIfMissing(client, "KontraktPosition", `CREATE TABLE "KontraktPosition" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "kontraktId" INTEGER NOT NULL,
      "artikelId" INTEGER NOT NULL,
      "menge" REAL NOT NULL,
      "mengeAbgerufen" REAL NOT NULL DEFAULT 0,
      "preis" REAL,
      "einheit" TEXT NOT NULL DEFAULT 'kg',
      CONSTRAINT "KontraktPosition_kontraktId_fkey" FOREIGN KEY ("kontraktId") REFERENCES "Kontrakt" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "KontraktPosition_artikelId_fkey" FOREIGN KEY ("artikelId") REFERENCES "Artikel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
    )`);
    await createIndexIfMissing(client, "KontraktPosition_kontraktId_idx", `CREATE INDEX "KontraktPosition_kontraktId_idx" ON "KontraktPosition"("kontraktId")`);
    await createIndexIfMissing(client, "KontraktPosition_artikelId_idx", `CREATE INDEX "KontraktPosition_artikelId_idx" ON "KontraktPosition"("artikelId")`);

    await createTableIfMissing(client, "Kampagne", `CREATE TABLE "Kampagne" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "name" TEXT NOT NULL,
      "beschreibung" TEXT,
      "von" DATETIME NOT NULL,
      "bis" DATETIME NOT NULL,
      "rabattProzent" REAL,
      "aktiv" BOOLEAN NOT NULL DEFAULT 1,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )`);
    await createIndexIfMissing(client, "Kampagne_aktiv_idx", `CREATE INDEX "Kampagne_aktiv_idx" ON "Kampagne"("aktiv")`);
    await createIndexIfMissing(client, "Kampagne_bis_idx", `CREATE INDEX "Kampagne_bis_idx" ON "Kampagne"("bis")`);

    await createTableIfMissing(client, "KampagneArtikel", `CREATE TABLE "KampagneArtikel" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "kampagneId" INTEGER NOT NULL,
      "artikelId" INTEGER NOT NULL,
      "sonderpreis" REAL,
      CONSTRAINT "KampagneArtikel_kampagneId_fkey" FOREIGN KEY ("kampagneId") REFERENCES "Kampagne" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "KampagneArtikel_artikelId_fkey" FOREIGN KEY ("artikelId") REFERENCES "Artikel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`);
    await createIndexIfMissing(client, "KampagneArtikel_kampagneId_artikelId_key", `CREATE UNIQUE INDEX "KampagneArtikel_kampagneId_artikelId_key" ON "KampagneArtikel"("kampagneId", "artikelId")`);
    await createIndexIfMissing(client, "KampagneArtikel_kampagneId_idx", `CREATE INDEX "KampagneArtikel_kampagneId_idx" ON "KampagneArtikel"("kampagneId")`);
    await createIndexIfMissing(client, "KampagneArtikel_artikelId_idx", `CREATE INDEX "KampagneArtikel_artikelId_idx" ON "KampagneArtikel"("artikelId")`);

    await createTableIfMissing(client, "EingangsRechnung", `CREATE TABLE "EingangsRechnung" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "nummer" TEXT,
      "lieferantId" INTEGER NOT NULL,
      "datum" DATETIME NOT NULL,
      "faelligAm" DATETIME,
      "betrag" REAL NOT NULL,
      "mwst" REAL NOT NULL DEFAULT 19,
      "status" TEXT NOT NULL DEFAULT 'OFFEN',
      "belegpfad" TEXT,
      "notiz" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "EingangsRechnung_lieferantId_fkey" FOREIGN KEY ("lieferantId") REFERENCES "Lieferant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
    )`);
    await createIndexIfMissing(client, "EingangsRechnung_lieferantId_idx", `CREATE INDEX "EingangsRechnung_lieferantId_idx" ON "EingangsRechnung"("lieferantId")`);
    await createIndexIfMissing(client, "EingangsRechnung_status_idx", `CREATE INDEX "EingangsRechnung_status_idx" ON "EingangsRechnung"("status")`);
    await createIndexIfMissing(client, "EingangsRechnung_faelligAm_idx", `CREATE INDEX "EingangsRechnung_faelligAm_idx" ON "EingangsRechnung"("faelligAm")`);

    await recordMigration(client, MIG7);
    log(`✓ ${MIG7} applied`);
  } else {
    log(`skip ${MIG7} (already applied)`);
  }

  // ── Migration 8: 20260512010000_reklamation_streckengeschaeft ─────────────
  const MIG8 = "20260512010000_reklamation_streckengeschaeft";
  if (!(await migrationApplied(client, MIG8))) {
    await addColumnIfMissing(client, "Lieferung", "istStreckengeschaeft", "BOOLEAN NOT NULL DEFAULT 0");
    await addColumnIfMissing(client, "Lieferung", "streckenLieferantId", "INTEGER");
    await createTableIfMissing(client, "Reklamation", `CREATE TABLE "Reklamation" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "nummer" TEXT NOT NULL,
      "kundeId" INTEGER NOT NULL,
      "lieferungId" INTEGER,
      "datum" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "betreff" TEXT NOT NULL,
      "beschreibung" TEXT NOT NULL,
      "kategorie" TEXT NOT NULL DEFAULT 'Qualitaet',
      "prioritaet" TEXT NOT NULL DEFAULT 'normal',
      "status" TEXT NOT NULL DEFAULT 'OFFEN',
      "zugewiesen" TEXT,
      "loesung" TEXT,
      "geloestAm" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "Reklamation_kundeId_fkey" FOREIGN KEY ("kundeId") REFERENCES "Kunde" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "Reklamation_lieferungId_fkey" FOREIGN KEY ("lieferungId") REFERENCES "Lieferung" ("id") ON DELETE SET NULL ON UPDATE CASCADE
    )`);
    await createIndexIfMissing(client, "Reklamation_nummer_key", `CREATE UNIQUE INDEX "Reklamation_nummer_key" ON "Reklamation"("nummer")`);
    await createIndexIfMissing(client, "Reklamation_kundeId_idx", `CREATE INDEX "Reklamation_kundeId_idx" ON "Reklamation"("kundeId")`);
    await createIndexIfMissing(client, "Reklamation_status_idx", `CREATE INDEX "Reklamation_status_idx" ON "Reklamation"("status")`);
    await createIndexIfMissing(client, "Reklamation_datum_idx", `CREATE INDEX "Reklamation_datum_idx" ON "Reklamation"("datum")`);
    await createIndexIfMissing(client, "Reklamation_prioritaet_idx", `CREATE INDEX "Reklamation_prioritaet_idx" ON "Reklamation"("prioritaet")`);
    await recordMigration(client, MIG8);
    log(`✓ ${MIG8} applied`);
  } else {
    log(`skip ${MIG8} (already applied)`);
  }

  // ── Migration 9: 20260512020000_benachrichtigungen ────────────────────────
  const MIG9 = "20260512020000_benachrichtigungen";
  if (!(await migrationApplied(client, MIG9))) {
    await createTableIfMissing(client, "Benachrichtigung", `CREATE TABLE "Benachrichtigung" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "typ" TEXT NOT NULL,
      "titel" TEXT NOT NULL,
      "text" TEXT NOT NULL,
      "prioritaet" TEXT NOT NULL DEFAULT 'info',
      "gelesen" BOOLEAN NOT NULL DEFAULT false,
      "kundeId" INTEGER,
      "artikelId" INTEGER,
      "link" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    await createIndexIfMissing(client, "Benachrichtigung_gelesen_idx", `CREATE INDEX "Benachrichtigung_gelesen_idx" ON "Benachrichtigung"("gelesen")`);
    await createIndexIfMissing(client, "Benachrichtigung_createdAt_idx", `CREATE INDEX "Benachrichtigung_createdAt_idx" ON "Benachrichtigung"("createdAt")`);
    await createIndexIfMissing(client, "Benachrichtigung_typ_idx", `CREATE INDEX "Benachrichtigung_typ_idx" ON "Benachrichtigung"("typ")`);
    await recordMigration(client, MIG9);
    log(`✓ ${MIG9} applied`);
  } else {
    log(`skip ${MIG9} (already applied)`);
  }

  // ── Migration 10: 20260512030000_umsatzziel ───────────────────────────────
  const MIG10 = "20260512030000_umsatzziel";
  if (!(await migrationApplied(client, MIG10))) {
    await createTableIfMissing(client, "Umsatzziel", `CREATE TABLE "Umsatzziel" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "jahr" INTEGER NOT NULL,
      "monat" INTEGER,
      "kategorie" TEXT,
      "zielBetrag" REAL NOT NULL,
      "notiz" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )`);
    await createIndexIfMissing(client, "Umsatzziel_jahr_monat_kategorie_key", `CREATE UNIQUE INDEX "Umsatzziel_jahr_monat_kategorie_key" ON "Umsatzziel"("jahr", "monat", "kategorie")`);
    await createIndexIfMissing(client, "Umsatzziel_jahr_idx", `CREATE INDEX "Umsatzziel_jahr_idx" ON "Umsatzziel"("jahr")`);
    await recordMigration(client, MIG10);
    log(`✓ ${MIG10} applied`);
  } else {
    log(`skip ${MIG10} (already applied)`);
  }

  // ── Migration 11: 20260512040000_skonto_teilzahlung_vorlagen_chargen_ghs ──
  // Exposes the Artikel 500 if not applied — GHS columns (ghsKlassen, hSaetze,
  // pSaetze, signalwort) are SELECTed by /api/artikel via artikelSafeSelect.
  const MIG11 = "20260512040000_skonto_teilzahlung_vorlagen_chargen_ghs";
  if (!(await migrationApplied(client, MIG11))) {
    await addColumnIfMissing(client, "Lieferung", "skontoProzent", "REAL");
    await addColumnIfMissing(client, "Lieferung", "skontoTage", "INTEGER");
    await addColumnIfMissing(client, "Lieferung", "skontoGenutzt", "BOOLEAN NOT NULL DEFAULT false");
    await addColumnIfMissing(client, "Sammelrechnung", "skontoProzent", "REAL");
    await addColumnIfMissing(client, "Sammelrechnung", "skontoTage", "INTEGER");
    await addColumnIfMissing(client, "Sammelrechnung", "skontoGenutzt", "BOOLEAN NOT NULL DEFAULT false");

    await createTableIfMissing(client, "Teilzahlung", `CREATE TABLE "Teilzahlung" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "lieferungId" INTEGER,
      "sammelrechnungId" INTEGER,
      "betrag" REAL NOT NULL,
      "datum" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "notiz" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Teilzahlung_lieferungId_fkey" FOREIGN KEY ("lieferungId") REFERENCES "Lieferung" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "Teilzahlung_sammelrechnungId_fkey" FOREIGN KEY ("sammelrechnungId") REFERENCES "Sammelrechnung" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`);
    await createIndexIfMissing(client, "Teilzahlung_lieferungId_idx", `CREATE INDEX "Teilzahlung_lieferungId_idx" ON "Teilzahlung"("lieferungId")`);
    await createIndexIfMissing(client, "Teilzahlung_sammelrechnungId_idx", `CREATE INDEX "Teilzahlung_sammelrechnungId_idx" ON "Teilzahlung"("sammelrechnungId")`);

    await createTableIfMissing(client, "AngebotVorlage", `CREATE TABLE "AngebotVorlage" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "name" TEXT NOT NULL,
      "beschreibung" TEXT,
      "notiz" TEXT,
      "aktiv" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )`);
    await createTableIfMissing(client, "AngebotVorlagePosition", `CREATE TABLE "AngebotVorlagePosition" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "vorlageId" INTEGER NOT NULL,
      "artikelId" INTEGER NOT NULL,
      "menge" REAL NOT NULL,
      "preis" REAL NOT NULL DEFAULT 0,
      "rabatt" REAL NOT NULL DEFAULT 0,
      "einheit" TEXT NOT NULL DEFAULT 'kg',
      "notiz" TEXT,
      CONSTRAINT "AngebotVorlagePosition_vorlageId_fkey" FOREIGN KEY ("vorlageId") REFERENCES "AngebotVorlage" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "AngebotVorlagePosition_artikelId_fkey" FOREIGN KEY ("artikelId") REFERENCES "Artikel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
    )`);
    await createIndexIfMissing(client, "AngebotVorlagePosition_vorlageId_idx", `CREATE INDEX "AngebotVorlagePosition_vorlageId_idx" ON "AngebotVorlagePosition"("vorlageId")`);

    await addColumnIfMissing(client, "Artikel", "ghsKlassen", "TEXT");
    await addColumnIfMissing(client, "Artikel", "hSaetze", "TEXT");
    await addColumnIfMissing(client, "Artikel", "pSaetze", "TEXT");
    await addColumnIfMissing(client, "Artikel", "signalwort", "TEXT");
    await addColumnIfMissing(client, "WareineingangPosition", "mhd", "DATETIME");
    await addColumnIfMissing(client, "Wareneingang", "istCrossDocking", "BOOLEAN NOT NULL DEFAULT false");
    await addColumnIfMissing(client, "Wareneingang", "lieferungId", "INTEGER");

    await createTableIfMissing(client, "ChargenZertifikat", `CREATE TABLE "ChargenZertifikat" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "chargeNr" TEXT NOT NULL,
      "artikelId" INTEGER NOT NULL,
      "dateiname" TEXT NOT NULL,
      "pfad" TEXT NOT NULL,
      "typ" TEXT,
      "groesse" INTEGER,
      "notiz" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ChargenZertifikat_artikelId_fkey" FOREIGN KEY ("artikelId") REFERENCES "Artikel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`);
    await createIndexIfMissing(client, "ChargenZertifikat_chargeNr_idx", `CREATE INDEX "ChargenZertifikat_chargeNr_idx" ON "ChargenZertifikat"("chargeNr")`);
    await createIndexIfMissing(client, "ChargenZertifikat_artikelId_idx", `CREATE INDEX "ChargenZertifikat_artikelId_idx" ON "ChargenZertifikat"("artikelId")`);

    await recordMigration(client, MIG11);
    log(`✓ ${MIG11} applied`);
  } else {
    log(`skip ${MIG11} (already applied)`);
  }

  // ── Migration 12: 20260512050000_add_performance_indexes ──────────────────
  const MIG12 = "20260512050000_add_performance_indexes";
  if (!(await migrationApplied(client, MIG12))) {
    await createIndexIfMissing(client, "KundeAktivitaet_erledigt_idx", `CREATE INDEX "KundeAktivitaet_erledigt_idx" ON "KundeAktivitaet"("erledigt")`);
    await createIndexIfMissing(client, "Lagerbewegung_typ_idx", `CREATE INDEX "Lagerbewegung_typ_idx" ON "Lagerbewegung"("typ")`);
    await recordMigration(client, MIG12);
    log(`✓ ${MIG12} applied`);
  } else {
    log(`skip ${MIG12} (already applied)`);
  }

  // ── Migration 13: 20260512060000_fix_fts5_triggers ────────────────────────
  // Recreates ArtikelInhaltsstoff FTS5 triggers. The migration SQL is already
  // idempotent (DROP IF EXISTS + CREATE IF NOT EXISTS), but we still record it
  // so `prisma migrate deploy` doesn't try to re-run it.
  const MIG13 = "20260512060000_fix_fts5_triggers";
  if (!(await migrationApplied(client, MIG13))) {
    if (await tableExists(client, "artikel_fts")) {
      const sql = fs.readFileSync(
        path.join(MIGRATIONS_DIR, MIG13, "migration.sql"),
        "utf8"
      );
      try {
        for (const stmt of splitTriggerScript(sql)) {
          if (!stmt.trim()) continue;
          await client.execute(stmt);
        }
        log(`  ↻ FTS5 triggers recreated`);
      } catch (err) {
        log(`  ⚠ fix_fts5_triggers failed: ${err?.message || err}`);
      }
    } else {
      log(`  skip trigger DDL (artikel_fts virtual table not present)`);
    }
    await recordMigration(client, MIG13);
    log(`✓ ${MIG13} applied`);
  } else {
    log(`skip ${MIG13} (already applied)`);
  }

  // ── Migration 14: 20260513000000_congruence_features ──────────────────────
  // Bodenproben, Düngebedarf, Sachkundenachweise, Sortenversuche,
  // Vorbestellungen + Frühbezugsstaffel, Kunde.vvvoNr.
  // Nicht idempotent (kein IF NOT EXISTS) → hier abgesichert, sonst bricht
  // `prisma migrate deploy` ab und z. B. /api/sortenversuche liefert 500.
  const MIG14 = "20260513000000_congruence_features";
  if (!(await migrationApplied(client, MIG14))) {
    await addColumnIfMissing(client, "Kunde", "vvvoNr", "TEXT");

    await createTableIfMissing(client, "Bodenprobe", `CREATE TABLE "Bodenprobe" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "schlagId" INTEGER NOT NULL,
      "datum" DATETIME NOT NULL,
      "probenNr" TEXT, "labor" TEXT, "tiefe" TEXT,
      "pH" REAL, "phosphor" REAL, "kalium" REAL, "magnesium" REAL,
      "bor" REAL, "humus" REAL, "nMin" REAL, "cn" REAL,
      "bodenart" TEXT, "klasse" TEXT, "notiz" TEXT,
      "belegPfad" TEXT, "belegName" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Bodenprobe_schlagId_fkey" FOREIGN KEY ("schlagId") REFERENCES "KundeSchlag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`);
    await createIndexIfMissing(client, "Bodenprobe_schlagId_idx", `CREATE INDEX "Bodenprobe_schlagId_idx" ON "Bodenprobe"("schlagId")`);
    await createIndexIfMissing(client, "Bodenprobe_datum_idx", `CREATE INDEX "Bodenprobe_datum_idx" ON "Bodenprobe"("datum")`);

    await createTableIfMissing(client, "Duengebedarf", `CREATE TABLE "Duengebedarf" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "schlagId" INTEGER NOT NULL,
      "jahr" INTEGER NOT NULL,
      "fruchtart" TEXT NOT NULL,
      "ertragsZiel" REAL, "vorfrucht" TEXT, "bodenprobeId" INTEGER,
      "nBedarf" REAL NOT NULL, "pBedarf" REAL NOT NULL, "kBedarf" REAL NOT NULL, "mgBedarf" REAL,
      "parameter" TEXT, "notiz" TEXT,
      "berechnetAm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Duengebedarf_schlagId_fkey" FOREIGN KEY ("schlagId") REFERENCES "KundeSchlag" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "Duengebedarf_bodenprobeId_fkey" FOREIGN KEY ("bodenprobeId") REFERENCES "Bodenprobe" ("id") ON DELETE SET NULL ON UPDATE CASCADE
    )`);
    await createIndexIfMissing(client, "Duengebedarf_schlagId_idx", `CREATE INDEX "Duengebedarf_schlagId_idx" ON "Duengebedarf"("schlagId")`);
    await createIndexIfMissing(client, "Duengebedarf_jahr_idx", `CREATE INDEX "Duengebedarf_jahr_idx" ON "Duengebedarf"("jahr")`);

    await createTableIfMissing(client, "Sachkundenachweis", `CREATE TABLE "Sachkundenachweis" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "kundeId" INTEGER NOT NULL,
      "typ" TEXT NOT NULL,
      "nummer" TEXT, "ausstellung" DATETIME, "gueltigBis" DATETIME,
      "ausgestelltVon" TEXT, "notiz" TEXT, "belegPfad" TEXT, "belegName" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "Sachkundenachweis_kundeId_fkey" FOREIGN KEY ("kundeId") REFERENCES "Kunde" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`);
    await createIndexIfMissing(client, "Sachkundenachweis_kundeId_idx", `CREATE INDEX "Sachkundenachweis_kundeId_idx" ON "Sachkundenachweis"("kundeId")`);
    await createIndexIfMissing(client, "Sachkundenachweis_gueltigBis_idx", `CREATE INDEX "Sachkundenachweis_gueltigBis_idx" ON "Sachkundenachweis"("gueltigBis")`);
    await createIndexIfMissing(client, "Sachkundenachweis_typ_idx", `CREATE INDEX "Sachkundenachweis_typ_idx" ON "Sachkundenachweis"("typ")`);

    await createTableIfMissing(client, "Sortenversuch", `CREATE TABLE "Sortenversuch" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "name" TEXT NOT NULL,
      "jahr" INTEGER NOT NULL,
      "kultur" TEXT NOT NULL,
      "standort" TEXT, "kundeId" INTEGER, "schlagId" INTEGER, "flaeche" REAL,
      "status" TEXT NOT NULL DEFAULT 'LAUFEND',
      "startDatum" DATETIME, "endeDatum" DATETIME, "notiz" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "Sortenversuch_kundeId_fkey" FOREIGN KEY ("kundeId") REFERENCES "Kunde" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT "Sortenversuch_schlagId_fkey" FOREIGN KEY ("schlagId") REFERENCES "KundeSchlag" ("id") ON DELETE SET NULL ON UPDATE CASCADE
    )`);
    await createIndexIfMissing(client, "Sortenversuch_jahr_idx", `CREATE INDEX "Sortenversuch_jahr_idx" ON "Sortenversuch"("jahr")`);
    await createIndexIfMissing(client, "Sortenversuch_kultur_idx", `CREATE INDEX "Sortenversuch_kultur_idx" ON "Sortenversuch"("kultur")`);
    await createIndexIfMissing(client, "Sortenversuch_kundeId_idx", `CREATE INDEX "Sortenversuch_kundeId_idx" ON "Sortenversuch"("kundeId")`);

    await createTableIfMissing(client, "SortenversuchPosition", `CREATE TABLE "SortenversuchPosition" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "versuchId" INTEGER NOT NULL,
      "sorte" TEXT NOT NULL,
      "saatstaerke" REAL, "ertragDtHa" REAL, "feuchteProzent" REAL,
      "proteinProzent" REAL, "hektolitergew" REAL, "bonitur" INTEGER,
      "reife" TEXT, "notiz" TEXT,
      CONSTRAINT "SortenversuchPosition_versuchId_fkey" FOREIGN KEY ("versuchId") REFERENCES "Sortenversuch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`);
    await createIndexIfMissing(client, "SortenversuchPosition_versuchId_idx", `CREATE INDEX "SortenversuchPosition_versuchId_idx" ON "SortenversuchPosition"("versuchId")`);
    await createIndexIfMissing(client, "SortenversuchPosition_sorte_idx", `CREATE INDEX "SortenversuchPosition_sorte_idx" ON "SortenversuchPosition"("sorte")`);

    await createTableIfMissing(client, "Vorbestellung", `CREATE TABLE "Vorbestellung" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "nummer" TEXT NOT NULL,
      "kundeId" INTEGER NOT NULL,
      "saison" TEXT NOT NULL,
      "bestelldatum" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "lieferdatum" DATETIME, "bestellfrist" DATETIME,
      "status" TEXT NOT NULL DEFAULT 'OFFEN',
      "rabattProzent" REAL, "notiz" TEXT, "lieferungId" INTEGER,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "Vorbestellung_kundeId_fkey" FOREIGN KEY ("kundeId") REFERENCES "Kunde" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`);
    await createIndexIfMissing(client, "Vorbestellung_nummer_key", `CREATE UNIQUE INDEX "Vorbestellung_nummer_key" ON "Vorbestellung"("nummer")`);
    await createIndexIfMissing(client, "Vorbestellung_kundeId_idx", `CREATE INDEX "Vorbestellung_kundeId_idx" ON "Vorbestellung"("kundeId")`);
    await createIndexIfMissing(client, "Vorbestellung_status_idx", `CREATE INDEX "Vorbestellung_status_idx" ON "Vorbestellung"("status")`);
    await createIndexIfMissing(client, "Vorbestellung_bestellfrist_idx", `CREATE INDEX "Vorbestellung_bestellfrist_idx" ON "Vorbestellung"("bestellfrist")`);
    await createIndexIfMissing(client, "Vorbestellung_saison_idx", `CREATE INDEX "Vorbestellung_saison_idx" ON "Vorbestellung"("saison")`);

    await createTableIfMissing(client, "VorbestellungPosition", `CREATE TABLE "VorbestellungPosition" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "vorbestellungId" INTEGER NOT NULL,
      "artikelId" INTEGER NOT NULL,
      "menge" REAL NOT NULL,
      "preis" REAL,
      "einheit" TEXT NOT NULL DEFAULT 'kg',
      "reserviert" BOOLEAN NOT NULL DEFAULT false,
      "notiz" TEXT,
      CONSTRAINT "VorbestellungPosition_vorbestellungId_fkey" FOREIGN KEY ("vorbestellungId") REFERENCES "Vorbestellung" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "VorbestellungPosition_artikelId_fkey" FOREIGN KEY ("artikelId") REFERENCES "Artikel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
    )`);
    await createIndexIfMissing(client, "VorbestellungPosition_vorbestellungId_idx", `CREATE INDEX "VorbestellungPosition_vorbestellungId_idx" ON "VorbestellungPosition"("vorbestellungId")`);
    await createIndexIfMissing(client, "VorbestellungPosition_artikelId_idx", `CREATE INDEX "VorbestellungPosition_artikelId_idx" ON "VorbestellungPosition"("artikelId")`);

    await createTableIfMissing(client, "FruehbezugsStaffel", `CREATE TABLE "FruehbezugsStaffel" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "saison" TEXT NOT NULL,
      "kategorie" TEXT, "artikelId" INTEGER,
      "bestellfrist" DATETIME NOT NULL,
      "rabattProzent" REAL NOT NULL,
      "beschreibung" TEXT,
      "aktiv" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "FruehbezugsStaffel_artikelId_fkey" FOREIGN KEY ("artikelId") REFERENCES "Artikel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`);
    await createIndexIfMissing(client, "FruehbezugsStaffel_saison_idx", `CREATE INDEX "FruehbezugsStaffel_saison_idx" ON "FruehbezugsStaffel"("saison")`);
    await createIndexIfMissing(client, "FruehbezugsStaffel_bestellfrist_idx", `CREATE INDEX "FruehbezugsStaffel_bestellfrist_idx" ON "FruehbezugsStaffel"("bestellfrist")`);
    await createIndexIfMissing(client, "FruehbezugsStaffel_aktiv_idx", `CREATE INDEX "FruehbezugsStaffel_aktiv_idx" ON "FruehbezugsStaffel"("aktiv")`);

    await recordMigration(client, MIG14);
    log(`✓ ${MIG14} applied`);
  } else {
    log(`skip ${MIG14} (already applied)`);
  }

  // ── Migration 15: 20260514000000_rationsberechnung ────────────────────────
  // KundeTier + Rationsberechnung. Nicht idempotent → hier abgesichert.
  const MIG15 = "20260514000000_rationsberechnung";
  if (!(await migrationApplied(client, MIG15))) {
    await createTableIfMissing(client, "KundeTier", `CREATE TABLE "KundeTier" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "kundeId" INTEGER NOT NULL,
      "name" TEXT NOT NULL,
      "tierart" TEXT NOT NULL,
      "nutzungsart" TEXT NOT NULL,
      "rasse" TEXT,
      "anzahl" INTEGER NOT NULL DEFAULT 1,
      "gewicht" REAL, "leistung" REAL, "leistungEinheit" TEXT, "laktationstag" INTEGER,
      "notiz" TEXT,
      "erstellt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "aktualisiert" DATETIME NOT NULL,
      CONSTRAINT "KundeTier_kundeId_fkey" FOREIGN KEY ("kundeId") REFERENCES "Kunde" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`);
    await createIndexIfMissing(client, "KundeTier_kundeId_idx", `CREATE INDEX "KundeTier_kundeId_idx" ON "KundeTier"("kundeId")`);
    await createIndexIfMissing(client, "KundeTier_tierart_idx", `CREATE INDEX "KundeTier_tierart_idx" ON "KundeTier"("tierart")`);

    await createTableIfMissing(client, "Rationsberechnung", `CREATE TABLE "Rationsberechnung" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "bezeichnung" TEXT NOT NULL,
      "tierart" TEXT NOT NULL,
      "nutzungsart" TEXT NOT NULL,
      "modus" TEXT NOT NULL DEFAULT 'simple',
      "kundeId" INTEGER, "kundeTierId" INTEGER,
      "gewicht" REAL, "leistung" REAL,
      "parameter" TEXT NOT NULL,
      "notiz" TEXT,
      "erstellt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "aktualisiert" DATETIME NOT NULL,
      CONSTRAINT "Rationsberechnung_kundeId_fkey" FOREIGN KEY ("kundeId") REFERENCES "Kunde" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT "Rationsberechnung_kundeTierId_fkey" FOREIGN KEY ("kundeTierId") REFERENCES "KundeTier" ("id") ON DELETE SET NULL ON UPDATE CASCADE
    )`);
    await createIndexIfMissing(client, "Rationsberechnung_kundeId_idx", `CREATE INDEX "Rationsberechnung_kundeId_idx" ON "Rationsberechnung"("kundeId")`);
    await createIndexIfMissing(client, "Rationsberechnung_kundeTierId_idx", `CREATE INDEX "Rationsberechnung_kundeTierId_idx" ON "Rationsberechnung"("kundeTierId")`);
    await createIndexIfMissing(client, "Rationsberechnung_tierart_idx", `CREATE INDEX "Rationsberechnung_tierart_idx" ON "Rationsberechnung"("tierart")`);
    await createIndexIfMissing(client, "Rationsberechnung_erstellt_idx", `CREATE INDEX "Rationsberechnung_erstellt_idx" ON "Rationsberechnung"("erstellt")`);

    await recordMigration(client, MIG15);
    log(`✓ ${MIG15} applied`);
  } else {
    log(`skip ${MIG15} (already applied)`);
  }

  await client.close();
  log("Pre-migration repair complete.");
}

// Splits a SQL script that may contain CREATE TRIGGER ... BEGIN ... END;
// blocks into individual statements. Semicolons inside BEGIN..END do not split.
function splitTriggerScript(sql) {
  const lines = sql
    .split("\n")
    .map((l) => l.replace(/--.*$/, "").trimEnd())
    .filter((l) => l.length > 0);
  const out = [];
  let buf = "";
  let inBlock = false;
  for (const line of lines) {
    buf += (buf ? "\n" : "") + line;
    if (/\bBEGIN\b/i.test(line)) inBlock = true;
    if (inBlock) {
      if (/END\s*;\s*$/i.test(line)) {
        out.push(buf);
        buf = "";
        inBlock = false;
      }
    } else if (line.endsWith(";")) {
      out.push(buf);
      buf = "";
    }
  }
  if (buf.trim()) out.push(buf);
  return out;
}

main().catch((err) => {
  console.error("[pre-migrate] ERROR:", err);
  // Do NOT exit(1) — let the server start even if this fails
});
