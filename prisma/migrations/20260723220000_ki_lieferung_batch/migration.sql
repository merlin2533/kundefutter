-- Herkunft einer Lieferung (manuell / KI-Einzel-Scan / KI-Batch-Erkennung)
ALTER TABLE "Lieferung" ADD COLUMN "quelle" TEXT;

-- CreateTable
CREATE TABLE "KiLieferungBatch" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "status" TEXT NOT NULL DEFAULT 'offen',
    "notiz" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "abgeschlossenAm" DATETIME
);

-- CreateIndex
CREATE INDEX "KiLieferungBatch_status_idx" ON "KiLieferungBatch"("status");

-- CreateTable
CREATE TABLE "KiLieferungBatchItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "batchId" INTEGER NOT NULL,
    "reihenfolge" INTEGER NOT NULL DEFAULT 0,
    "dateiPfad" TEXT NOT NULL,
    "dateiName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'wartet',
    "kiRohtext" TEXT,
    "kiErgebnisJson" TEXT,
    "kundeId" INTEGER,
    "kundeKonfidenz" TEXT,
    "positionenJson" TEXT,
    "fehlendeFelder" TEXT,
    "fehlerText" TEXT,
    "entscheidung" TEXT,
    "lieferungId" INTEGER,
    "analysiertAm" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KiLieferungBatchItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "KiLieferungBatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "KiLieferungBatchItem_batchId_idx" ON "KiLieferungBatchItem"("batchId");

-- CreateIndex
CREATE INDEX "KiLieferungBatchItem_status_idx" ON "KiLieferungBatchItem"("status");

-- CreateTable
CREATE TABLE "KiLernZuordnung" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "typ" TEXT NOT NULL,
    "suchtext" TEXT NOT NULL,
    "zielId" INTEGER NOT NULL,
    "trefferAnzahl" INTEGER NOT NULL DEFAULT 1,
    "letzteVerwendung" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "KiLernZuordnung_typ_suchtext_key" ON "KiLernZuordnung"("typ", "suchtext");

-- CreateIndex
CREATE INDEX "KiLernZuordnung_typ_idx" ON "KiLernZuordnung"("typ");
