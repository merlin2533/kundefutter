-- Performance: Indizes auf häufig gefilterte Felder in Lieferung
CREATE INDEX IF NOT EXISTS "Lieferung_rechnungNr_idx" ON "Lieferung"("rechnungNr");
CREATE INDEX IF NOT EXISTS "Lieferung_bezahltAm_idx" ON "Lieferung"("bezahltAm");
