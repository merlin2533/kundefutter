-- Rechnung stornierbar: storniertes Rechnungsdatum festhalten (verschwindet aus der Rechnungsliste)
ALTER TABLE "Lieferung" ADD COLUMN "rechnungStorniert" DATETIME;
