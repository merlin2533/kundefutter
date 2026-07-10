-- Phase 4: fehlende Indizes auf FK-/Datumsfeldern für Performance
-- (KundeBedarf, KundeArtikelPreis, ArtikelLieferant, ArtikelPreisHistorie,
--  Wareneingang, Sammelrechnung, GutschriftPosition)

-- CreateIndex
CREATE INDEX "ArtikelLieferant_lieferantId_idx" ON "ArtikelLieferant"("lieferantId");

-- CreateIndex
CREATE INDEX "ArtikelPreisHistorie_artikelId_idx" ON "ArtikelPreisHistorie"("artikelId");

-- CreateIndex
CREATE INDEX "ArtikelPreisHistorie_geaendertAm_idx" ON "ArtikelPreisHistorie"("geaendertAm");

-- CreateIndex
CREATE INDEX "GutschriftPosition_gutschriftId_idx" ON "GutschriftPosition"("gutschriftId");

-- CreateIndex
CREATE INDEX "GutschriftPosition_artikelId_idx" ON "GutschriftPosition"("artikelId");

-- CreateIndex
CREATE INDEX "KundeArtikelPreis_artikelId_idx" ON "KundeArtikelPreis"("artikelId");

-- CreateIndex
CREATE INDEX "KundeBedarf_artikelId_idx" ON "KundeBedarf"("artikelId");

-- CreateIndex
CREATE INDEX "Sammelrechnung_kundeId_idx" ON "Sammelrechnung"("kundeId");

-- CreateIndex
CREATE INDEX "Sammelrechnung_rechnungDatum_idx" ON "Sammelrechnung"("rechnungDatum");

-- CreateIndex
CREATE INDEX "Wareneingang_lieferantId_idx" ON "Wareneingang"("lieferantId");

-- CreateIndex
CREATE INDEX "Wareneingang_datum_idx" ON "Wareneingang"("datum");

-- CreateIndex
CREATE INDEX "Wareneingang_lieferungId_idx" ON "Wareneingang"("lieferungId");
