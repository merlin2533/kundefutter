-- Lager-Tracking per Artikel: false = kein Bestand wird geführt (Dienstleistungen)
-- Bestehende Beratungs-/Analysen-Artikel erhalten automatisch lagerTracking=false,
-- da sie schon bisher über NICHT_LAGER_KATEGORIEN ausgeschlossen wurden.
ALTER TABLE "Artikel" ADD COLUMN "lagerTracking" BOOLEAN NOT NULL DEFAULT true;
UPDATE "Artikel" SET "lagerTracking" = false WHERE "kategorie" IN ('Beratung', 'Analysen');
