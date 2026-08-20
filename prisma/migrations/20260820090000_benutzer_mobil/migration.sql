-- Persönliche Mobilnummer je Benutzer — erscheint als "Ihr Ansprechpartner" auf
-- Mahnungs-PDFs (der Absender ist der Sachbearbeiter, nicht die allgemeine Firmenzentrale).
ALTER TABLE "Benutzer" ADD COLUMN "mobil" TEXT;
