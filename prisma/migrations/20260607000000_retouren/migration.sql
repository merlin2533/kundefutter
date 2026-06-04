-- Retouren (Lieferantenrückgaben) + Verknüpfung in Lagerbewegung

-- CreateTable
CREATE TABLE "Retoure" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nummer" TEXT NOT NULL,
    "lieferantId" INTEGER NOT NULL,
    "datum" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grund" TEXT NOT NULL DEFAULT 'Kommission',
    "notiz" TEXT,
    "status" TEXT NOT NULL DEFAULT 'GEBUCHT',
    "gutschriftBetrag" REAL,
    "eingangsRechnungId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Retoure_lieferantId_fkey" FOREIGN KEY ("lieferantId") REFERENCES "Lieferant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Retoure_eingangsRechnungId_fkey" FOREIGN KEY ("eingangsRechnungId") REFERENCES "EingangsRechnung" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RetourePosition" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "retoureId" INTEGER NOT NULL,
    "artikelId" INTEGER NOT NULL,
    "menge" REAL NOT NULL,
    "einkaufspreis" REAL NOT NULL DEFAULT 0,
    "chargeNr" TEXT,
    CONSTRAINT "RetourePosition_retoureId_fkey" FOREIGN KEY ("retoureId") REFERENCES "Retoure" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RetourePosition_artikelId_fkey" FOREIGN KEY ("artikelId") REFERENCES "Artikel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- AlterTable
ALTER TABLE "Lagerbewegung" ADD COLUMN "retoureId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Retoure_nummer_key" ON "Retoure"("nummer");
CREATE INDEX "Retoure_lieferantId_idx" ON "Retoure"("lieferantId");
CREATE INDEX "Retoure_status_idx" ON "Retoure"("status");
CREATE INDEX "Retoure_datum_idx" ON "Retoure"("datum");
CREATE INDEX "RetourePosition_retoureId_idx" ON "RetourePosition"("retoureId");
CREATE INDEX "RetourePosition_artikelId_idx" ON "RetourePosition"("artikelId");
CREATE INDEX "Lagerbewegung_retoureId_idx" ON "Lagerbewegung"("retoureId");
