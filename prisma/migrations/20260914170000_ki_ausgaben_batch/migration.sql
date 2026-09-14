-- CreateTable
CREATE TABLE "KiAusgabenBatch" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "status" TEXT NOT NULL DEFAULT 'offen',
    "notiz" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "abgeschlossenAm" DATETIME
);

-- CreateIndex
CREATE INDEX "KiAusgabenBatch_status_idx" ON "KiAusgabenBatch"("status");

-- CreateTable
CREATE TABLE "KiAusgabenBatchItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "batchId" INTEGER NOT NULL,
    "reihenfolge" INTEGER NOT NULL DEFAULT 0,
    "dateiPfad" TEXT NOT NULL,
    "dateiName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'wartet',
    "kiRohtext" TEXT,
    "kiErgebnisJson" TEXT,
    "lieferantId" INTEGER,
    "lieferantKonfidenz" TEXT,
    "datum" TEXT,
    "belegNr" TEXT,
    "beschreibung" TEXT,
    "betragNetto" REAL,
    "mwstSatz" REAL,
    "betragNetto2" REAL,
    "mwstSatz2" REAL,
    "kategorie" TEXT,
    "fehlendeFelder" TEXT,
    "fehlerText" TEXT,
    "entscheidung" TEXT,
    "ausgabeId" INTEGER,
    "analysiertAm" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KiAusgabenBatchItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "KiAusgabenBatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "KiAusgabenBatchItem_batchId_idx" ON "KiAusgabenBatchItem"("batchId");

-- CreateIndex
CREATE INDEX "KiAusgabenBatchItem_status_idx" ON "KiAusgabenBatchItem"("status");
