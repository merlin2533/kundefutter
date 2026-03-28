-- AlterTable
ALTER TABLE "Kunde" ADD COLUMN "betriebsnummer" TEXT;
ALTER TABLE "Kunde" ADD COLUMN "flaeche" REAL;

-- CreateTable
CREATE TABLE "AntragEmpfaenger" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "haushaltsjahr" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "plz" TEXT,
    "gemeinde" TEXT,
    "land" TEXT,
    "egflGesamt" REAL NOT NULL DEFAULT 0,
    "elerGesamt" REAL NOT NULL DEFAULT 0,
    "gesamtBetrag" REAL NOT NULL DEFAULT 0,
    "massnahmen" TEXT,
    "mutterunternehmen" TEXT,
    "importiertAm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kundeId" INTEGER,
    CONSTRAINT "AntragEmpfaenger_kundeId_fkey" FOREIGN KEY ("kundeId") REFERENCES "Kunde" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AntragEmpfaenger_name_idx" ON "AntragEmpfaenger"("name");

-- CreateIndex
CREATE INDEX "AntragEmpfaenger_plz_idx" ON "AntragEmpfaenger"("plz");

-- CreateIndex
CREATE INDEX "AntragEmpfaenger_gemeinde_idx" ON "AntragEmpfaenger"("gemeinde");

-- CreateIndex
CREATE INDEX "AntragEmpfaenger_haushaltsjahr_idx" ON "AntragEmpfaenger"("haushaltsjahr");

-- CreateIndex
CREATE INDEX "AntragEmpfaenger_kundeId_idx" ON "AntragEmpfaenger"("kundeId");
