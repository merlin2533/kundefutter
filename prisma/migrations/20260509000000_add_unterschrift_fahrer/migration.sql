-- Digitale Kundenunterschrift + Fahrerzuweisung auf Lieferung
ALTER TABLE "Lieferung" ADD COLUMN "unterschriftPng" TEXT;
ALTER TABLE "Lieferung" ADD COLUMN "fahrerId" INTEGER;
