-- Kontoumsatz: manuelles Ausblenden einzelner Buchungen (z.B. interne Umbuchungen),
-- ohne sie einer Rechnung/Ausgabe zuzuordnen und ohne sie als offenen Posten zu führen.
ALTER TABLE "Kontoumsatz" ADD COLUMN "ignoriert" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "Kontoumsatz_ignoriert_idx" ON "Kontoumsatz"("ignoriert");
