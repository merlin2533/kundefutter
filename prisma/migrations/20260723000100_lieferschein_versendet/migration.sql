-- Zeitpunkt des E-Mail-Versands des Lieferscheins (für "bereits versendet"-Anzeige)
ALTER TABLE "Lieferung" ADD COLUMN "lieferscheinVersendetAm" DATETIME;
