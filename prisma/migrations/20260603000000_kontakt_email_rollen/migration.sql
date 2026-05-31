-- AddColumn: Rechnungs- und Lieferschein-E-Mail-Markierung an KundeKontakt
ALTER TABLE "KundeKontakt" ADD COLUMN "rechnungsEmail" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "KundeKontakt" ADD COLUMN "lieferscheinEmail" BOOLEAN NOT NULL DEFAULT false;
