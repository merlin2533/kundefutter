-- Freie Notiz/Hinweis am Artikel, läuft auf Lieferpositionen durch
-- (z.B. Abpackungsgrößen bei gleichem kg-Preis → Artikel nur einmal anlegen)
ALTER TABLE "Artikel" ADD COLUMN "notiz" TEXT;
