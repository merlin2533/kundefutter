-- Bankabgleich: Zuordnung auch gegen Lieferantenrechnungen (Zahlungsausgänge) +
-- Transparenz, wie eine Zuordnung zustande kam (manuell/automatisch/KI)
ALTER TABLE "Kontoumsatz" ADD COLUMN "eingangsRechnungId" INTEGER;
ALTER TABLE "Kontoumsatz" ADD COLUMN "zuordnungsArt" TEXT;
ALTER TABLE "Kontoumsatz" ADD COLUMN "kiKonfidenz" REAL;
