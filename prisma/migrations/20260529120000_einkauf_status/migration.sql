-- CreateTable
CREATE TABLE IF NOT EXISTS "EinkaufStatus" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "quelle" TEXT NOT NULL,
    "positionId" INTEGER NOT NULL,
    "artikelId" INTEGER NOT NULL,
    "lieferantId" INTEGER,
    "menge" REAL NOT NULL,
    "einheit" TEXT NOT NULL DEFAULT 'kg',
    "bestelltAm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notiz" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "EinkaufStatus_quelle_positionId_key" ON "EinkaufStatus"("quelle", "positionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EinkaufStatus_artikelId_idx" ON "EinkaufStatus"("artikelId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EinkaufStatus_lieferantId_idx" ON "EinkaufStatus"("lieferantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EinkaufStatus_quelle_idx" ON "EinkaufStatus"("quelle");
