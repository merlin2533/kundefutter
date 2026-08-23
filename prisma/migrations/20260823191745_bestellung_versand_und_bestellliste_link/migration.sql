-- Bestellung: Nachweis, dass eine Lieferantenbestellung per E-Mail rausgeschickt wurde
-- (versendetAn getrennt von Lieferant.email gespeichert, falls sich die Lieferanten-Adresse
-- später ändert). Bestellposition (Bestellliste-Eintrag) bekommt einen optionalen Link auf die
-- Bestellung, zu der sie gebündelt wurde, damit "was ist schon bestellt" nachvollziehbar bleibt.
ALTER TABLE "Bestellung" ADD COLUMN "versendetAm" DATETIME;
ALTER TABLE "Bestellung" ADD COLUMN "versendetAn" TEXT;
ALTER TABLE "Bestellposition" ADD COLUMN "bestellungId" INTEGER;

CREATE INDEX "Bestellposition_bestellungId_idx" ON "Bestellposition"("bestellungId");
