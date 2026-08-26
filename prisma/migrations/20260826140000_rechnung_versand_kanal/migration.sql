-- Rechnungen können jetzt auch manuell "Als per Post versendet markieren" werden — löst
-- denselben Sperr-Mechanismus (rechnungVersendetAm) aus wie der bisherige E-Mail-Versand,
-- damit Positionen nach dem Postversand ebenfalls nicht mehr unbemerkt geändert werden können.
-- rechnungVersandKanal ist rein informativ für die Anzeige (E-Mail vs. Post).
ALTER TABLE "Lieferung" ADD COLUMN "rechnungVersandKanal" TEXT;
