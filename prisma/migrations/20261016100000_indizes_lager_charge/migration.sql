-- Indizes für Chargen-Rückverfolgung und Belegverknüpfungen (bisher Full-Table-Scans)
CREATE INDEX IF NOT EXISTS "Lagerbewegung_lieferungId_idx" ON "Lagerbewegung"("lieferungId");
CREATE INDEX IF NOT EXISTS "Lagerbewegung_wareneingangId_idx" ON "Lagerbewegung"("wareneingangId");
CREATE INDEX IF NOT EXISTS "Lagerbewegung_chargeNr_idx" ON "Lagerbewegung"("chargeNr");
CREATE INDEX IF NOT EXISTS "Lieferposition_chargeNr_idx" ON "Lieferposition"("chargeNr");
