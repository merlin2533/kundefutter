-- AlterTable
ALTER TABLE "Lieferung" ADD COLUMN "bezahltAm" DATETIME;
ALTER TABLE "Lieferung" ADD COLUMN "zahlungsziel" INTEGER DEFAULT 30;
