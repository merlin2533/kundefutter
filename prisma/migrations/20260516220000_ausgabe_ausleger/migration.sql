-- AlterTable: Ausgabe — Privat-Ausleger
ALTER TABLE "Ausgabe" ADD COLUMN "ausleger" TEXT;
CREATE INDEX "Ausgabe_ausleger_idx" ON "Ausgabe"("ausleger");
