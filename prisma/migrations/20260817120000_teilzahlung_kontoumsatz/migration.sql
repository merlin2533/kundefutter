-- Verknüpft eine Teilzahlung optional mit dem Kontoumsatz, aus dem sie beim Bankabgleich
-- erzeugt wurde (Zahlung deckt nur einen Teil der Rechnung ab). Ermöglicht, die Teilzahlung
-- beim Aufheben der Zuordnung wieder zurückzunehmen.
ALTER TABLE "Teilzahlung" ADD COLUMN "kontoumsatzId" INTEGER;

CREATE INDEX "Teilzahlung_kontoumsatzId_idx" ON "Teilzahlung"("kontoumsatzId");
