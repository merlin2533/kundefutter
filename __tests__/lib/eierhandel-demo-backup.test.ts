import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { createClient } from "@libsql/client";

// Das eingecheckte Demo-Backup muss alle Prisma-Migrationen enthalten — sonst fehlen nach dem
// Wiederherstellen (v.a. außerhalb von Docker, wo kein `migrate deploy` nachläuft) Spalten.
// Bei Fehlschlag: `npm run seed:eierhandel:backup` neu laufen lassen und committen.
describe("Eierhandel-Demo-Backup", () => {
  it("enthält alle Migrationen aus prisma/migrations", async () => {
    const root = path.resolve(__dirname, "../..");
    const migrationen = fs
      .readdirSync(path.join(root, "prisma/migrations"), { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();

    const db = createClient({ url: `file:${path.join(root, "demodaten/eierhandel/eierhandel-demo-backup.db")}` });
    try {
      const res = await db.execute('SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL');
      const imBackup = new Set(res.rows.map((r) => String(r.migration_name)));
      const fehlend = migrationen.filter((m) => !imBackup.has(m));
      expect(fehlend).toEqual([]);
    } finally {
      db.close();
    }
  });
});
