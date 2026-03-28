-- AlterTable
ALTER TABLE "Artikel" ADD COLUMN "lagerort" TEXT;

-- AlterTable
ALTER TABLE "Lagerbewegung" ADD COLUMN "lagerortNach" TEXT;
ALTER TABLE "Lagerbewegung" ADD COLUMN "lagerortVon" TEXT;

-- CreateTable
CREATE TABLE "Inventur" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "datum" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'OFFEN',
    "bezeichnung" TEXT
);

-- CreateTable
CREATE TABLE "InventurPosition" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "inventurId" INTEGER NOT NULL,
    "artikelId" INTEGER NOT NULL,
    "sollBestand" REAL NOT NULL,
    "istBestand" REAL,
    "differenz" REAL,
    "bemerkung" TEXT,
    CONSTRAINT "InventurPosition_inventurId_fkey" FOREIGN KEY ("inventurId") REFERENCES "Inventur" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InventurPosition_artikelId_fkey" FOREIGN KEY ("artikelId") REFERENCES "Artikel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Inventur_status_idx" ON "Inventur"("status");

-- CreateIndex
CREATE INDEX "InventurPosition_inventurId_idx" ON "InventurPosition"("inventurId");

-- CreateIndex
CREATE INDEX "InventurPosition_artikelId_idx" ON "InventurPosition"("artikelId");
