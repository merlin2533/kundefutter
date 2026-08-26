-- Doppelzahlung im Bankabgleich: ein Kunde hat dieselbe (bereits bezahlte) Rechnung ein
-- zweites Mal überwiesen. Der Kontoumsatz der zweiten Zahlung kann dann in eine eigene
-- Gutschrift des Kunden umgewandelt werden (grund "Doppelzahlung"), statt einer konkreten
-- Rechnung zugeordnet zu werden (die taucht als Kandidat nicht mehr auf, da bereits bezahlt).
ALTER TABLE "Kontoumsatz" ADD COLUMN "gutschriftId" INTEGER;

CREATE INDEX "Kontoumsatz_gutschriftId_idx" ON "Kontoumsatz"("gutschriftId");
