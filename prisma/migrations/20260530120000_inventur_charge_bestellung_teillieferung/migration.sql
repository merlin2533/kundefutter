-- InventurPosition: Chargennummer bei Inventur
ALTER TABLE "InventurPosition" ADD COLUMN "chargeNr" TEXT;

-- Bestellposition: Teillieferungsmengen + Status teilgeliefert
ALTER TABLE "Bestellposition" ADD COLUMN "mengeGeliefert" REAL NOT NULL DEFAULT 0;
