-- AlterTable: Geocoding-Versuchszähler zu Kunde hinzufügen
ALTER TABLE "Kunde" ADD COLUMN "geocodeVersuche" INTEGER NOT NULL DEFAULT 0;
