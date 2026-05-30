-- AlterTable: Lieferant — add frachtkosten and mindestbestellwert
ALTER TABLE "Lieferant" ADD COLUMN "frachtkosten" REAL NOT NULL DEFAULT 0;
ALTER TABLE "Lieferant" ADD COLUMN "mindestbestellwert" REAL NOT NULL DEFAULT 0;
