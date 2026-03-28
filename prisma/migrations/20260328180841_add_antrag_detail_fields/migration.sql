-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AntragEmpfaenger" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "haushaltsjahr" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "plz" TEXT,
    "gemeinde" TEXT,
    "land" TEXT,
    "steuerNr" TEXT,
    "egflGesamt" REAL NOT NULL DEFAULT 0,
    "elerGesamt" REAL NOT NULL DEFAULT 0,
    "nationalKofiGesamt" REAL NOT NULL DEFAULT 0,
    "elerUndKofiGesamt" REAL NOT NULL DEFAULT 0,
    "gesamtBetrag" REAL NOT NULL DEFAULT 0,
    "massnahmen" TEXT,
    "mutterunternehmen" TEXT,
    "importiertAm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kundeId" INTEGER,
    CONSTRAINT "AntragEmpfaenger_kundeId_fkey" FOREIGN KEY ("kundeId") REFERENCES "Kunde" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AntragEmpfaenger" ("egflGesamt", "elerGesamt", "gemeinde", "gesamtBetrag", "haushaltsjahr", "id", "importiertAm", "kundeId", "land", "massnahmen", "mutterunternehmen", "name", "plz") SELECT "egflGesamt", "elerGesamt", "gemeinde", "gesamtBetrag", "haushaltsjahr", "id", "importiertAm", "kundeId", "land", "massnahmen", "mutterunternehmen", "name", "plz" FROM "AntragEmpfaenger";
DROP TABLE "AntragEmpfaenger";
ALTER TABLE "new_AntragEmpfaenger" RENAME TO "AntragEmpfaenger";
CREATE INDEX "AntragEmpfaenger_name_idx" ON "AntragEmpfaenger"("name");
CREATE INDEX "AntragEmpfaenger_plz_idx" ON "AntragEmpfaenger"("plz");
CREATE INDEX "AntragEmpfaenger_gemeinde_idx" ON "AntragEmpfaenger"("gemeinde");
CREATE INDEX "AntragEmpfaenger_haushaltsjahr_idx" ON "AntragEmpfaenger"("haushaltsjahr");
CREATE INDEX "AntragEmpfaenger_kundeId_idx" ON "AntragEmpfaenger"("kundeId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
