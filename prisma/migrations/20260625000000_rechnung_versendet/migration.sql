-- Zeitpunkt des E-Mail-Versands der Rechnung (für "bereits versendet"-Anzeige)
ALTER TABLE "Lieferung" ADD COLUMN "rechnungVersendetAm" DATETIME;
