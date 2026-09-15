-- Anschrift (Straße/PLZ/Ort) für Mitarbeiter-Stammdaten — bisher nur Kontakt (E-Mail/Telefon),
-- kein Feld für die private Anschrift.
ALTER TABLE "Mitarbeiter" ADD COLUMN "strasse" TEXT;
ALTER TABLE "Mitarbeiter" ADD COLUMN "plz" TEXT;
ALTER TABLE "Mitarbeiter" ADD COLUMN "ort" TEXT;
