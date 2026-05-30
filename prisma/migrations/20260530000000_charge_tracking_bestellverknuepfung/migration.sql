-- Artikel: Chargenpflicht-Flag
ALTER TABLE "Artikel" ADD COLUMN "chargePflicht" BOOLEAN NOT NULL DEFAULT false;

-- Lagerbewegung: Chargennummer mitführen
ALTER TABLE "Lagerbewegung" ADD COLUMN "chargeNr" TEXT;

-- WareineingangPosition: Verknüpfung zur Bestellposition
ALTER TABLE "WareineingangPosition" ADD COLUMN "bestellpositionId" INTEGER REFERENCES "Bestellposition"("id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WareineingangPosition_bestellpositionId_idx" ON "WareineingangPosition"("bestellpositionId");
