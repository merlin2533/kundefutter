-- CreateTable
CREATE TABLE "KiEingangsrechnungBatch" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "status" TEXT NOT NULL DEFAULT 'offen',
    "notiz" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "abgeschlossenAm" DATETIME
);

-- CreateIndex
CREATE INDEX "KiEingangsrechnungBatch_status_idx" ON "KiEingangsrechnungBatch"("status");

-- CreateTable
CREATE TABLE "KiEingangsrechnungBatchItem" (
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
    "nummer" TEXT,
    "datum" TEXT,
    "faelligAm" TEXT,
    "betragNetto" REAL,
    "mwstSatz" REAL,
    "notiz" TEXT,
    "fehlendeFelder" TEXT,
    "fehlerText" TEXT,
    "entscheidung" TEXT,
    "eingangsRechnungId" INTEGER,
    "analysiertAm" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KiEingangsrechnungBatchItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "KiEingangsrechnungBatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "KiEingangsrechnungBatchItem_batchId_idx" ON "KiEingangsrechnungBatchItem"("batchId");

-- CreateIndex
CREATE INDEX "KiEingangsrechnungBatchItem_status_idx" ON "KiEingangsrechnungBatchItem"("status");
