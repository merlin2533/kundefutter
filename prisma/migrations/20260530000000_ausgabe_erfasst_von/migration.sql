ALTER TABLE "Ausgabe" ADD COLUMN "erfasstVon" TEXT;
ALTER TABLE "Ausgabe" ADD COLUMN "bezahltVon" TEXT;
CREATE INDEX "Ausgabe_erfasstVon_idx" ON "Ausgabe"("erfasstVon");
