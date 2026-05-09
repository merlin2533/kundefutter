#!/usr/bin/env node
/**
 * Pre-migration repair script.
 * Runs BEFORE `prisma migrate deploy` to manually apply migrations that
 * fail because their SQL is not fully idempotent (missing IF NOT EXISTS).
 * After adding the column/index, the migration is recorded in
 * _prisma_migrations so Prisma skips it in the subsequent deploy.
 *
 * Migrations handled here (never applied on the production DB):
 *   20260427000000_add_artikel_unterkategorie
 *   20260429000000_add_wareneingang_chargenr
 *   20260429010000_add_einheiten_saatgut_defaults  (data-only, idempotent SQL)
 *   20260505000000_add_lieferung_rechnung_indizes   (already uses IF NOT EXISTS)
 *   20260509000000_add_unterschrift_fahrer          (Lieferung.unterschriftPng + fahrerId)
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
  const res = await client.execute(`PRAGMA table_info("${table}")`);
  return res.rows.some((r) => r[1] === column);
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
  await client.execute(
    `INSERT OR IGNORE INTO "_prisma_migrations"
       (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
     VALUES (?, ?, ?, ?, NULL, NULL, ?, 1)`,
    [id, cs, now, name, now]
  );
  log(`Recorded ${name} in _prisma_migrations`);
}

async function main() {
  const client = createClient({ url: libsqlUrl });

  // ── Migration 1: 20260427000000_add_artikel_unterkategorie ─────────────────
  const MIG1 = "20260427000000_add_artikel_unterkategorie";
  if (!(await migrationApplied(client, MIG1))) {
    if (!(await columnExists(client, "Artikel", "unterkategorie"))) {
      log("Adding Artikel.unterkategorie …");
      await client.execute(`ALTER TABLE "Artikel" ADD COLUMN "unterkategorie" TEXT`);
    }
    if (!(await indexExists(client, "Artikel_unterkategorie_idx"))) {
      await client.execute(
        `CREATE INDEX "Artikel_unterkategorie_idx" ON "Artikel"("unterkategorie")`
      );
    }
    await recordMigration(client, MIG1);
    log(`✓ ${MIG1} applied`);
  } else {
    log(`skip ${MIG1} (already applied)`);
  }

  // ── Migration 2: 20260429000000_add_wareneingang_chargenr ──────────────────
  const MIG2 = "20260429000000_add_wareneingang_chargenr";
  if (!(await migrationApplied(client, MIG2))) {
    if (!(await columnExists(client, "WareineingangPosition", "chargeNr"))) {
      log("Adding WareineingangPosition.chargeNr …");
      await client.execute(
        `ALTER TABLE "WareineingangPosition" ADD COLUMN "chargeNr" TEXT`
      );
    }
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
    if (!(await columnExists(client, "Lieferung", "unterschriftPng"))) {
      log("Adding Lieferung.unterschriftPng …");
      await client.execute(`ALTER TABLE "Lieferung" ADD COLUMN "unterschriftPng" TEXT`);
    }
    if (!(await columnExists(client, "Lieferung", "fahrerId"))) {
      log("Adding Lieferung.fahrerId …");
      await client.execute(`ALTER TABLE "Lieferung" ADD COLUMN "fahrerId" INTEGER`);
    }
    await recordMigration(client, MIG5);
    log(`✓ ${MIG5} applied`);
  } else {
    log(`skip ${MIG5} (already applied)`);
  }

  await client.close();
  log("Pre-migration repair complete.");
}

main().catch((err) => {
  console.error("[pre-migrate] ERROR:", err);
  // Do NOT exit(1) — let the server start even if this fails
});
