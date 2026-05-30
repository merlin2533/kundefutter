-- AlterTable: Add zielgruppeKriterien to Kampagne
ALTER TABLE "Kampagne" ADD COLUMN "zielgruppeKriterien" TEXT;

-- CreateTable: KampagneKunde
CREATE TABLE "KampagneKunde" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "kampagneId" INTEGER NOT NULL,
    "kundeId" INTEGER NOT NULL,
    CONSTRAINT "KampagneKunde_kampagneId_fkey" FOREIGN KEY ("kampagneId") REFERENCES "Kampagne" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "KampagneKunde_kundeId_fkey" FOREIGN KEY ("kundeId") REFERENCES "Kunde" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "KampagneKunde_kampagneId_kundeId_key" ON "KampagneKunde"("kampagneId", "kundeId");

-- CreateIndex
CREATE INDEX "KampagneKunde_kampagneId_idx" ON "KampagneKunde"("kampagneId");

-- CreateIndex
CREATE INDEX "KampagneKunde_kundeId_idx" ON "KampagneKunde"("kundeId");
