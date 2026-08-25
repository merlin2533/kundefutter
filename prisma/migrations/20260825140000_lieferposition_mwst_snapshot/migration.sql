-- Friert den MwSt-Satz je Lieferposition ein (analog zu verkaufspreis), damit eine
-- spätere Änderung von Artikel.mwstSatz bereits erstellte Rechnungen/Lieferscheine
-- nicht mehr rückwirkend verändert.
ALTER TABLE "Lieferposition" ADD COLUMN "mwstSatz" REAL NOT NULL DEFAULT 19;

-- Backfill: für bereits bestehende Positionen ist der historisch tatsächlich
-- ausgewiesene Satz nicht mehr rekonstruierbar — beste verfügbare Näherung ist der
-- aktuell am Artikel hinterlegte Satz. Ab hier ist der Wert eingefroren.
UPDATE "Lieferposition"
SET "mwstSatz" = (SELECT "mwstSatz" FROM "Artikel" WHERE "Artikel"."id" = "Lieferposition"."artikelId")
WHERE EXISTS (SELECT 1 FROM "Artikel" WHERE "Artikel"."id" = "Lieferposition"."artikelId");
