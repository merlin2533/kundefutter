-- Separates Lieferdatum für Lieferung (zeigt auf Rechnung, kann abweichend vom internen Datum sein).
ALTER TABLE "Lieferung" ADD COLUMN "lieferDatum" DATETIME;
