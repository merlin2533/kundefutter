-- AlterTable: Artikel sprengstoffvorlaeufer Flag
ALTER TABLE "Artikel" ADD COLUMN "sprengstoffvorlaeufer" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: KundeSprengstoffErklaerung
CREATE TABLE "KundeSprengstoffErklaerung" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "kundeId" INTEGER NOT NULL,
    "jahr" INTEGER NOT NULL,
    "datum" DATETIME NOT NULL,
    "dokumentPfad" TEXT,
    "notiz" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KundeSprengstoffErklaerung_kundeId_fkey" FOREIGN KEY ("kundeId") REFERENCES "Kunde" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "KundeSprengstoffErklaerung_kundeId_jahr_key" ON "KundeSprengstoffErklaerung"("kundeId", "jahr");

-- CreateIndex
CREATE INDEX "KundeSprengstoffErklaerung_kundeId_idx" ON "KundeSprengstoffErklaerung"("kundeId");
